"""Test the actual enclave correction and full-source download guard."""
import importlib.util
import json
import pathlib
import sys
from unittest.mock import patch

from shapely.geometry import box, mapping, shape

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
    print(json.dumps(rows, ensure_ascii=False))
print("2026 boundary tests: source coverage guards, independent enclave topology, no unrelated changes OK")
