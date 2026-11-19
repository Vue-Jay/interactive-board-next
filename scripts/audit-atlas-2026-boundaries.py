"""Compare actual 2022 Lektrus geometry with the current World Bank ADM0.

CC BY 4.0 reference: https://datacatalog.worldbank.org/search/dataset/0038272/world-bank-official-boundaries
Differences are review candidates, not automatic replacements of a worldview.
Run in CI with shapely and pyproj. Never change the production data here.
"""
import json
import hashlib
import math
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from pyproj import Transformer
from shapely import make_valid, prepare
from shapely.affinity import translate
from shapely.geometry import shape, Polygon, MultiPolygon, box, mapping
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree
from shapely.validation import explain_validity

URL = "https://services.arcgis.com/iQ1dY19aHwbSDYIF/arcgis/rest/services/World_Bank_Global_Administrative_Divisions/FeatureServer/1"
NDLSA_URL = URL.rsplit("/", 1)[0] + "/5"
TRANSFORMER = Transformer.from_crs(4326, 6933, always_xy=True)
INVERSE_TRANSFORMER = Transformer.from_crs(6933, 4326, always_xy=True)


def request(params, endpoint=URL):
    query = endpoint + "?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(query, timeout=150) as response:
                value = json.load(response)
            if "error" in value or value.get("exceededTransferLimit"):
                raise ValueError(str(value.get("error", "truncated result")))
            return value
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def polygon_parts(geometry):
    if geometry.geom_type == "Polygon":
        return [geometry]
    return [part for g in getattr(geometry, "geoms", []) for part in polygon_parts(g)]


def unwrap_ring(coords, anchor=None):
    result = []
    for lon, lat, *_ in coords:
        if result:
            lon += 360 * round((result[-1][0] - lon) / 360)
        elif anchor is not None:
            lon += 360 * round((anchor - lon) / 360)
        result.append((lon, lat))
    return result


def repair_nested_shells(parts):
    """Recover odd-depth holes and even-depth islands without a global
    linework overlay over hundreds of thousands of unrelated coastline points.
    Only accept a valid result; otherwise use GEOS's general linework repair."""
    tree = STRtree(parts)
    areas = [p.area for p in parts]
    parents = {}
    for i, p in enumerate(parts):
        candidates = sorted((int(j) for j in tree.query(p) if areas[j] > areas[i]), key=lambda j: areas[j])
        for j in candidates:
            prepare(parts[j])
            if parts[j].contains_properly(p):
                parents[i] = j
                break
    if not parents:
        return None
    children = {}
    for child, parent in parents.items():
        children.setdefault(parent, []).append(parts[child])
    result = []
    for i, p in enumerate(parts):
        depth, ancestor = 0, i
        while ancestor in parents:
            depth += 1
            ancestor = parents[ancestor]
        if depth % 2 == 0:
            result.extend(polygon_parts(p.difference(unary_union(children[i])) if i in children else p))
    candidate = result[0] if len(result) == 1 else MultiPolygon(result)
    return candidate if not candidate.is_empty and candidate.is_valid else None


def antimeridian_safe(geometry):
    """Unwrap rings before projecting. Split at +/-180, keeping holes.
    A polygon crossing the date line must not cover the whole planet.
    """
    parts = []
    for p in polygon_parts(geometry):
        outer = unwrap_ring(p.exterior.coords)
        holes = [unwrap_ring(r.coords, outer[0][0]) for r in p.interiors]
        unwrapped = make_valid(Polygon(outer, holes))
        if unwrapped.is_empty:
            continue
        lo, _, hi, _ = unwrapped.bounds
        if lo >= -180 and hi <= 180:
            parts.extend(polygon_parts(unwrapped))
            continue
        for k in range(math.floor((lo + 180) / 360), math.floor((hi + 180) / 360) + 1):
            segment = unwrapped.intersection(box(-180 + 360*k, -90, 180 + 360*k, 90))
            parts.extend(translate(g, xoff=-360*k) for g in polygon_parts(segment))
    if not parts:
        return MultiPolygon()
    # Nested shells in the source may actually represent holes. Unioning
    # separate rings first fills those holes (Italy, South Africa, etc.).
    combined = parts[0] if len(parts) == 1 else MultiPolygon(parts)
    if combined.is_valid:
        return combined
    if explain_validity(combined).startswith("Nested shells"):
        nested = repair_nested_shells(parts)
        if nested is not None:
            return nested
    return unary_union(polygon_parts(make_valid(combined)))


def normalize_source_topology(features):
    corrected, repairs = [], []
    for f in features:
        if not f.get("geometry"):
            corrected.append(f)
            continue
        raw = shape(f["geometry"])
        normalized = antimeridian_safe(raw)
        assert normalized.is_valid and not normalized.is_empty, f"unusable polygon: {f['properties']}"
        if not raw.is_valid:
            repairs.append({"sourceId": f["properties"].get("FID", f.get("id")), "code": f["properties"].get("ISO_A3"),
                            "name": f["properties"].get("NAM_0"), "reason": explain_validity(raw)})
        corrected.append({**f, "geometry": mapping(normalized), "properties": {**f["properties"],
                          "LEKTRUS_TOPOLOGY": "source-valid" if raw.is_valid else "repaired-invalid-source"}})
    return corrected, repairs


def projected(features):
    if not features:
        return None
    result = unary_union([make_valid(transform(TRANSFORMER.transform, antimeridian_safe(shape(f["geometry"])))) for f in features])
    if result.is_empty or result.area <= 0:
        return None
    return result


def describe(a, b):
    if a is None or b is None:
        return None
    intersection = a.intersection(b).area
    union = a.area + b.area - intersection
    return {"atlasKm2": round(a.area / 1e6, 3), "referenceKm2": round(b.area / 1e6, 3),
            "atlasOnlyKm2": round((a.area - intersection) / 1e6, 3),
            "referenceOnlyKm2": round((b.area - intersection) / 1e6, 3),
            "intersectionOverUnion": round(intersection / union, 7)}


def geometry_digest(feature):
    return hashlib.sha256(json.dumps(feature["geometry"], sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def source_edition(meta):
    stamp = meta.get("editingInfo", {}).get("dataLastEditDate") or meta.get("editingInfo", {}).get("lastEditDate")
    assert stamp, "reference data edition is not available"
    return datetime.fromtimestamp(stamp / 1000, timezone.utc).date().isoformat()


def fetch_complete_reference(meta, endpoint=URL):
    """Fetch the full dated source, not only the UN roster. No World Bank
    administrative feature is promoted to independent state by this import."""
    oid_field = meta.get("objectIdField") or next(f["name"] for f in meta["fields"] if f["type"] == "esriFieldTypeOID")
    query = endpoint + "/query"
    ids = request({"where": "1=1", "returnIdsOnly": "true", "f": "json"}, query)["objectIds"]
    assert ids and len(ids) == len(set(ids)), "source object ID list is empty or duplicated"
    features = []
    ids = sorted(ids)
    for start in range(0, len(ids), 10):
        batch = ids[start:start + 10]
        response = request({"objectIds": ",".join(map(str, batch)), "outFields": f"{oid_field},ISO_A3,NAM_0,WB_STATUS",
                            "returnGeometry": "true", "outSR": "4326", "f": "geojson"}, query)
        assert response.get("type") == "FeatureCollection"
        returned = [f.get("properties", {}).get(oid_field, f.get("id")) for f in response["features"]]
        assert set(map(int, returned)) == set(batch) and len(returned) == len(batch), "incomplete reference batch"
        features.extend(sorted(response["features"], key=lambda f: int(f.get("properties", {}).get(oid_field, f.get("id")))))
    assert len(features) == len(ids)
    assert source_edition(request({"f": "json"}, endpoint)) == source_edition(meta), "source changed during download"
    return features


def source_snapshot(reference, edition, endpoint=URL):
    """A real date-specific candidate asset; keep source statuses and raw
    polygons. No inference of sovereign ownership or intra-year history."""
    missing_geometry = 0
    for f in reference:
        assert f.get("type") == "Feature" and isinstance(f.get("properties"), dict)
        if not f.get("geometry"):
            missing_geometry += 1
        else:
            assert f["geometry"]["type"] in {"Polygon", "MultiPolygon"}
    return {"type": "FeatureCollection", "year": 2026, "edition": edition,
            "source": endpoint, "sourceLicense": "CC BY 4.0", "reviewStatus": "candidate-only",
            "notice": "World Bank administrative polygons, not certified sovereignty or exact legal boundaries; source edition is not a year-end state.",
            "missingGeometry": missing_geometry, "features": reference}


ENCLAVE_SOURCES = {
    "VAT": "https://www.vaticanstate.va/en/state-and-government/general-informations/geography.html",
    "SMR": "https://www.esteri.it/it/temi/aree_geografiche/europa/europa_meridionale_e_mediterranea/",
    "LSO": "https://www.gov.ls/about-lesotho/",
}
ENCLAVE_HOSTS = {"ITA": ("VAT", "SMR"), "ZAF": ("LSO",)}


def normalize_known_enclaves(features, code_field="ISO_A3", require_all=False):
    """Remove only proven sovereign enclaves; do not alter disputed areas."""
    by_code = lambda code: [f for f in features if f["properties"].get(code_field) == code and f.get("geometry")]
    report = []
    corrected = list(features)
    for host, codes in ENCLAVE_HOSTS.items():
        if not require_all and not any(by_code(c) for c in (host, *codes)):
            continue
        holes = {c: unary_union([antimeridian_safe(shape(f["geometry"])) for f in by_code(c)]) for c in codes}
        assert by_code(host) and all(not g.is_empty for g in holes.values()), f"missing host or enclave: {host}"
        original = unary_union([antimeridian_safe(shape(f["geometry"])) for f in by_code(host)])
        union = unary_union(list(holes.values()))
        for i, f in enumerate(corrected):
            if f["properties"].get(code_field) != host or not f.get("geometry"):
                continue
            geometry = antimeridian_safe(shape(f["geometry"]))
            if geometry.intersection(union).area > 0:
                result = unary_union(polygon_parts(geometry.difference(union)))
                assert not result.is_empty and result.is_valid
                corrected[i] = {**f, "geometry": mapping(result), "properties": {**f["properties"], "LEKTRUS_CORRECTION": "remove-" + "-".join(codes) + "-overlaps"}}
        new_host = projected([f for f in corrected if f["properties"].get(code_field) == host and f.get("geometry")])
        for code, hole in holes.items():
            before = transform(TRANSFORMER.transform, original.intersection(hole)).area / 1e6
            after = new_host.intersection(transform(TRANSFORMER.transform, hole)).area / 1e6
            assert after < 1e-8, f"candidate still overlaps independent enclave: {code}"
            report.append({"host": host, "enclave": code, "overlapBeforeKm2": round(before, 6), "overlapAfterKm2": round(after, 6),
                           "source": ENCLAVE_SOURCES[code], "status": "candidate-topology-correction"})
    return corrected, report


def annotate_reference_identity(features, roster, edition, layer="ADM0"):
    """UN roster membership is distinct from the provider's administrative status."""
    main_ids = set()
    if layer == "ADM0":
        for code in roster:
            matches = [f for f in features if f["properties"].get("ISO_A3") == code]
            if len(matches) > 1:
                matches = [f for f in matches if f["properties"].get("WB_STATUS") != "Territory"]
            assert len(matches) == 1, f"ambiguous or missing sovereign entity: {code}"
            main_ids.add(matches[0]["properties"].get("FID", matches[0].get("id")))
    result, ids = [], set()
    for f in features:
        p = f["properties"]
        fid = p.get("FID", f.get("id"))
        assert fid is not None and fid not in ids, "missing or duplicate source record identity"
        ids.add(fid)
        code = p.get("ISO_A3")
        status = ("non-member-observer" if code in {"PSE", "VAT"} else "un-member") if fid in main_ids else "outside-roster"
        name = "French Guiana" if layer == "ADM0" and code == "GUF" else p.get("NAM_0")
        result.append({**f, "properties": {**p, "LEKTRUS_ENTITY_ID": f"wb:{layer}:{edition}:{fid}",
                       "LEKTRUS_UN_ROSTER_STATUS": status, "LEKTRUS_NAME": name}})
    return result


def classify_country_rows(rows):
    """Numerical triage, not an automatic acceptance based on area/IoU."""
    for row in rows:
        comparison = row["russianViewVsReference"]
        views = row["russianVsDefault2022"]
        row["review"] = "pending-source-and-boundary-review"
        row["flags"] = []
        if comparison is None:
            row["flags"].append("no-comparable-polygon")
            continue
        if comparison["intersectionOverUnion"] < 0.9:
            row["flags"].append("large-spatial-disagreement")
        if views and views["intersectionOverUnion"] < 0.999:
            row["flags"].append("cartographic-viewpoint-difference")
        if row["iso"] in {"VAT", "MCO", "SGP"}:
            row["flags"].append("archived-geometry-not-suitable-for-precise-boundary")
    return rows


def component_gaps(a, b, minimum_km2=0.01):
    """Identify disconnected land components absent from the other layer.

    A different coastline scale can produce these candidates. Record actual
    coordinates for subsequent island-by-island source checking; do not
    manufacture land or claim missing sovereignty from geometry alone.
    """
    if a is None or b is None:
        return None

    def disconnected(geometry, other):
        components = polygon_parts(geometry)
        other_parts = polygon_parts(other)
        index = STRtree(other_parts)
        gaps = []
        for part in components:
            km2 = part.area / 1e6
            if km2 < minimum_km2 or any(part.intersection(other_parts[j]).area > 1e-6 for j in index.query(part)):
                continue
            location = transform(INVERSE_TRANSFORMER.transform, part.representative_point())
            gaps.append({"km2": round(km2, 6), "lon": round(location.x, 6), "lat": round(location.y, 6)})
        return {"componentCount": len(components), "disconnectedCount": len(gaps), "disconnectedKm2": round(sum(g["km2"] for g in gaps), 6),
                "components": sorted(gaps, key=lambda g: -g["km2"])}

    return {"minimumKm2": minimum_km2, "atlasOnly": disconnected(a, b), "referenceOnly": disconnected(b, a)}


def geometry_overlaps(features, code_field):
    """All overlapping country/territory polygons, without automatically
    resolving potentially contested or institutionally aggregated regions."""
    groups = {}
    for i, f in enumerate(features):
        if not f.get("geometry"):
            continue
        code = f["properties"].get(code_field)
        key = code if code and code not in {"-99", "UNK"} else f"unresolved-source-{i}"
        groups.setdefault(key, []).append(f)
    data = [(key, projected(group), group[0]["properties"]) for key, group in groups.items()]
    data = [(key, geom, props) for key, geom, props in data if geom is not None]
    geoms = [g for _, g, _ in data]
    tree = STRtree(geoms)
    overlaps = []
    for i, (name, geometry, props) in enumerate(data):
        for j in tree.query(geometry):
            if j <= i:
                continue
            other = geoms[j]
            area = geometry.intersection(other).area
            if area <= 1000:  # 0.001 km²: exclude numerical slivers only
                continue
            pair = sorted([(name, props), (data[j][0], data[j][2])], key=lambda row: row[0])
            overlaps.append({"entities": [key for key, _ in pair], "names": [p.get("LEKTRUS_NAME", p.get("NAME", p.get("NAM_0"))) for _, p in pair],
                             "codes": [p.get("ISO_A3", p.get("ADM0_A3")) for _, p in pair], "overlapKm2": round(area / 1e6, 6),
                             "shareOfSmaller": round(area / min(geometry.area, other.area), 6),
                             "review": "requires-territorial-status-review"})
    return sorted(overlaps, key=lambda row: (-row["overlapKm2"], row["entities"]))


def main():
    folder, out = map(pathlib.Path, sys.argv[1:3])
    roster_text = (pathlib.Path(__file__).parent / "atlas-2026-capitals.mjs").read_text()
    roster = re.findall(r"(?:`|\|)([A-Z]{3})=", roster_text)
    assert len(roster) == len(set(roster)) == 195
    dateline = Polygon([(179, 0), (-179, 0), (-179, 1), (179, 1), (179, 0)])
    assert abs(antimeridian_safe(dateline).area - 2) < 1e-9
    offline = len(sys.argv) == 5 and sys.argv[3] == "--existing-source"
    assert offline or len(sys.argv) == 3, "usage: DATA_FOLDER REPORT [--existing-source GEOJSON]"
    if offline:
        raw_bytes = pathlib.Path(sys.argv[4]).read_bytes()
        raw_snapshot = json.loads(raw_bytes)
        assert raw_snapshot["source"] == URL and raw_snapshot["type"] == "FeatureCollection"
        edition = raw_snapshot["edition"]
        reference = raw_snapshot["features"]
    else:
        meta = request({"f": "json"})
        edition = source_edition(meta)
        reference = fetch_complete_reference(meta)
        raw_snapshot = source_snapshot(reference, edition)
        raw_bytes = json.dumps(raw_snapshot, ensure_ascii=False, separators=(",", ":")).encode()
    assert edition.startswith("2026-"), f"reference must be dated 2026, got {edition}"
    # Fetch the actual polygons, not the ArcGIS tile imagery. Query batches to
    # avoid silent service transfer limits. Keep returned geometry precision.
    out.with_name("world-2026-source.geojson").write_bytes(raw_bytes)
    normalized, repairs = normalize_source_topology(reference)
    corrected_features, corrections = normalize_known_enclaves(normalized, require_all=True)
    corrected_features = annotate_reference_identity(corrected_features, roster, edition)
    membership = {status: sum(f["properties"]["LEKTRUS_UN_ROSTER_STATUS"] == status for f in corrected_features)
                  for status in ("un-member", "non-member-observer", "outside-roster")}
    assert membership["un-member"] == 193 and membership["non-member-observer"] == 2
    snapshot = {**raw_snapshot, "features": corrected_features,
                "sourceSHA256": hashlib.sha256(raw_bytes).hexdigest(), "corrections": corrections, "topologyRepairs": repairs,
                "membershipSources": ["https://www.un.org/en/about-us/member-states", "https://www.un.org/en/about-us/non-member-states"],
                "nameSource": "https://unstats.un.org/unsd/methodology/m49/overview",
                "membershipNotice": "VAT represents the geographic Vatican City; the Holy See is the UN observer. Provider WB_STATUS remains unchanged."}
    snapshot_bytes = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")).encode()
    out.with_name("world-2026-candidate.geojson").write_bytes(snapshot_bytes)
    ndlsa = {"status": "not-fetched-in-offline-replay"}
    if not offline:
        ndlsa_meta = request({"f": "json"}, NDLSA_URL)
        ndlsa_edition = source_edition(ndlsa_meta)
        assert ndlsa_edition == edition, "ADM0 and NDLSA editions do not match"
        ndlsa_features = fetch_complete_reference(ndlsa_meta, NDLSA_URL)
        ndlsa_raw = source_snapshot(ndlsa_features, ndlsa_edition, NDLSA_URL)
        ndlsa_raw_bytes = json.dumps(ndlsa_raw, ensure_ascii=False, separators=(",", ":")).encode()
        ndlsa_normalized, ndlsa_repairs = normalize_source_topology(ndlsa_features)
        ndlsa_candidate = {**ndlsa_raw, "layer": "NDLSA", "features": annotate_reference_identity(ndlsa_normalized, roster, edition, "NDLSA"),
                           "sourceSHA256": hashlib.sha256(ndlsa_raw_bytes).hexdigest(), "topologyRepairs": ndlsa_repairs}
        ndlsa_bytes = json.dumps(ndlsa_candidate, ensure_ascii=False, separators=(",", ":")).encode()
        out.with_name("world-2026-ndlsa-source.geojson").write_bytes(ndlsa_raw_bytes)
        out.with_name("world-2026-ndlsa-candidate.geojson").write_bytes(ndlsa_bytes)
        ndlsa = {"status": "separate-layer-pending-territorial-review", "edition": ndlsa_edition, "features": len(ndlsa_features),
                 "sourceSHA256": hashlib.sha256(ndlsa_raw_bytes).hexdigest(), "candidateSHA256": hashlib.sha256(ndlsa_bytes).hexdigest(),
                 "missingGeometry": ndlsa_raw["missingGeometry"], "topologyRepairs": len(ndlsa_repairs)}
    rus = json.loads((folder / "ne_10m_admin_0_countries_rus.geojson").read_text())["features"]
    default = json.loads((folder / "ne_10m_admin_0_countries.geojson").read_text())["features"]
    rows = []
    for code in roster:
        adm = {"SSD": "SDS", "PSE": "PSX"}.get(code, code)
        ref = projected([f for f in corrected_features if f["properties"].get("ISO_A3") == code and f.get("geometry")
                         and f["properties"]["LEKTRUS_UN_ROSTER_STATUS"] != "outside-roster"])
        current = projected([f for f in rus if f["properties"].get("ADM0_A3") == adm])
        neutral = projected([f for f in default if f["properties"].get("ADM0_A3") == adm])
        rows.append({"iso": code, "referencePresent": ref is not None,
                     "russianViewVsReference": describe(current, ref),
                     "defaultViewVsReference": describe(neutral, ref),
                     "russianVsDefault2022": describe(current, neutral),
                     "disconnectedLandComponents": component_gaps(current, ref)})
    # Crosswalk every archived atlas territory separately. Non-matching codes
    # may mean a different cartographic convention; never silently discard them.
    reference_codes = {f["properties"].get("ISO_A3") for f in reference}
    baseline = []
    neutral_by_geometry = {}
    for f in default:
        neutral_by_geometry.setdefault(geometry_digest(f), []).append(f["properties"])
    crosswalk = {"SDS": "SSD", "PSX": "PSE", "ALD": "ALA", "CLP": "CPT"}
    named = {"ATC": ("AUS", "Ashmore and Cartier Islands (Aus.)"), "ESB": ("GBR", "Sovereign Base Areas of Akrotiri and Dhekelia (U.K.)"),
             "WSB": ("GBR", "Sovereign Base Areas of Akrotiri and Dhekelia (U.K.)")}
    for i, f in enumerate(rus):
        p = f["properties"]
        code = p.get("ADM0_A3")
        matches = [g["properties"] for g in corrected_features if code and g["properties"].get("ISO_A3") == crosswalk.get(code, code)]
        if code in named:
            target_code, name = named[code]
            matches = [g["properties"] for g in corrected_features if g["properties"].get("ISO_A3") == target_code and g["properties"].get("NAM_0") == name]
        digest = geometry_digest(f)
        neutral_exact = neutral_by_geometry.get(digest, [])
        baseline.append({"index": i, "code": code, "name": p.get("NAME"), "type": p.get("TYPE"), "sovCode": p.get("SOV_A3"),
                         "archiveViewCode": p.get("ADM0_A3_RU"),
                         "neutralExactGeometryMatches": [{"code": g.get("ADM0_A3"), "name": g.get("NAME"), "type": g.get("TYPE")} for g in neutral_exact],
                         "referenceCodePresent": crosswalk.get(code, code) in reference_codes,
                         "referenceCandidatePresent": bool(matches),
                         "referenceCandidates": [{"id": g["LEKTRUS_ENTITY_ID"], "code": g["ISO_A3"], "name": g["LEKTRUS_NAME"]} for g in matches],
                         "matchKind": "combined-source-territory" if code in {"ESB", "WSB"} and matches else "multiple-source-records" if len(matches) > 1 else "candidate-crosswalk" if matches else "unresolved",
                         "geometrySHA256": digest,
                         "review": "candidate-only"})
    report = {"year": 2026, "source": URL, "edition": edition, "referenceLicense": "CC BY 4.0",
              "atlasEdition": "2022-06-02", "method": "EPSG:6933 area intersection; different coastline resolution and political conventions affect results",
              "reviewState": "geometry candidates, not historical acceptance", "countries": classify_country_rows(rows),
              "sourceSnapshot": {"file": "world-2026-candidate.geojson", "sha256": hashlib.sha256(snapshot_bytes).hexdigest(),
                                 "rawFile": "world-2026-source.geojson", "rawSHA256": hashlib.sha256(raw_bytes).hexdigest(),
                                 "features": len(reference), "distinctSourceCodes": len(reference_codes), "missingGeometry": raw_snapshot["missingGeometry"]},
              "candidateCorrections": corrections,
              "sourceTopologyRepairs": repairs, "membershipCounts": membership, "ndlsa": ndlsa,
              "archivedTerritoryCoverage": baseline,
              "archivedOverlaps": geometry_overlaps(rus, "ADM0_A3"),
              "candidateOverlaps": geometry_overlaps(corrected_features, "LEKTRUS_ENTITY_ID")}
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    # Preserve real reference geometry for manual review, including the
    # neighbour context for landlocked microstates. Do not import names or
    # sovereignty from a different cartographic convention.
    candidates = {"FJI", "MDV", "MHL", "TUV", "KIR", "SYC", "FSM", "PLW", "TON", "NRU", "BHS", "ATG", "MCO", "VAT", "SMR", "SGP", "LIE"}
    context = {"FRA": box(6.9, 43.6, 7.7, 44.0), "ITA": box(12.2, 41.6, 12.8, 42.1).union(box(12.2, 43.7, 12.7, 44.2)),
               "AUT": box(9.3, 46.9, 9.8, 47.5), "CHE": box(9.3, 46.9, 9.8, 47.5), "MYS": box(103.4, 1.0, 104.5, 1.9), "IDN": box(103.4, 0.8, 104.5, 1.9)}
    review_features = []
    for f in corrected_features:
        code = f["properties"].get("ISO_A3")
        if code not in candidates and code not in context:
            continue
        geometry = antimeridian_safe(shape(f["geometry"]))
        if code in context:
            geometry = geometry.intersection(context[code])
        if geometry.is_empty:
            continue
        review_features.append({"type": "Feature", "geometry": mapping(geometry), "properties": {"iso": code, "edition": edition, "review": "candidate-only"}})
    out.with_name("boundary-candidates.geojson").write_text(json.dumps({"type": "FeatureCollection", "source": URL, "license": "CC BY 4.0", "features": review_features}))
    present = sum(row["referencePresent"] for row in rows)
    print(f"2026 independent boundary reference {edition}: {present}/195 country polygons available")
    assert present == 195, "reference unexpectedly incomplete"
    ranked = sorted((r for r in rows if r["russianViewVsReference"]), key=lambda r: r["russianViewVsReference"]["intersectionOverUnion"])
    for row in ranked[:25]:
        print(row["iso"], json.dumps(row["russianViewVsReference"]))
    print("Missing reference codes:", [r["iso"] for r in rows if not r["referencePresent"]])


if __name__ == "__main__":
    main()
