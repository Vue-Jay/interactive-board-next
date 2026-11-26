"""Version-bound document deltas for native boards; the database stays authoritative."""
from collections import OrderedDict
import json
import math
from typing import Any

MAX_DELTA_BYTES = 1024 * 1024
MAX_HISTORY_BYTES = 8 * 1024 * 1024
MAX_HISTORY_ENTRIES = 256
MAX_CHAIN = 8


def encode(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def encoded_bytes(value: Any) -> int:
    return len(encode(value).encode("utf-8"))


def document_bytes_from_parts(metadata: dict, item_bytes: int, count: int) -> int:
    """Exact compact JSON size without serializing unchanged item bodies."""
    if "items" in metadata or item_bytes < 0 or count < 0:
        raise ValueError("Invalid document size summary")
    # Replacing the closing brace with ,\"items\":[...]}; an empty
    # metadata object has no preceding comma.
    return encoded_bytes(metadata) + len('"items":[]') + bool(metadata) + item_bytes + max(0, count - 1)


def item_map(items):
    if not isinstance(items, list) or any(
        not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]
        for item in items
    ):
        raise ValueError("Invalid document items")
    result = {item["id"]: item for item in items}
    if len(result) != len(items):
        raise ValueError("Duplicate document item ID")
    return result


def _number(value):
    try:
        return type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        return False


def _point(value):
    return isinstance(value, dict) and set(value) == {"x", "y"} and all(_number(v) for v in value.values())


def _cents(value):
    if not _number(value) or abs(value) > (2**53 - 1) / 100:
        raise ValueError("Invalid ink coordinate")
    scaled = value * 100
    result = round(scaled)
    if abs(scaled - result) > 0.00001:
        raise ValueError("Invalid ink precision")
    return result


def expand_point_edits(document, delta):
    """Translate compact, version-bound ink suffixes into ordinary upserts.

    Only a pre-existing permanent item/sticker stroke can be edited. All
    permission checks, normalized storage and revision history still run on
    the complete reconstructed object. A missing/erased stroke cannot revive.
    """
    changes = delta.get("items")
    if not isinstance(changes, dict) or "point_edits" not in changes:
        return delta
    edits = changes["point_edits"]
    if set(changes) != {"point_edits"} or not isinstance(edits, list) or len(edits) != 1:
        raise ValueError("Ambiguous point edit")
    edit = edits[0]
    if not isinstance(edit, dict) or set(edit) - {"id", "stroke_id", "count", "keep", "points", "geometry"}:
        raise ValueError("Invalid point edit")
    key, count, keep, tail = (edit.get(k) for k in ("id", "count", "keep", "points"))
    if not isinstance(key, str) or type(count) is not int or type(keep) is not int or not 1 <= keep <= count:
        raise ValueError("Invalid point offset")
    if not isinstance(tail, list) or not all(map(_point, tail)):
        raise ValueError("Invalid points")
    old = item_map(document.get("items")).get(key)
    if old is None:
        raise ValueError("Missing ink item")
    attached = None
    if "stroke_id" in edit:
        stroke_id = edit["stroke_id"]
        if not isinstance(stroke_id, str) or old.get("kind") != "sticky" or "geometry" in edit:
            raise ValueError("Invalid sticker edit")
        attached = item_map(old.get("stickerInk"))
        stroke = attached.get(stroke_id)
        if stroke is None:
            raise ValueError("Missing sticker ink")
        geometry = {}
    else:
        stroke = old
        geometry = edit.get("geometry")
        if not isinstance(geometry, dict) or set(geometry) != {"x", "y", "width", "height"} or not all(map(_number, geometry.values())):
            raise ValueError("Invalid ink geometry")
        if geometry["width"] <= 0 or geometry["height"] <= 0:
            raise ValueError("Invalid ink dimensions")
    points = stroke.get("points")
    if stroke.get("kind") not in ("pen", "marker") or not isinstance(points, list) or len(points) != count or not all(map(_point, points)):
        raise ValueError("Missing or changed ink base")
    prefix = points[:keep]
    if geometry:
        dx = _cents(stroke.get("x")) - _cents(geometry["x"])
        dy = _cents(stroke.get("y")) - _cents(geometry["y"])
        if dx or dy:
            prefix = [{"x": (_cents(p["x"]) + dx) / 100, "y": (_cents(p["y"]) + dy) / 100} for p in prefix]
    updated = {**stroke, **geometry, "points": prefix + tail}
    if attached is not None:
        attached[edit["stroke_id"]] = updated
        updated = {**old, "stickerInk": list(attached.values())}
    return {**delta, "items": {"upsert": [updated]}}


def apply_delta(document: dict, delta: dict) -> dict:
    delta = expand_point_edits(document, delta)
    if document.get("version") != 1 or document.get("pilot_schema") is not None:
        raise ValueError("Not a native document")
    if set(delta) - {"set", "remove", "items"}:
        raise ValueError("Unknown delta field")
    fields, removed = delta.get("set", {}), delta.get("remove", [])
    if not isinstance(fields, dict) or not isinstance(removed, list) or any(
        not isinstance(key, str) for key in removed
    ):
        raise ValueError("Invalid document fields")
    if ({"items", "__proto__", "constructor", "prototype", "pilot_schema", "version"}
            & (set(fields) | set(removed))) or set(fields) & set(removed):
        raise ValueError("Reserved or ambiguous delta field")
    result = {key: value for key, value in document.items() if key not in removed}
    result.update(fields)
    if "items" not in delta:
        return result
    changes = delta["items"]
    if not isinstance(changes, dict) or set(changes) - {"upsert", "remove", "order"}:
        raise ValueError("Invalid item delta")
    existing = item_map(document.get("items"))
    upserts = item_map(changes.get("upsert", []))
    deletes = changes.get("remove", [])
    if not isinstance(deletes, list) or any(not isinstance(key, str) for key in deletes):
        raise ValueError("Invalid item removals")
    if len(set(deletes)) != len(deletes) or set(deletes) & set(upserts) or not set(deletes) <= existing.keys():
        raise ValueError("Ambiguous item removals")
    for key in deletes:
        del existing[key]
    existing.update(upserts)
    order = changes.get("order", list(existing))
    if not isinstance(order, list) or any(not isinstance(key, str) for key in order) or (
        len(order) != len(existing) or set(order) != existing.keys()
    ):
        raise ValueError("Invalid item order")
    result["items"] = [existing[key] for key in order]
    return result


class DeltaHistory:
    """Small, optional in-memory cache. A miss always falls back to PostgreSQL."""
    def __init__(self):
        self.entries = OrderedDict()
        self.size = 0

    def remember(self, board_id, version: int, delta: dict, wire_delta: dict | None = None):
        encoded = encode(delta).encode("utf-8")
        compact = encode(wire_delta).encode("utf-8") if wire_delta is not None else None
        if len(encoded) > MAX_DELTA_BYTES:
            encoded = None
        if compact is not None and len(compact) > MAX_DELTA_BYTES:
            compact = None
        if encoded is None and compact is None:
            return
        size = len(encoded or b"") + len(compact or b"")
        key = (board_id, version)
        old = self.entries.pop(key, None)
        if old:
            self.size -= old[2]
        self.entries[key] = (encoded, compact, size)
        self.size += size
        while self.size > MAX_HISTORY_BYTES or len(self.entries) > MAX_HISTORY_ENTRIES:
            _, (_, _, size) = self.entries.popitem(last=False)
            self.size -= size

    def chain(self, board_id, base: int, version: int, point_deltas: bool = False):
        if base == version:
            return []
        if not 0 < version - base <= MAX_CHAIN:
            return None
        result, size = [], 0
        for revision in range(base + 1, version + 1):
            entry = self.entries.get((board_id, revision))
            if entry is None:
                return None
            legacy, compact, _ = entry
            encoded = compact if point_deltas and compact is not None else legacy
            if encoded is None:
                return None
            size += len(encoded)
            if size > MAX_DELTA_BYTES:
                return None
            result.append(json.loads(encoded))
        return result
