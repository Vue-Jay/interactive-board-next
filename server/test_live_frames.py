"""Strict transient live-event input contract and per-socket traffic budgets."""
import math

import pytest

from realtime_events import EventRateLimit, InvalidLiveEvent, validate_live_event


def cursor():
    return {"type":"cursor","client_id":"client_01","x":12.3,"y":-56.7}


def ink():
    return {
        "type":"live_ink","client_id":"client_01","stroke_id":"pen_001",
        "kind":"pen","color":"#235dd4","weight":2.5,"offset":0,
        "points":[{"x":0,"y":10},{"x":1.5,"y":10.5}],"finished":False,
    }


def object_preview():
    return {
        "type":"object_preview","client_id":"client_01","object_id":"rect_001",
        "gesture_id":"gesture_001","seq":1,"object_revision":2,
        "x":120.5,"y":240.25,
    }


def accept(frame, role="editor"):
    return validate_live_event(
        frame,role=role,user_id="trusted-user",
        name="Учитель базы данных",
    )


def test_cursor_identity_from_server_only():
    result=accept(cursor(),role="viewer")
    assert result["role"]=="viewer"
    assert result["user_id"]=="trusted-user"
    assert result["name"]=="Учитель базы данных"
    for frame in [
        {**cursor(),"role":"owner"},
        {**cursor(),"user_id":"victim"},
        {**cursor(),"x":True},
        {**cursor(),"x":math.inf},
        {**cursor(),"x":math.nan},
        {**cursor(),"x":10_000_001},
        {**cursor(),"client_id":"bad/id"},
    ]:
        with pytest.raises(InvalidLiveEvent):
            accept(frame)


def test_ink_requires_editor_and_validates_bounds():
    good=accept(ink())
    assert good["points"]==ink()["points"]
    assert good["stroke_id"]=="pen_001"
    assert good["user_id"]=="trusted-user"
    with pytest.raises(InvalidLiveEvent,match="read_only"):
        accept(ink(),role="viewer")
    for bad in [
        {**ink(),"user_id":"someone"},
        {**ink(),"kind":"dangerous-tool"},
        {**ink(),"color":"url(javascript:alert(1))"},
        {**ink(),"weight":float("nan")},
        {**ink(),"weight":1000},
        {**ink(),"finished":"true"},
        {**ink(),"offset":-1},
        {**ink(),"offset":1_000_000},
        {**ink(),"points":[]},
        {**ink(),"points":[{"x":1,"y":2}]*201},
        {**ink(),"points":[{"x":True,"y":2}]},
        {**ink(),"points":[{"x":1,"y":2,"admin":True}]},
    ]:
        with pytest.raises(InvalidLiveEvent):
            accept(bad)


def test_object_preview_is_editor_only_and_server_attributed():
    result=accept(object_preview(),role="editor")
    assert result["type"]=="object_preview"
    assert result["user_id"]=="trusted-user"
    assert result["name"]=="Учитель базы данных"
    assert result["object_id"]=="rect_001"
    assert result["object_revision"]==2
    with pytest.raises(InvalidLiveEvent,match="read_only"):
        accept(object_preview(),role="viewer")
    for frame in [
        {**object_preview(),"user_id":"victim"},
        {**object_preview(),"role":"owner"},
        {**object_preview(),"object_id":"../private"},
        {**object_preview(),"gesture_id":"gesture/other"},
        {**object_preview(),"seq":True},
        {**object_preview(),"object_revision":0},
        {**object_preview(),"x":1001},
        {**object_preview(),"y":float("inf")},
    ]:
        with pytest.raises(InvalidLiveEvent):
            accept(frame)


def test_unknown_event_and_rate_limits():
    with pytest.raises(InvalidLiveEvent,match="unsupported_event"):
        accept({"type":"remote_admin"})
    limiter=EventRateLimit()
    assert all(limiter.check("cursor") for _ in range(20))
    assert limiter.check("cursor") is False
    assert all(limiter.check("object_preview") for _ in range(24))
    assert limiter.check("object_preview") is False
    assert all(limiter.check("live_ink") for _ in range(30))
    assert limiter.check("live_ink") is False
    assert limiter.violations==3
