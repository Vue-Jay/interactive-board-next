"""Audit the pinned December 2025 World Bank export as an independent atlas reference.

Usage: audit-atlas-2025-reference.py ADM0.geojson NDLSA.geojson OUTPUT_DIRECTORY
The edition is the archive publication date. The output is a candidate layer,
with provider boundaries and no inference of daily control or legal ownership.
"""

import hashlib
import importlib.util
import json
import pathlib
import re
import sys

from shapely.geometry import Point, shape


EDITION = "2025-12-02"
CATALOG = "https://source.coop/geographyis/wb-gad"
BASE = "https://data.source.coop/geographyis/wb-gad/"
SOURCES = {
    "ADM0": ("WB_GAD_ADM0.geojson", "0e88acdd3732a8261e9b6572599f1f6438c6963c13ffca9a25b9eaceee083bf3"),
    "NDLSA": ("WB_GAD_ADM0_NDLSA.geojson", "3ff2a1aead884d470d260720b7a62673c619cccebc66473614837ee5e7a57166"),
}
# The file publishes these particular roster entries in several separate
# records. Keep every original geometry and count each roster code once.
SPLIT_ROSTER = {"PRT": {124, 125, 126}, "UKR": {27, 53}, "ZWE": {78, 151}}
DUTCH_ISLANDS = {
    189: ("Saba (Neth.)", (-63.24056, 17.63028)),
    190: ("Sint Eustatius (Neth.)", (-62.97333, 17.485)),
    219: ("Bonaire (Neth.)", (-68.276, 12.151)),
}
ENCODED_LABELS = {
    26: ("TUR", "Türkiye"),
    114: ("ESP", "Peñón de Alhucaimas (Sp.)"),
    115: ("ESP", "Peñón de Vélez de la Gomera (Sp.)"),
    133: ("CIV", "Côte d'Ivoire"),
    159: ("STP", "São Tomé and Príncipe"),
    223: ("CUW", "Curaçao (Neth.)"),
}

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("atlas_boundaries", HERE / "audit-atlas-2026-boundaries.py")
boundaries = importlib.util.module_from_spec(spec)
spec.loader.exec_module(boundaries)


def correct_archive_labels(features):
    corrections = []
    for index, (name, point) in DUTCH_ISLANDS.items():
        feature = features[index]
        props = feature["properties"]
        assert props["ISO_A3"] == "BES" and props["NAM_0"] == "Bonaire, Sint Eustatius and Saba (Neth.)"
        assert shape(feature["geometry"]).covers(Point(point)), f"Wrong island at {index}"
        corrections.append({"index": index, "before": props["NAM_0"], "after": name})
        props["LEKTRUS_NAME"] = name
    for index, (code, name) in ENCODED_LABELS.items():
        props = features[index]["properties"]
        assert props["ISO_A3"] == code and props["NAM_0"] == name.encode("utf-8").decode("latin-1")
        corrections.append({"index": index, "before": props["NAM_0"], "after": name})
        props["LEKTRUS_NAME"] = name
    return corrections


def candidate(layer, source_file, roster):
    filename, expected_hash = SOURCES[layer]
    raw = source_file.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == expected_hash, f"{layer} archive checksum mismatch"
    archive = json.loads(raw)
    assert archive["type"] == "FeatureCollection"
    assert archive["crs"]["properties"]["name"] == "urn:ogc:def:crs:OGC:1.3:CRS84"
    features = archive["features"]
    assert all(f["geometry"] and f["geometry"]["type"] in ("Polygon", "MultiPolygon") for f in features)
    if layer == "NDLSA":
        assert all(f["properties"]["WB_STATUS"] == "Non-determined legal status area" for f in features)
    # This export omits service IDs. Archive ordinals are stable only for the
    # pinned bytes and must never be used to match records across editions.
    indexed = [{**feature, "id": index} for index, feature in enumerate(features)]
    normalized, repairs = boundaries.normalize_source_topology(indexed)
    reviewed = boundaries.annotate_reference_identity(normalized, [code for code in roster if code not in SPLIT_ROSTER], EDITION, layer)
    corrections = []
    if layer == "ADM0":
        for code, indices in SPLIT_ROSTER.items():
            matches = [f for f in reviewed if f["properties"]["ISO_A3"] == code and f["properties"]["WB_STATUS"] == "Member State"]
            assert {f["id"] for f in matches} == indices, f"Unreviewed roster split: {code}"
            for feature in matches:
                feature["properties"]["LEKTRUS_UN_ROSTER_STATUS"] = "un-member"
        corrections = correct_archive_labels(reviewed)
    assert len(reviewed) == len(features)
    return {
        "type": "FeatureCollection",
        "year": 2025,
        "edition": EDITION,
        "layer": layer,
        "source": BASE + filename,
        "catalog": CATALOG,
        "sourceSHA256": expected_hash,
        "license": "CC BY 4.0",
        "topologyRepairs": repairs,
        "labelCorrections": corrections,
        "notice": "Published administrative reference; application and historical acceptance pending. NDLSA is a separate layer.",
        "features": reviewed,
    }


def audit(adm0_file, ndlsa_file, output):
    roster = re.findall(r"(?:`|\|)([A-Z]{3})=", (HERE / "atlas-2026-capitals.mjs").read_text())
    assert len(roster) == len(set(roster)) == 195
    output.mkdir(parents=True, exist_ok=True)
    report = {"edition": EDITION, "catalog": CATALOG, "status": "independent-reference-candidate", "layers": {}}
    for layer, path in (("ADM0", adm0_file), ("NDLSA", ndlsa_file)):
        snapshot = candidate(layer, path, roster)
        features = snapshot["features"]
        by_status = {status: [f["properties"] for f in features if f["properties"]["LEKTRUS_UN_ROSTER_STATUS"] == status]
                     for status in ("un-member", "non-member-observer", "outside-roster")}
        members = {p["ISO_A3"] for p in by_status["un-member"]}
        observers = {p["ISO_A3"] for p in by_status["non-member-observer"]}
        assert members == (set(roster) - {"PSE", "VAT"} if layer == "ADM0" else set())
        assert observers == ({"PSE", "VAT"} if layer == "ADM0" else set())
        coverage_gaps = []
        if layer == "ADM0" and all(f["properties"]["ISO_A3"] != "BLM" for f in features):
            coverage_gaps.append({"iso": "BLM", "name": "Saint Barthélemy", "reason": "Separate territory absent from the pinned source",
                                  "source": "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000465963"})
        overlaps = boundaries.geometry_overlaps(features, "LEKTRUS_ENTITY_ID")
        data = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")).encode()
        name = f"world-2025-{layer.lower()}-candidate.geojson"
        (output / name).write_bytes(data)
        report["layers"][layer] = {"file": name, "source": snapshot["source"], "sourceSHA256": snapshot["sourceSHA256"],
                                  "candidateSHA256": hashlib.sha256(data).hexdigest(), "features": len(features),
                                  "membershipCounts": {"members": len(members), "observers": len(observers),
                                                       "outsideRosterFeatures": len(by_status["outside-roster"])},
                                  "topologyRepairs": snapshot["topologyRepairs"], "labelCorrections": snapshot["labelCorrections"],
                                  "unresolvedOverlaps": overlaps, "coverageGaps": coverage_gaps}
        print(f"{layer} {EDITION}: {len(features)} records, {len(overlaps)} positive-area overlaps above 0.001 km²", flush=True)
    (output / "2025-reference-audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    assert len(sys.argv) == 4, __doc__
    audit(*map(pathlib.Path, sys.argv[1:]))
