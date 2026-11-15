"""Version-bound document deltas for native boards; the database stays authoritative."""
from collections import OrderedDict
import json
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


def apply_delta(document: dict, delta: dict) -> dict:
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

    def remember(self, board_id, version: int, delta: dict):
        encoded = encode(delta).encode("utf-8")
        size = len(encoded)
        if size > MAX_DELTA_BYTES:
            return
        key = (board_id, version)
        old = self.entries.pop(key, None)
        if old:
            self.size -= old[1]
        self.entries[key] = (encoded, size)
        self.size += size
        while self.size > MAX_HISTORY_BYTES or len(self.entries) > MAX_HISTORY_ENTRIES:
            _, (_, size) = self.entries.popitem(last=False)
            self.size -= size

    def chain(self, board_id, base: int, version: int):
        if base == version:
            return []
        if not 0 < version - base <= MAX_CHAIN:
            return None
        result, size = [], 0
        for revision in range(base + 1, version + 1):
            entry = self.entries.get((board_id, revision))
            if entry is None:
                return None
            encoded, length = entry
            size += length
            if size > MAX_DELTA_BYTES:
                return None
            result.append(json.loads(encoded))
        return result
