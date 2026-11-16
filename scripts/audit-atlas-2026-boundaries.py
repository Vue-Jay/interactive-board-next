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
from shapely import make_valid
from shapely.affinity import translate
from shapely.geometry import shape, Polygon, box, mapping
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

URL = "https://services.arcgis.com/iQ1dY19aHwbSDYIF/arcgis/rest/services/World_Bank_Global_Administrative_Divisions/FeatureServer/1"
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
        for k in range(math.floor((lo + 180) / 360), math.floor((hi + 180) / 360) + 1):
            segment = unwrapped.intersection(box(-180 + 360*k, -90, 180 + 360*k, 90))
            parts.extend(translate(g, xoff=-360*k) for g in polygon_parts(segment))
    return unary_union(parts)


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


def source_edition(meta):
    stamp = meta.get("editingInfo", {}).get("dataLastEditDate") or meta.get("editingInfo", {}).get("lastEditDate")
    assert stamp, "reference data edition is not available"
    return datetime.fromtimestamp(stamp / 1000, timezone.utc).date().isoformat()


def fetch_complete_reference(meta):
    """Fetch the full dated source, not only the UN roster. No World Bank
    administrative feature is promoted to independent state by this import."""
    oid_field = meta.get("objectIdField") or next(f["name"] for f in meta["fields"] if f["type"] == "esriFieldTypeOID")
    query = URL + "/query"
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
    assert source_edition(request({"f": "json"})) == source_edition(meta), "source changed during download"
    return features


def source_snapshot(reference, edition):
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
            "source": URL, "sourceLicense": "CC BY 4.0", "reviewStatus": "candidate-only",
            "notice": "World Bank administrative polygons, not certified sovereignty or exact legal boundaries; source edition is not a year-end state.",
            "missingGeometry": missing_geometry, "features": reference}


ENCLAVE_SOURCES = {
    "VAT": "https://www.vaticanstate.va/en/state-and-government/general-informations/geography.html",
    "SMR": "https://www.esteri.it/it/temi/aree_geografiche/europa/europa_meridionale_e_mediterranea/",
}


def normalize_known_enclaves(features, code_field="ISO_A3"):
    """Remove only proven independent enclaves from Italy's candidate polygon.

    The reference administrative layer actually overlaps both enclaves. Use
    its exact enclave polygons as holes, retaining their own geometry. Never
    generalize this operation to disputed territory or dependencies.
    """
    by_code = lambda code: [f for f in features if f["properties"].get(code_field) == code and f.get("geometry")]
    holes = {code: unary_union([make_valid(shape(f["geometry"])) for f in by_code(code)]) for code in ENCLAVE_SOURCES}
    assert all(not g.is_empty for g in holes.values()) and by_code("ITA"), "missing Italy or enclave geometry"
    original_italy = unary_union([make_valid(shape(f["geometry"])) for f in by_code("ITA")])
    report = []
    for code, hole in holes.items():
        before = transform(TRANSFORMER.transform, original_italy.intersection(hole)).area / 1e6
        report.append({"host": "ITA", "enclave": code, "overlapBeforeKm2": round(before, 6),
                       "source": ENCLAVE_SOURCES[code], "status": "candidate-topology-correction"})
    union = unary_union(list(holes.values()))
    corrected = []
    for f in features:
        if f["properties"].get(code_field) != "ITA" or not f.get("geometry"):
            corrected.append(f)
            continue
        geometry = make_valid(shape(f["geometry"]))
        if geometry.intersection(union).area > 0:
            result = unary_union(polygon_parts(geometry.difference(union)))
            assert not result.is_empty and result.is_valid
            corrected.append({**f, "geometry": mapping(result), "properties": {**f["properties"], "LEKTRUS_CORRECTION": "remove-VAT-and-SMR-overlaps"}})
        else:
            corrected.append(f)
    new_italy = unary_union([make_valid(shape(f["geometry"])) for f in corrected if f["properties"].get(code_field) == "ITA" and f.get("geometry")])
    for row in report:
        after = transform(TRANSFORMER.transform, new_italy.intersection(holes[row["enclave"]])).area / 1e6
        assert after < 1e-8, "Italian candidate still overlaps independent enclave"
        row["overlapAfterKm2"] = round(after, 6)
    return corrected, report


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
    data = [(key, projected(group)) for key, group in groups.items()]
    data = [(key, geom) for key, geom in data if geom is not None]
    geoms = [g for _, g in data]
    tree = STRtree(geoms)
    overlaps = []
    for i, (name, geometry) in enumerate(data):
        for j in tree.query(geometry):
            if j <= i:
                continue
            other = geoms[j]
            area = geometry.intersection(other).area
            if area <= 1000:  # 0.001 km²: exclude numerical slivers only
                continue
            overlaps.append({"entities": sorted([name, data[j][0]]), "overlapKm2": round(area / 1e6, 6),
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
    meta = request({"f": "json"})
    edition = source_edition(meta)
    assert edition.startswith("2026-"), f"reference must be dated 2026, got {edition}"
    # Fetch the actual polygons, not the ArcGIS tile imagery. Query batches to
    # avoid silent service transfer limits. Keep returned geometry precision.
    reference = fetch_complete_reference(meta)
    raw_snapshot = source_snapshot(reference, edition)
    raw_bytes = json.dumps(raw_snapshot, ensure_ascii=False, separators=(",", ":")).encode()
    out.with_name("world-2026-source.geojson").write_bytes(raw_bytes)
    corrected_features, corrections = normalize_known_enclaves(reference)
    snapshot = {**raw_snapshot, "features": corrected_features,
                "sourceSHA256": hashlib.sha256(raw_bytes).hexdigest(), "corrections": corrections}
    snapshot_bytes = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")).encode()
    out.with_name("world-2026-candidate.geojson").write_bytes(snapshot_bytes)
    rus = json.loads((folder / "ne_10m_admin_0_countries_rus.geojson").read_text())["features"]
    default = json.loads((folder / "ne_10m_admin_0_countries.geojson").read_text())["features"]
    rows = []
    for code in roster:
        adm = {"SSD": "SDS", "PSE": "PSX"}.get(code, code)
        ref = projected([f for f in reference if f["properties"].get("ISO_A3") == code and f.get("geometry")])
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
    baseline = [{"index": i, "code": f["properties"].get("ADM0_A3"), "name": f["properties"].get("NAME"),
                 "type": f["properties"].get("TYPE"), "sovCode": f["properties"].get("SOV_A3"),
                 "referenceCodePresent": {"SDS": "SSD", "PSX": "PSE"}.get(f["properties"].get("ADM0_A3"), f["properties"].get("ADM0_A3")) in reference_codes,
                 "review": "candidate-only"} for i, f in enumerate(rus)]
    report = {"year": 2026, "source": URL, "edition": edition, "referenceLicense": "CC BY 4.0",
              "atlasEdition": "2022-06-02", "method": "EPSG:6933 area intersection; different coastline resolution and political conventions affect results",
              "reviewState": "geometry candidates, not historical acceptance", "countries": classify_country_rows(rows),
              "sourceSnapshot": {"file": "world-2026-candidate.geojson", "sha256": hashlib.sha256(snapshot_bytes).hexdigest(),
                                 "rawFile": "world-2026-source.geojson", "rawSHA256": hashlib.sha256(raw_bytes).hexdigest(),
                                 "features": len(reference), "distinctSourceCodes": len(reference_codes), "missingGeometry": raw_snapshot["missingGeometry"]},
              "candidateCorrections": corrections,
              "archivedTerritoryCoverage": baseline,
              "archivedOverlaps": geometry_overlaps(rus, "ADM0_A3"),
              "candidateOverlaps": geometry_overlaps(corrected_features, "ISO_A3")}
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    # Preserve real reference geometry for manual review, including the
    # neighbour context for landlocked microstates. Do not import names or
    # sovereignty from a different cartographic convention.
    candidates = {"FJI", "MDV", "MHL", "TUV", "KIR", "SYC", "FSM", "PLW", "TON", "NRU", "BHS", "ATG", "MCO", "VAT", "SMR", "SGP", "LIE"}
    context = {"FRA": box(6.9, 43.6, 7.7, 44.0), "ITA": box(12.2, 41.6, 12.8, 42.1).union(box(12.2, 43.7, 12.7, 44.2)),
               "AUT": box(9.3, 46.9, 9.8, 47.5), "CHE": box(9.3, 46.9, 9.8, 47.5), "MYS": box(103.4, 1.0, 104.5, 1.9), "IDN": box(103.4, 0.8, 104.5, 1.9)}
    review_features = []
    for f in reference:
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
    assert present >= 180, "reference unexpectedly incomplete"
    ranked = sorted((r for r in rows if r["russianViewVsReference"]), key=lambda r: r["russianViewVsReference"]["intersectionOverUnion"])
    for row in ranked[:25]:
        print(row["iso"], json.dumps(row["russianViewVsReference"]))
    print("Missing reference codes:", [r["iso"] for r in rows if not r["referencePresent"]])


if __name__ == "__main__":
    main()
