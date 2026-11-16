"""Compare actual 2022 Lektrus geometry with the current World Bank ADM0.

CC BY 4.0 reference: https://datacatalog.worldbank.org/search/dataset/0038272/world-bank-official-boundaries
Differences are review candidates, not automatic replacements of a worldview.
Run in CI with shapely and pyproj. Never change the production data here.
"""
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from pyproj import Transformer
from shapely import make_valid
from shapely.geometry import shape
from shapely.ops import transform, unary_union

URL = "https://services.arcgis.com/iQ1dY19aHwbSDYIF/arcgis/rest/services/World_Bank_Global_Administrative_Divisions/FeatureServer/1"
TRANSFORMER = Transformer.from_crs(4326, 6933, always_xy=True)


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


def projected(features):
    if not features:
        return None
    result = unary_union([make_valid(transform(TRANSFORMER.transform, shape(f["geometry"]))) for f in features])
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


def main():
    folder, out = map(pathlib.Path, sys.argv[1:3])
    roster_text = (pathlib.Path(__file__).parent / "atlas-2026-capitals.mjs").read_text()
    roster = re.findall(r"(?:`|\|)([A-Z]{3})=", roster_text)
    assert len(roster) == len(set(roster)) == 195
    meta = request({"f": "json"})
    stamp = meta.get("editingInfo", {}).get("dataLastEditDate") or meta.get("editingInfo", {}).get("lastEditDate")
    assert stamp, "reference data edition is not available"
    edition = datetime.fromtimestamp(stamp / 1000, timezone.utc).date().isoformat()
    assert edition.startswith("2026-"), f"reference must be dated 2026, got {edition}"
    # Fetch the actual polygons, not the ArcGIS tile imagery. Query batches to
    # avoid silent service transfer limits. Keep returned geometry precision.
    reference = []
    for start in range(0, len(roster), 10):
        codes = roster[start:start+10]
        where = "ISO_A3 IN (" + ",".join(f"'{c}'" for c in codes) + ")"
        response = request({"where": where, "outFields": "ISO_A3,NAM_0,WB_STATUS", "returnGeometry": "true",
                            "outSR": "4326", "f": "geojson"}, URL + "/query")
        assert response.get("type") == "FeatureCollection"
        reference.extend(response["features"])
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
                     "russianVsDefault2022": describe(current, neutral)})
    report = {"year": 2026, "source": URL, "edition": edition, "referenceLicense": "CC BY 4.0",
              "atlasEdition": "2022-06-02", "method": "EPSG:6933 area intersection; different coastline resolution and political conventions affect results",
              "reviewState": "geometry candidates, not historical acceptance", "countries": rows}
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    present = sum(row["referencePresent"] for row in rows)
    print(f"2026 independent boundary reference {edition}: {present}/195 country polygons available")
    assert present >= 180, "reference unexpectedly incomplete"
    ranked = sorted((r for r in rows if r["russianViewVsReference"]), key=lambda r: r["russianViewVsReference"]["intersectionOverUnion"])
    for row in ranked[:25]:
        print(row["iso"], json.dumps(row["russianViewVsReference"]))
    print("Missing reference codes:", [r["iso"] for r in rows if not r["referencePresent"]])


if __name__ == "__main__":
    main()
