"""Strict bounded transient messages for the isolated self-hosted collaboration pilot.

These events are *not* the durable board document. No event from a browser
may specify authoritative user identity or access rights. Invalid payloads
are rejected without fan-out. Client final-stroke retries use an explicit ack.
"""
from __future__ import annotations

import math
import re
import time
from collections import deque
from typing import Any

MAX_EVENT_BYTES = 24_000
MAX_INK_POINTS = 200
MAX_CLIENT_ID = 96
MAX_STROKE_ID = 128
MAX_XY = 10_000_000
MAX_OFFSET = 1_000_000
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")


class InvalidLiveEvent(ValueError):
    pass


def finite_position(value: Any) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and abs(value) <= MAX_XY


def validate_live_event(frame: Any, *, role: str, user_id: str,
                        name: str) -> dict[str, Any]:
    """Return a safe, server-attributed frame or raise InvalidLiveEvent.

    Reject unknown keys rather than silently forwarding arbitrary nested
    objects. This also prevents clients from spoofing identity or privileges.
    """
    if not isinstance(frame, dict):
        raise InvalidLiveEvent("invalid_frame")
    kind = frame.get("type")
    if kind == "cursor":
        if set(frame) != {"type", "x", "y", "client_id"}:
            raise InvalidLiveEvent("invalid_cursor_fields")
        x, y, client_id = frame["x"], frame["y"], frame["client_id"]
        if not finite_position(x) or not finite_position(y):
            raise InvalidLiveEvent("invalid_coordinates")
        if not (isinstance(client_id, str) and
                1 <= len(client_id) <= MAX_CLIENT_ID and
                ID_RE.fullmatch(client_id)):
            raise InvalidLiveEvent("invalid_client")
        return {
            "type": "cursor", "user_id": user_id,
            "name": name[:100], "role": role, "client_id": client_id,
            "x": x, "y": y, "sent_at": int(time.time() * 1000),
        }
    if kind == "object_preview":
        if role not in ("owner", "editor"):
            raise InvalidLiveEvent("read_only")
        required = {"type", "client_id", "object_id", "gesture_id",
                    "seq", "object_revision", "x", "y"}
        if set(frame) != required:
            raise InvalidLiveEvent("invalid_object_fields")
        client_id, object_id = frame["client_id"], frame["object_id"]
        gesture_id = frame["gesture_id"]
        if any(not isinstance(value, str) or not (1 <= len(value) <= 128) or
               not ID_RE.fullmatch(value)
               for value in (client_id, object_id, gesture_id)):
            raise InvalidLiveEvent("invalid_object_identity")
        seq, rev = frame["seq"], frame["object_revision"]
        if (type(seq) is not int or not 0 <= seq <= 1_000_000 or
            type(rev) is not int or not 1 <= rev <= 1_000_000):
            raise InvalidLiveEvent("invalid_object_revision")
        if (not finite_position(frame["x"]) or
            not finite_position(frame["y"]) or
            not 0 <= frame["x"] <= 1000 or not 0 <= frame["y"] <= 1000):
            raise InvalidLiveEvent("invalid_coordinates")
        return {
            "type": "object_preview", "user_id": user_id, "name": name[:100],
            "role": role, "client_id": client_id, "object_id": object_id,
            "gesture_id": gesture_id, "seq": seq, "object_revision": rev,
            "x": frame["x"], "y": frame["y"],
            "sent_at": int(time.time() * 1000),
        }
    if kind == "live_ink":
        if role not in ("owner", "editor"):
            raise InvalidLiveEvent("read_only")
        required = {"type", "client_id", "stroke_id", "kind",
                    "color", "weight", "offset", "points", "finished"}
        if set(frame) != required:
            raise InvalidLiveEvent("invalid_ink_fields")
        client_id, stroke_id = frame["client_id"], frame["stroke_id"]
        if not (isinstance(client_id, str) and
                1 <= len(client_id) <= MAX_CLIENT_ID and ID_RE.fullmatch(client_id)):
            raise InvalidLiveEvent("invalid_client")
        if not (isinstance(stroke_id, str) and
                1 <= len(stroke_id) <= MAX_STROKE_ID and ID_RE.fullmatch(stroke_id)):
            raise InvalidLiveEvent("invalid_stroke")
        kind, color, weight = frame["kind"], frame["color"], frame["weight"]
        if kind not in ("pen", "marker") or not isinstance(color, str) or not COLOR_RE.fullmatch(color):
            raise InvalidLiveEvent("invalid_tool")
        if type(weight) not in (int, float) or not math.isfinite(weight) or not 0.5 <= weight <= 60:
            raise InvalidLiveEvent("invalid_weight")
        offset, finished = frame["offset"], frame["finished"]
        if type(offset) is not int or not 0 <= offset <= MAX_OFFSET or type(finished) is not bool:
            raise InvalidLiveEvent("invalid_offset_or_finished")
        points = frame["points"]
        if not isinstance(points, list) or not 1 <= len(points) <= MAX_INK_POINTS:
            raise InvalidLiveEvent("invalid_points_count")
        validated = []
        for pt in points:
            if not isinstance(pt, dict) or set(pt) != {"x", "y"} or not (
                finite_position(pt["x"]) and finite_position(pt["y"])
            ):
                raise InvalidLiveEvent("invalid_points")
            validated.append({"x": pt["x"], "y": pt["y"]})
        if offset + len(points) > MAX_OFFSET:
            raise InvalidLiveEvent("invalid_points_offset")
        return {
            "type": "live_ink", "user_id": user_id, "name": name[:100],
            "role": role, "client_id": client_id, "stroke_id": stroke_id,
            "kind": kind, "color": color, "weight": weight,
            "offset": offset, "points": validated, "finished": finished,
            "sent_at": int(time.time() * 1000),
        }
    raise InvalidLiveEvent("unsupported_event")


class EventRateLimit:
    """Bound each socket's transient egress. Not durable or global throttling."""
    def __init__(self):
        self.cursors: deque[float] = deque()
        self.ink: deque[float] = deque()
        self.objects: deque[float] = deque()
        self.violations = 0

    def check(self, event_type: str) -> bool:
        now = time.monotonic()
        window = (
            self.cursors if event_type == "cursor" else
            self.objects if event_type == "object_preview" else self.ink
        )
        limit = 20 if event_type == "cursor" else 24 if event_type == "object_preview" else 30
        while window and now - window[0] >= 1.0:
            window.popleft()
        if len(window) >= limit:
            self.violations += 1
            return False
        window.append(now)
        return True
