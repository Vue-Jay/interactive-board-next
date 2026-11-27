"""Strict, bounded transient events for the native Lektrus collaboration channel.

Events are visual hints, never durable document writes. Identity and permissions
are always assigned by the server from the authenticated board membership.
"""
from __future__ import annotations

import math
import re
import time
from collections import deque
from typing import Any

MAX_EVENT_BYTES = 128_000
MAX_INK_POINTS = 200
MAX_CLIENT_ID = 96
MAX_STROKE_ID = 128
MAX_XY = 10_000_000
MAX_OFFSET = 1_000_000
MAX_EDITOR_OPS = 300
MAX_EDITOR_DEPTH = 18
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")
MUTATION_ID_RE = re.compile(r"^[A-Za-z0-9:_-]{1,180}$")
FORBIDDEN_KEYS = {"__proto__", "prototype", "constructor"}


class InvalidLiveEvent(ValueError):
    pass


def finite_position(value: Any) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and abs(value) <= MAX_XY


def _identifier(value: Any, maximum: int = 128) -> bool:
    return isinstance(value, str) and 1 <= len(value) <= maximum and bool(ID_RE.fullmatch(value))


def _safe_json(value: Any, depth: int = 0) -> bool:
    if depth > 24:
        return False
    if value is None or type(value) in (str, bool, int):
        return not isinstance(value, str) or len(value) <= 100_000
    if type(value) is float:
        return math.isfinite(value)
    if isinstance(value, list):
        return len(value) <= 10_000 and all(_safe_json(item, depth + 1) for item in value)
    if isinstance(value, dict):
        return len(value) <= 2_000 and all(
            isinstance(key, str) and key not in FORBIDDEN_KEYS and len(key) <= 128
            and _safe_json(item, depth + 1)
            for key, item in value.items()
        )
    return False


def _view_numbers(frame: dict[str, Any]) -> tuple[float, float, float]:
    x, y, zoom = frame.get("center_x"), frame.get("center_y"), frame.get("zoom")
    if not finite_position(x) or not finite_position(y):
        raise InvalidLiveEvent("invalid_coordinates")
    if type(zoom) not in (int, float) or not math.isfinite(zoom) or not 0.1 <= zoom <= 4:
        raise InvalidLiveEvent("invalid_zoom")
    return x, y, zoom


def _motion_points(points: Any, *, allow_empty: bool = False) -> bool:
    return isinstance(points, list) and (0 if allow_empty else 1) <= len(points) <= 5000 and all(
        isinstance(p, dict) and set(p) == {"x","y"} and finite_position(p["x"]) and finite_position(p["y"]) for p in points)


def _motion_style(value: dict, *, sticker: bool = False) -> bool:
    weight = value.get("weight")
    return (value.get("kind") in ("pen","marker") and _identifier(value.get("id"), MAX_STROKE_ID)
            and isinstance(value.get("color"),str) and COLOR_RE.fullmatch(value["color"]) is not None
            and type(weight) in (int,float) and math.isfinite(weight) and 0 < weight <= (1000 if sticker else 60)
            and _motion_points(value.get("points")))


def _motion_shape(value: Any, key: str, user_id: str) -> bool:
    if value is None:
        return True
    if not isinstance(value,dict) or value.get("id") != key:
        return False
    kind = value.get("kind")
    if kind == "sticky":
        strokes = value.get("stickerInk")
        return (set(value)=={"kind","id","stickerInk"} and isinstance(strokes,list) and len(strokes)<=256
                and all(isinstance(s,dict) and set(s)=={"id","kind","color","weight","points"} and _motion_style(s,sticker=True) for s in strokes)
                and len({s["id"] for s in strokes})==len(strokes))
    geometry = all(finite_position(value.get(k)) for k in ("x","y","width","height"))
    if not geometry or value["width"]<=0 or value["height"]<=0:
        return False
    if kind == "tail":
        return (set(value)=={"kind","id","count","keep","from_x","from_y","x","y","width","height","points"}
                and type(value["count"]) is int and type(value["keep"]) is int
                and 1<=value["keep"]<=value["count"]<=5000 and finite_position(value["from_x"]) and finite_position(value["from_y"])
                and _motion_points(value["points"],allow_empty=True) and value["keep"]+len(value["points"])<=5000)
    return (set(value)<={"kind","id","x","y","width","height","color","weight","points","rotation","hidden","locked","createdBy","groupId"}
            and _motion_style(value) and ("rotation" not in value or finite_position(value["rotation"]))
            and all(k not in value or type(value[k]) is bool for k in ("hidden","locked"))
            and ("createdBy" not in value or _identifier(value["createdBy"]))
            and ("groupId" not in value or _identifier(value["groupId"])))


def validate_live_event(frame: Any, *, role: str, user_id: str,
                        name: str) -> dict[str, Any]:
    """Validate one client event and attach trusted identity fields."""
    if not isinstance(frame, dict):
        raise InvalidLiveEvent("invalid_frame")
    kind = frame.get("type")
    identity = {"user_id": user_id, "name": name[:100], "role": role}

    if kind == "cursor":
        if set(frame) != {"type", "x", "y", "client_id"}:
            raise InvalidLiveEvent("invalid_cursor_fields")
        x, y, client_id = frame["x"], frame["y"], frame["client_id"]
        if not finite_position(x) or not finite_position(y):
            raise InvalidLiveEvent("invalid_coordinates")
        if not _identifier(client_id, MAX_CLIENT_ID):
            raise InvalidLiveEvent("invalid_client")
        return {"type": "cursor", **identity, "client_id": client_id,
                "x": x, "y": y, "sent_at": int(time.time() * 1000)}

    if kind in ("ink_motion","ink_motion_ack"):
        if role not in ("owner","editor"):
            raise InvalidLiveEvent("read_only")
        if not _identifier(frame.get("client_id"),MAX_CLIENT_ID) or type(frame.get("seq")) is not int or not 1<=frame["seq"]<=2**31-1:
            raise InvalidLiveEvent("invalid_ink_motion_identity")
        if kind == "ink_motion_ack":
            if set(frame)!={"type","client_id","seq","version"} or type(frame.get("version")) is not int or not 1<=frame["version"]<=2**53-1:
                raise InvalidLiveEvent("invalid_ink_motion_ack")
        else:
            required={"type","client_id","seq","gesture","base_version","x","y","changes"}
            gesture=frame.get("gesture")
            if (set(frame)!=required or not isinstance(gesture,str) or not MUTATION_ID_RE.fullmatch(gesture)
                or type(frame.get("base_version")) is not int or not 0<=frame["base_version"]<=2**53-1
                or not finite_position(frame["x"]) or not finite_position(frame["y"])):
                raise InvalidLiveEvent("invalid_ink_motion")
            changes=frame["changes"]
            if not isinstance(changes,list) or not 1<=len(changes)<=256:
                raise InvalidLiveEvent("invalid_ink_motion_changes")
            ids=set()
            for change in changes:
                if (not isinstance(change,dict) or set(change)!={"id","index","seq","value"}
                    or not _identifier(change["id"],MAX_STROKE_ID) or change["id"] in ids
                    or type(change["index"]) is not int or not 0<=change["index"]<=10000
                    or type(change["seq"]) is not int or not 1<=change["seq"]<=frame["seq"]
                    or not _motion_shape(change["value"],change["id"],user_id)):
                    raise InvalidLiveEvent("invalid_ink_motion_change")
                ids.add(change["id"])
            # Actual durable writes still undergo the complete version, item,
            # author, student-policy, quota and session checks. This packet is
            # a strictly bounded render update and cannot write the database.
        return {**frame,**identity,"sent_at":int(time.time()*1000)}

    if kind == "object_preview":
        if role not in ("owner", "editor"):
            raise InvalidLiveEvent("read_only")
        required = {"type", "client_id", "object_id", "gesture_id",
                    "seq", "object_revision", "x", "y"}
        if set(frame) != required:
            raise InvalidLiveEvent("invalid_object_fields")
        client_id, object_id, gesture_id = (
            frame["client_id"], frame["object_id"], frame["gesture_id"]
        )
        if not all(_identifier(value) for value in (client_id, object_id, gesture_id)):
            raise InvalidLiveEvent("invalid_object_identity")
        seq, revision = frame["seq"], frame["object_revision"]
        if (type(seq) is not int or not 0 <= seq <= 1_000_000 or
                type(revision) is not int or not 1 <= revision <= 1_000_000):
            raise InvalidLiveEvent("invalid_object_revision")
        if (not finite_position(frame["x"]) or not finite_position(frame["y"]) or
                not 0 <= frame["x"] <= 1000 or not 0 <= frame["y"] <= 1000):
            raise InvalidLiveEvent("invalid_coordinates")
        return {"type": kind, **identity, "client_id": client_id,
                "object_id": object_id, "gesture_id": gesture_id,
                "seq": seq, "object_revision": revision, "x": frame["x"],
                "y": frame["y"], "sent_at": int(time.time() * 1000)}

    if kind in ("live_ink", "live_erase"):
        if role not in ("owner", "editor"):
            raise InvalidLiveEvent("read_only")
        required = {"type", "client_id", "stroke_id", "kind", "color",
                    "weight", "offset", "points", "finished"}
        if kind == "live_erase":
            required.update(("cancelled", "cut_ids"))
            if "erase_mode" in frame:
                required.add("erase_mode")
                if frame["erase_mode"] not in ("partial", "stroke"):
                    raise InvalidLiveEvent("invalid_erase_mode")
        if set(frame) != required:
            raise InvalidLiveEvent("invalid_ink_fields")
        client_id, stroke_id = frame["client_id"], frame["stroke_id"]
        if not _identifier(client_id, MAX_CLIENT_ID) or not _identifier(stroke_id, MAX_STROKE_ID):
            raise InvalidLiveEvent("invalid_client_or_stroke")
        tool, color, weight = frame["kind"], frame["color"], frame["weight"]
        if tool not in (("eraser",) if kind == "live_erase" else ("pen", "marker")) or not isinstance(color, str) or not COLOR_RE.fullmatch(color):
            raise InvalidLiveEvent("invalid_tool")
        if type(weight) not in (int, float) or not math.isfinite(weight) or not 0.5 <= weight <= (1000 if kind == "live_erase" else 60):
            raise InvalidLiveEvent("invalid_weight")
        offset, finished, points = frame["offset"], frame["finished"], frame["points"]
        if type(offset) is not int or not 0 <= offset <= MAX_OFFSET or type(finished) is not bool:
            raise InvalidLiveEvent("invalid_offset_or_finished")
        if not isinstance(points, list) or not 1 <= len(points) <= MAX_INK_POINTS:
            raise InvalidLiveEvent("invalid_points_count")
        validated = []
        for point in points:
            if isinstance(point, dict) and set(point) == {"x", "y"}:
                x, y = point["x"], point["y"]
            elif isinstance(point, list) and len(point) == 2:
                x, y = point
            else:
                raise InvalidLiveEvent("invalid_points")
            if not finite_position(x) or not finite_position(y):
                raise InvalidLiveEvent("invalid_points")
            validated.append({"x": x, "y": y})
        if offset + len(points) > MAX_OFFSET:
            raise InvalidLiveEvent("invalid_points_offset")
        if kind == "live_erase" and (type(frame["cancelled"]) is not bool or (frame["cancelled"] and not finished)):
            raise InvalidLiveEvent("invalid_erase_cancel")
        if kind == "live_erase":
            cut_ids = frame["cut_ids"]
            if (not isinstance(cut_ids, list) or len(cut_ids) > 500 or
                    any(not _identifier(value, MAX_STROKE_ID) for value in cut_ids) or
                    (cut_ids and (not finished or frame["cancelled"]))):
                raise InvalidLiveEvent("invalid_erase_targets")
        return {"type": kind, **identity, "client_id": client_id,
                "stroke_id": stroke_id, "kind": tool, "color": color,
                "weight": weight, "offset": offset, "points": validated,
                **({"cancelled": frame["cancelled"], "cut_ids": frame["cut_ids"]} if kind == "live_erase" else {}),
                **({"erase_mode": frame["erase_mode"]} if kind == "live_erase" and "erase_mode" in frame else {}),
                "finished": finished, "sent_at": int(time.time() * 1000)}

    if kind == "work_state":
        if set(frame) != {"type", "selected_ids", "editing_id"}:
            raise InvalidLiveEvent("invalid_work_state_fields")
        selected = frame["selected_ids"]
        editing = frame["editing_id"]
        if (not isinstance(selected, list) or len(selected) > 100 or
                any(not _identifier(value) for value in selected) or
                len(set(selected)) != len(selected)):
            raise InvalidLiveEvent("invalid_selection")
        if editing is not None and not _identifier(editing):
            raise InvalidLiveEvent("invalid_editing_id")
        return {"type": kind, **identity, "selected_ids": selected,
                "editing_id": editing, "sent_at": int(time.time() * 1000)}

    if kind == "editor_mutation":
        if role not in ("owner", "editor"):
            raise InvalidLiveEvent("read_only")
        required = {"type", "id", "item_id", "client_id", "ops"}
        if not required.issubset(frame) or set(frame) - required - {"base_version"}:
            raise InvalidLiveEvent("invalid_editor_mutation_fields")
        base_version = frame.get("base_version")
        if "base_version" in frame and (type(base_version) is not int or not 0 <= base_version <= 9007199254740991):
            raise InvalidLiveEvent("invalid_editor_base_version")
        mutation_id, item_id, client_id, ops = (
            frame["id"], frame["item_id"], frame["client_id"], frame["ops"]
        )
        if (not isinstance(mutation_id, str) or not MUTATION_ID_RE.fullmatch(mutation_id) or
                not _identifier(item_id) or not _identifier(client_id, MAX_CLIENT_ID)):
            raise InvalidLiveEvent("invalid_editor_mutation_identity")
        if not isinstance(ops, list) or not 1 <= len(ops) <= MAX_EDITOR_OPS:
            raise InvalidLiveEvent("invalid_editor_ops")
        validated_ops = []
        allowed_kinds = {"set", "remove", "append", "upsert-id", "remove-id"}
        for op in ops:
            if not isinstance(op, dict):
                raise InvalidLiveEvent("invalid_editor_op")
            op_kind, path = op.get("kind"), op.get("path")
            if (op_kind not in allowed_kinds or not isinstance(path, list) or
                    len(path) > MAX_EDITOR_DEPTH or
                    any((type(part) is int and not 0 <= part <= 100_000) or
                        (isinstance(part, str) and (not part or len(part) > 128 or part in FORBIDDEN_KEYS)) or
                        type(part) not in (int, str) for part in path)):
                raise InvalidLiveEvent("invalid_editor_path")
            expected = {
                "set": {"path", "kind", "value"},
                "remove": {"path", "kind"},
                "append": {"path", "kind", "value"},
                "upsert-id": {"path", "kind", "id", "value", "before"},
                "remove-id": {"path", "kind", "id"},
            }[op_kind]
            if set(op) - expected or not {"path", "kind"}.issubset(op):
                raise InvalidLiveEvent("invalid_editor_op_fields")
            if op_kind in ("set", "append", "upsert-id") and "value" not in op:
                raise InvalidLiveEvent("missing_editor_value")
            if op_kind == "append" and not isinstance(op.get("value"), list):
                raise InvalidLiveEvent("invalid_append_value")
            if op_kind in ("upsert-id", "remove-id") and not _identifier(op.get("id")):
                raise InvalidLiveEvent("invalid_editor_op_id")
            if any(key in op and not _safe_json(op[key]) for key in ("value", "before")):
                raise InvalidLiveEvent("invalid_editor_value")
            validated_ops.append(op)
        if not _safe_json(validated_ops):
            raise InvalidLiveEvent("invalid_editor_value")
        return {"type": kind, **identity, "id": mutation_id,
                "item_id": item_id, "client_id": client_id,
                "ops": validated_ops, **({"base_version": base_version} if base_version is not None else {}),
                "sent_at": int(time.time() * 1000)}

    if kind == "object_transform":
        if role not in ("owner", "editor"):
            raise InvalidLiveEvent("read_only")
        if set(frame) != {"type", "client_id", "seq", "finished", "items"}:
            raise InvalidLiveEvent("invalid_transform_fields")
        client_id, seq, finished, items = (
            frame["client_id"], frame["seq"], frame["finished"], frame["items"]
        )
        if not _identifier(client_id, MAX_CLIENT_ID) or type(seq) is not int or not 1 <= seq <= 1_000_000:
            raise InvalidLiveEvent("invalid_transform_identity")
        if type(finished) is not bool or not isinstance(items, list) or not 1 <= len(items) <= 64:
            raise InvalidLiveEvent("invalid_transform_items")
        validated_items = []
        seen = set()
        for item in items:
            if not isinstance(item, dict):
                raise InvalidLiveEvent("invalid_transform_item")
            allowed = {"id", "x", "y", "width", "height", "rotation", "origin",
                       "connectorStart", "connectorEnd"}
            if set(item) - allowed or not {"id", "x", "y", "width", "height", "rotation", "origin"}.issubset(item):
                raise InvalidLiveEvent("invalid_transform_item_fields")
            if (not _identifier(item["id"]) or not isinstance(item["origin"], str) or
                    not 1 <= len(item["origin"]) <= 128 or item["id"] in seen):
                raise InvalidLiveEvent("invalid_transform_item_identity")
            seen.add(item["id"])
            for key in ("x", "y", "width", "height", "rotation"):
                value = item[key]
                if not finite_position(value) or (key in ("width", "height") and value < 0):
                    raise InvalidLiveEvent("invalid_transform_geometry")
            for key in ("connectorStart", "connectorEnd"):
                point = item.get(key)
                if point is not None and (
                    not isinstance(point, dict) or set(point) != {"x", "y"} or
                    not finite_position(point["x"]) or not finite_position(point["y"])
                ):
                    raise InvalidLiveEvent("invalid_transform_connector")
            validated_items.append(item)
        return {"type": kind, **identity, "client_id": client_id,
                "seq": seq, "finished": finished, "items": validated_items,
                "sent_at": int(time.time() * 1000)}

    if kind in ("focus_view", "teacher_view"):
        if role not in ("owner", "editor"):
            raise InvalidLiveEvent("read_only")
        if kind == "focus_view":
            if set(frame) != {"type", "target_user_id", "center_x", "center_y", "zoom"}:
                raise InvalidLiveEvent("invalid_focus_fields")
            target = frame["target_user_id"]
            if not _identifier(target, 64):
                raise InvalidLiveEvent("invalid_focus_target")
        else:
            if set(frame) != {"type", "center_x", "center_y", "zoom"}:
                raise InvalidLiveEvent("invalid_teacher_view_fields")
            target = None
        x, y, zoom = _view_numbers(frame)
        return {"type": kind, **identity, "target_user_id": target,
                "center_x": x, "center_y": y, "zoom": zoom,
                "sent_at": int(time.time() * 1000)}

    if kind == "guided_follow":
        if role not in ("owner", "editor"):
            raise InvalidLiveEvent("read_only")
        if set(frame) != {"type", "enabled"} or type(frame["enabled"]) is not bool:
            raise InvalidLiveEvent("invalid_guided_follow")
        return {"type": kind, **identity, "enabled": frame["enabled"],
                "sent_at": int(time.time() * 1000)}

    if kind == "attachment_request":
        if set(frame) != {"type", "request_id", "asset_id", "name", "mime",
                          "kind", "width", "height"}:
            raise InvalidLiveEvent("invalid_attachment_request_fields")
        request_id, asset_id = frame["request_id"], frame["asset_id"]
        name, mime, attachment_kind = frame["name"], frame["mime"], frame["kind"]
        if (not _identifier(request_id) or not _identifier(asset_id, 160) or
                not isinstance(name, str) or not 1 <= len(name) <= 200 or
                any(ord(ch) < 32 for ch in name) or
                not isinstance(mime, str) or not 1 <= len(mime) <= 128 or
                attachment_kind not in ("image", "pdf")):
            raise InvalidLiveEvent("invalid_attachment_request")
        width, height = frame["width"], frame["height"]
        if (type(width) not in (int, float) or type(height) not in (int, float) or
                not math.isfinite(width) or not math.isfinite(height) or
                not 1 <= width <= 10000 or not 1 <= height <= 10000):
            raise InvalidLiveEvent("invalid_attachment_dimensions")
        return {"type": kind, **identity, "request_id": request_id,
                "asset_id": asset_id, "attachment_name": name, "mime": mime,
                "kind": attachment_kind, "width": width, "height": height,
                "sent_at": int(time.time() * 1000)}

    if kind == "attachment_result":
        if role not in ("owner", "editor"):
            raise InvalidLiveEvent("read_only")
        if set(frame) != {"type", "request_id", "target_user_id", "approved", "name"}:
            raise InvalidLiveEvent("invalid_attachment_result_fields")
        request_id, target = frame["request_id"], frame["target_user_id"]
        approved, attachment_name = frame["approved"], frame["name"]
        if (not _identifier(request_id) or not _identifier(target, 64) or
                type(approved) is not bool or not isinstance(attachment_name, str) or
                not 1 <= len(attachment_name) <= 200):
            raise InvalidLiveEvent("invalid_attachment_result")
        return {"type": kind, **identity, "request_id": request_id,
                "target_user_id": target, "approved": approved,
                "attachment_name": attachment_name, "sent_at": int(time.time() * 1000)}

    raise InvalidLiveEvent("unsupported_event")


class EventRateLimit:
    """Bound per-socket transient traffic; durable writes use separate limits."""
    def __init__(self):
        self.cursors: deque[float] = deque()
        self.ink: deque[float] = deque()
        self.ink_commits: deque[float] = deque()
        self.ink_motion: deque[float] = deque()
        self.ink_motion_acks: deque[float] = deque()
        self.objects: deque[float] = deque()
        self.work: deque[float] = deque()
        self.mutations: deque[float] = deque()
        self.transforms: deque[float] = deque()
        self.views: deque[float] = deque()
        self.attachments: deque[float] = deque()
        self.violations = 0

    def check(self, event_type: str) -> bool:
        now = time.monotonic()
        if event_type == "cursor":
            window, limit = self.cursors, 20
        elif event_type == "ink_commit":
            window, limit = self.ink_commits, 45
        elif event_type == "ink_motion":
            window, limit = self.ink_motion, 40
        elif event_type == "ink_motion_ack":
            window, limit = self.ink_motion_acks, 25
        elif event_type == "object_preview":
            window, limit = self.objects, 24
        elif event_type in ("live_ink", "live_erase"):
            window, limit = self.ink, 30
        elif event_type == "work_state":
            window, limit = self.work, 30
        elif event_type == "object_transform":
            window, limit = self.transforms, 40
        elif event_type == "editor_mutation":
            window, limit = self.mutations, 40
        elif event_type in ("focus_view", "teacher_view", "guided_follow"):
            window, limit = self.views, 10
        else:
            window, limit = self.attachments, 8
        while window and now - window[0] >= 1.0:
            window.popleft()
        if len(window) >= limit:
            self.violations += 1
            return False
        window.append(now)
        return True

