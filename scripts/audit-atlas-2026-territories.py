"""Compare all separate WB NDLSA features and unresolved archived territories.

Geometry intersections are evidence of geographic coverage, never evidence
of sovereignty. No source files or production data are modified.
"""
import hashlib
import importlib.util
import json
import pathlib
import re
import sys

from shapely import make_valid
from shapely.geometry import shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

spec = importlib.util.spec_from_file_location("boundaries", pathlib.Path(__file__).with_name("audit-atlas-2026-boundaries.py"))
boundaries = importlib.util.module_from_spec(spec)
spec.loader.exec_module(boundaries)

# Exact crosswalks with the named NDLSA layer, not sovereign ADM0 aliases.
NDLSA_NAMES = {"SAH": "Western Sahara", "IOT": "British Indian Ocean Territory",
               "SGS": "South Georgia and South Sandwich Islands", "FLK": "Falkland Islands"}
ARCHIVE_GROUPS = {"IOA": ["Christmas Island (Aus.)", "Cocos (Keeling) Islands (Aus.)"]}
# Archive codes are source-specific; labels identify geographic objects and
# deliberately do not assign sovereignty or extend archival area to 2026.
ARCHIVE_IDENTITIES = {"B38": "Nagorno-Karabakh archive", "C03": "Luhansk archive sector",
                      "C02": "Donetsk archive sector", "-99": "Southern Patagonian Ice Field",
                      "B92": "Rincon de Artigas archive sector", "PFA": "Paracel Islands",
                      "DEN": "Hans Island / Tartupaluk", "KOD": "Liancourt Rocks"}
# Compare like geographical coverage; unions are diagnostic only, not legal
# sovereignty assignments. Some providers split the same geographical area.
SCOPE_COMPARISONS = {
    "FRA": (["FRA"], ["FRA", "GUF"], "https://www.insee.fr/fr/metadonnees/definition/c2316"),
    "NOR": (["NOR"], ["NOR", "SJM"], "https://www.ssb.no/en/natur-og-miljo/areal/statistikk/areal-av-land-og-ferskvatn"),
    "SRB": (["SRB"], ["SRB", "XKX"], "https://digitallibrary.un.org/record/274488?ln=en"),
    "GEO": (["GEO", "B35", "B37"], ["GEO"], "https://mandates.un.org/mandate/A/RES/80/264"),
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def geometry(feature, normalized=False):
    geom = shape(feature["geometry"])
    if not normalized:
        geom = boundaries.antimeridian_safe(geom)
    return make_valid(transform(boundaries.TRANSFORMER.transform, geom))


def identity(feature, index):
    p = feature["properties"]
    archive_code = p.get("ADM0_A3_RU")
    code = (str(p.get("ISO_A3") or "").strip() or None) if p.get("LEKTRUS_ENTITY_ID") else (p.get("ADM0_A3") or archive_code)
    return {"index": index, "id": p.get("LEKTRUS_ENTITY_ID"), "code": code,
            "name": p.get("LEKTRUS_NAME") or p.get("NAME") or ARCHIVE_IDENTITIES.get(archive_code)}


class SpatialIndex:
    def __init__(self, features, normalized=False):
        self.features = features
        self.geometry = [geometry(f, normalized) for f in features]
        self.tree = STRtree(self.geometry)

    def overlaps(self, target):
        result = []
        for j in self.tree.query(target, predicate="intersects"):
            other = self.geometry[j]
            overlap = target.intersection(other).area
            if overlap <= 1000:
                continue
            result.append({**identity(self.features[j], int(j)), "overlapKm2": round(overlap / 1e6, 6),
                           "fractionOfTarget": round(overlap / target.area, 7),
                           "fractionOfOther": round(overlap / other.area, 7)})
        return sorted(result, key=lambda r: (-r["overlapKm2"], r["index"]))


def audit(folder, archive_path, report_path):
    comparison = json.loads((folder / "boundary-comparison.json").read_text())
    adm_path = folder / "world-2026-candidate.geojson"
    ndlsa_path = folder / "world-2026-ndlsa-candidate.geojson"
    assert digest(adm_path) == comparison["sourceSnapshot"]["sha256"], "ADM0 checksum mismatch"
    assert digest(ndlsa_path) == comparison["ndlsa"]["candidateSHA256"], "NDLSA checksum mismatch"
    adm = json.loads(adm_path.read_text())
    ndlsa = json.loads(ndlsa_path.read_text())
    archive = json.loads(archive_path.read_text())["features"]
    assert adm["edition"] == ndlsa["edition"] == comparison["edition"]
    assert ndlsa["layer"] == "NDLSA" and len(archive) == len(comparison["archivedTerritoryCoverage"])
    assert len(ndlsa["features"]) == comparison["ndlsa"]["features"]
    assert all(f["properties"]["LEKTRUS_UN_ROSTER_STATUS"] == "outside-roster" for f in ndlsa["features"])
    adm_index = SpatialIndex(adm["features"], True)
    ndlsa_index = SpatialIndex(ndlsa["features"], True)
    archive_index = SpatialIndex(archive)
    rows = []
    for old in comparison["archivedTerritoryCoverage"]:
        if old["referenceCandidates"]:
            continue
        i = old["index"]
        code = old["archiveViewCode"]
        a = archive[i]
        assert boundaries.geometry_digest(a) == old["geometrySHA256"], "archive geometry identity changed"
        g = archive_index.geometry[i]
        nd_hits = ndlsa_index.overlaps(g)
        adm_hits = adm_index.overlaps(g)
        exact_nd = [h for h in nd_hits if h["name"] == NDLSA_NAMES.get(code)]
        group = [h for h in adm_hits if h["name"] in ARCHIVE_GROUPS.get(code, [])]
        assert code not in NDLSA_NAMES or len(exact_nd) == 1, f"missing named separate-layer match {code}"
        assert code not in ARCHIVE_GROUPS or len(group) == len(ARCHIVE_GROUPS[code]), f"incomplete grouped territory {code}"
        status = "separate-layer-candidate" if exact_nd else "split-administrative-candidate" if group else "spatial-context-only" if adm_hits or nd_hits else "no-overlap-in-reference"
        rows.append({"archiveIndex": i, "archiveCode": code, "archiveName": old["name"] or ARCHIVE_IDENTITIES.get(code),
                     "geometrySHA256": old["geometrySHA256"], "status": status, "namedNDLSACandidates": exact_nd,
                     "splitADMCandidates": group, "ADM0SpatialHits": adm_hits, "NDLSASpatialHits": nd_hits})
    zones = []
    for i, f in enumerate(ndlsa["features"]):
        g = ndlsa_index.geometry[i]
        zones.append({**identity(f, i), "areaKm2": round(g.area / 1e6, 6),
                      "archiveSpatialHits": archive_index.overlaps(g), "ADM0SpatialHits": adm_index.overlaps(g),
                      "review": "separate-layer-candidate-not-ownership"})
    scopes = {}
    by_country = {r["iso"]: r for r in comparison["countries"]}
    for iso, (archive_codes, reference_codes, url) in SCOPE_COMPARISONS.items():
        old_parts = [archive_index.geometry[i] for i, f in enumerate(archive) if f["properties"].get("ADM0_A3") in archive_codes]
        ref_parts = [adm_index.geometry[i] for i, f in enumerate(adm["features"]) if f["properties"].get("ISO_A3") in reference_codes]
        assert len(old_parts) >= len(archive_codes) and len(ref_parts) >= len(reference_codes)
        scopes[iso] = {"archiveCodes": archive_codes, "referenceCodes": reference_codes, "source": url,
                       "originalIoU": by_country[iso]["russianViewVsReference"]["intersectionOverUnion"],
                       "comparableCoverage": boundaries.describe(unary_union(old_parts), unary_union(ref_parts)),
                       "status": "scope-diagnostic-not-sovereignty"}
    # Reuse the independently transcribed UN 2025 statistical reference, not
    # polygon area as a circular source. Water/scope/resolution can differ.
    stats_text = (pathlib.Path(__file__).parent.parent / "src/lektrusAtlasModernStats.ts").read_text()
    stats = {code: None if area == "-" else int(area) for code, area in re.findall(r"([A-Z]{3})=(?:\d+|~0),(\d+|-)", stats_text)}
    assert len(stats) == 195
    national = {code: float(area) for code, area in re.findall(r"\b([A-Z]{3}):\{areaKm2:([\d.]+),", stats_text)}
    diagnostics = []
    for row in comparison["countries"]:
        if "large-spatial-disagreement" not in row["flags"]:
            continue
        iso = row["iso"]
        area = national.get(iso, stats[iso])
        d = row["russianViewVsReference"]
        errors = {key: round(abs(d[key] - area) / area * 100, 3) for key in ["atlasKm2", "referenceKm2"]} if area else None
        diagnostics.append({"iso": iso, "statisticalAreaKm2": area, "areaReferenceKind": "national" if iso in national else "UN-2025",
                            "areaDifferencePercent": errors, "intersectionOverUnion": d["intersectionOverUnion"],
                            "scopeDiagnostic": scopes.get(iso), "review": "not-boundary-acceptance"})
    report = {"year": 2026, "edition": comparison["edition"], "sourceSHA256": {"ADM0": digest(adm_path), "NDLSA": digest(ndlsa_path), "archive": digest(archive_path)},
              "method": "EPSG:6933; intersection > 0.001 km2; spatial context does not establish formal sovereignty or current control",
              "unmatchedArchiveRecords": rows, "NDLSARecords": zones, "largeDisagreementDiagnostics": diagnostics,
              "statisticalSource": "https://unstats.un.org/UNSDWebsite/publications/pocketbook/world-stats-pocketbook-2025.pdf"}
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"NDLSA: {len(zones)} zones, {len(rows)} archive records reviewed spatially; {sum(r['status'] == 'separate-layer-candidate' for r in rows)} named separate-layer candidates; {sum(r['status'] == 'split-administrative-candidate' for r in rows)} split ADM0 candidates")
    return report


if __name__ == "__main__":
    assert len(sys.argv) == 4, "usage: ARTIFACT_FOLDER ARCHIVE_GEOJSON REPORT"
    audit(*map(pathlib.Path, sys.argv[1:]))
