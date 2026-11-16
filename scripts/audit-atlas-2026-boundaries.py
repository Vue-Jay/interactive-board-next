"""Compare actual 2022 Lektrus geometry with the current World Bank ADM0.

CC BY 4.0 reference: https://datacatalog.worldbank.org/search/dataset/0038272/world-bank-official-boundaries
Differences are review candidates, not automatic replacements of a worldview.
Run in CI with shapely and pyproj. Never change the production data here.
"""
import json
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


def main():
    folder, out = map(pathlib.Path, sys.argv[1:3])
    roster_text = (pathlib.Path(__file__).parent / "atlas-2026-capitals.mjs").read_text()
    roster = re.findall(r"(?:`|\|)([A-Z]{3})=", roster_text)
    assert len(roster) == len(set(roster)) == 195
    dateline = Polygon([(179, 0), (-179, 0), (-179, 1), (179, 1), (179, 0)])
    assert abs(antimeridian_safe(dateline).area - 2) < 1e-9
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
