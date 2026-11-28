"""Test the actual enclave correction and full-source download guard."""
import importlib.util
import json
import pathlib
import sys
from unittest.mock import patch

from shapely.geometry import box, mapping, shape, MultiPolygon, Polygon
from shapely.ops import unary_union

spec = importlib.util.spec_from_file_location("boundary", pathlib.Path(__file__).with_name("audit-atlas-2026-boundaries.py"))
boundary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(boundary)


def feature(code, geometry, oid=0, field="ISO_A3"):
    return {"type": "Feature", "properties": {field: code, "OBJECTID": oid}, "geometry": mapping(geometry)}


fixture = [feature("ITA", box(0, 0, 10, 10), 1), feature("VAT", box(1, 1, 2, 2), 2),
           feature("SMR", box(3, 3, 4, 4), 3), feature("OTHER", box(2, 2, 9, 9), 4)]
corrected, rows = boundary.normalize_known_enclaves(fixture)
assert shape(corrected[0]["geometry"]).area == 98
assert corrected[1:] == fixture[1:], "do not modify enclave or unrelated disputed features"
assert all(r["overlapBeforeKm2"] > 0 and r["overlapAfterKm2"] == 0 for r in rows)
again, rows = boundary.normalize_known_enclaves(corrected)
assert again == corrected and all(r["overlapBeforeKm2"] == 0 for r in rows)
overlap_pairs = {tuple(r["entities"]) for r in boundary.geometry_overlaps(corrected, "ISO_A3")}
assert ("ITA", "VAT") not in overlap_pairs and ("ITA", "SMR") not in overlap_pairs
assert ("ITA", "OTHER") in overlap_pairs, "unreviewed overlapping entity must remain visible as a review issue"
# The real provider encodes holes as nested shells, not interior rings.
outer, inner = box(0, 0, 10, 10), box(2, 2, 3, 3)
nested = MultiPolygon([outer, inner])
assert not nested.is_valid
fixed = boundary.antimeridian_safe(nested)
assert fixed.is_valid and fixed.area == 99 and fixed.intersection(inner).area == 0
island = box(2.2, 2.2, 2.8, 2.8)
deep = boundary.antimeridian_safe(MultiPolygon([outer, inner, island]))
assert deep.is_valid and abs(deep.area - 99.36) < 1e-9 and deep.covers(island)
assert boundary.projected([feature("ZAF", nested)]).intersection(boundary.projected([feature("LSO", inner)])).area == 0
africa, africa_rows = boundary.normalize_known_enclaves([feature("ZAF", outer), feature("LSO", inner)])
assert africa_rows[0]["enclave"] == "LSO" and africa_rows[0]["overlapAfterKm2"] == 0
assert shape(africa[0]["geometry"]).area == 99
crossing = Polygon([(179,0),(-179,0),(-179,1),(179,1),(179,0)])
assert boundary.antimeridian_safe(crossing).area == 2
identity = [{"type":"Feature", "geometry":mapping(outer), "properties":{"FID":i,"ISO_A3":code,"WB_STATUS":status,"NAM_0":name}}
            for i,code,status,name in [(1,"JPN","Other","Japan"),(2,"ESP","Member State","Spain"),
            (3,"ESP","Territory","Ceuta"),(4,"PSE","Territory","Palestine"),(5,"GUF","Territory","France")]]
annotated = boundary.annotate_reference_identity(identity, ["JPN","ESP","PSE"], "2026-08-28")
assert [f["properties"]["LEKTRUS_UN_ROSTER_STATUS"] for f in annotated] == ["un-member","un-member","outside-roster","non-member-observer","outside-roster"]
assert annotated[-1]["properties"]["LEKTRUS_NAME"] == "French Guiana" and annotated[-1]["properties"]["NAM_0"] == "France"
assert len({f["properties"]["LEKTRUS_ENTITY_ID"] for f in annotated}) == len(identity)
gaps = boundary.component_gaps(unary_union([box(0, 0, 1000, 1000), box(2000, 2000, 3000, 3000)]), box(0, 0, 1000, 1000))
assert gaps["atlasOnly"]["disconnectedCount"] == 1 and gaps["atlasOnly"]["disconnectedKm2"] == 1

meta = {"objectIdField": "OBJECTID", "editingInfo": {"lastEditDate": 1787918400000}}


def response(params, endpoint=None):
    if params.get("returnIdsOnly"):
        return {"objectIds": [4, 2, 1, 3]}
    if "objectIds" in params:
        return {"type": "FeatureCollection", "features": fixture}
    return meta


with patch.object(boundary, "request", side_effect=response):
    assert boundary.fetch_complete_reference(meta) == fixture
assert boundary.source_snapshot(fixture + [{"type":"Feature","properties":{},"geometry":None}], "2026-08-28")["missingGeometry"] == 1
with patch.object(boundary, "request", side_effect=lambda p, e=None: {"objectIds": [1, 2]} if p.get("returnIdsOnly") else {"type": "FeatureCollection", "features": fixture[:1]}):
    try:
        boundary.fetch_complete_reference(meta)
    except AssertionError:
        pass
    else:
        raise AssertionError("truncated query accepted")

if len(sys.argv) > 1:
    # Real World Bank candidate geometry, including clipped neighbouring
    # countries. Same algorithm used by the full 2026 source compilation.
    data = json.loads(pathlib.Path(sys.argv[1]).read_text())
    corrected, rows = boundary.normalize_known_enclaves(data["features"], "iso")
    assert len(corrected) == len(data["features"])
    assert all(r["overlapAfterKm2"] == 0 for r in rows)
    assert not any(r["entities"] in (["ITA", "VAT"], ["ITA", "SMR"]) for r in boundary.geometry_overlaps(corrected, "iso"))
    print(json.dumps(rows, ensure_ascii=False))
print("2026 boundary tests: source coverage guards, independent enclave topology, no unrelated changes OK")
