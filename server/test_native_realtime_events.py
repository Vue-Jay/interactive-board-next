"""Native Lektrus realtime event validation."""
import pytest

from realtime_events import EventRateLimit, InvalidLiveEvent, validate_live_event


def accept(frame, role="editor"):
    return validate_live_event(
        frame, role=role, user_id="trusted-user",
        name="Учитель базы данных",
    )


def test_work_state_is_attributed_and_bounded():
    frame={"type":"work_state","selected_ids":["item_1","item_2"],"editing_id":"item_2"}
    result=accept(frame,role="viewer")
    assert result["user_id"]=="trusted-user"
    assert result["name"]=="Учитель базы данных"
    assert result["role"]=="viewer"
    assert result["selected_ids"]==frame["selected_ids"]
    for bad in [
        {**frame,"user_id":"victim"},
        {**frame,"selected_ids":["bad/id"]},
        {**frame,"selected_ids":["same","same"]},
        {**frame,"selected_ids":["x"]*101},
        {**frame,"editing_id":"../other"},
    ]:
        with pytest.raises(InvalidLiveEvent):
            accept(bad)


def test_editor_mutations_reject_unsafe_paths_and_payloads():
    frame={
        "type":"editor_mutation","id":"client_1:17","item_id":"graph_1",
        "client_id":"client_1","ops":[
            {"path":["scienceLabBench","temperature"],"kind":"set","value":85.5},
            {"path":["vessels"],"kind":"append","value":[{"id":"beaker_1","volume":50}]},
        ],
    }
    result=accept(frame)
    assert result["ops"]==frame["ops"]
    assert result["user_id"]=="trusted-user"
    with pytest.raises(InvalidLiveEvent,match="read_only"):
        accept(frame,role="viewer")
    for bad in [
        {**frame,"ops":[{"path":["__proto__","polluted"],"kind":"set","value":True}]},
        {**frame,"ops":[{"path":["constructor"],"kind":"remove"}]},
        {**frame,"ops":[{"path":["x"],"kind":"set","value":{"constructor":{"x":1}}}]},
        {**frame,"ops":[{"path":["x"],"kind":"append","value":"not-an-array"}]},
        {**frame,"ops":[{"path":["x"],"kind":"unknown"}]},
        {**frame,"ops":[{"path":["x"],"kind":"remove-id","id":"bad/id"}]},
        {**frame,"ops":[{"path":["x"],"kind":"set"}]},
        {**frame,"ops":[{"path":["x"]*19,"kind":"remove"}]},
    ]:
        with pytest.raises(InvalidLiveEvent):
            accept(bad)


def test_object_transforms_validate_geometry_and_server_identity():
    frame={
        "type":"object_transform","client_id":"client_1","seq":7,"finished":False,
        "items":[{
            "id":"shape_1","x":20,"y":30,"width":180,"height":90,"rotation":15,
            "origin":"20,30,180,90,15","connectorStart":{"x":1,"y":2},
        }],
    }
    result=accept(frame)
    assert result["user_id"]=="trusted-user"
    assert result["items"]==frame["items"]
    with pytest.raises(InvalidLiveEvent,match="read_only"):
        accept(frame,role="viewer")
    for bad in [
        {**frame,"items":[{**frame["items"][0],"width":-1}]},
        {**frame,"items":[{**frame["items"][0],"connectorStart":{"x":True,"y":2}}]},
        {**frame,"items":[{**frame["items"][0],"id":"../private"}]},
        {**frame,"items":[frame["items"][0],frame["items"][0]]},
        {**frame,"seq":True},
    ]:
        with pytest.raises(InvalidLiveEvent):
            accept(bad)


def test_view_and_attachment_events_are_role_checked_and_attributed():
    focus={"type":"focus_view","target_user_id":"student-123","center_x":20,
           "center_y":40,"zoom":1.25}
    result=accept(focus)
    assert result["user_id"]=="trusted-user"
    assert result["target_user_id"]=="student-123"
    with pytest.raises(InvalidLiveEvent,match="read_only"):
        accept(focus,role="viewer")

    request={"type":"attachment_request","request_id":"request_1","asset_id":"asset_1",
             "name":"Лабораторная работа.pdf","mime":"application/pdf","kind":"pdf",
             "width":600,"height":850}
    assert accept(request,role="viewer")["user_id"]=="trusted-user"

    answer={"type":"attachment_result","request_id":"request_1",
            "target_user_id":"student-123","approved":True,"name":"Лабораторная работа.pdf"}
    assert accept(answer)["approved"] is True
    with pytest.raises(InvalidLiveEvent,match="read_only"):
        accept(answer,role="viewer")

    for bad in [
        {**focus,"zoom":0},
        {**focus,"sender_user_id":"spoofed"},
        {**request,"student_id":"spoofed"},
        {**request,"width":float("inf")},
        {**answer,"approved":"yes"},
    ]:
        with pytest.raises(InvalidLiveEvent):
            accept(bad)


def test_native_event_rate_budgets_are_separate():
    limiter=EventRateLimit()
    for event,limit in (("work_state",30),("editor_mutation",40),
                        ("object_transform",40),("ink_commit",45),
                        ("cursor",20),("focus_view",10)):
        assert all(limiter.check(event) for _ in range(limit))
        assert limiter.check(event) is False
    # Saturating any one category must not starve the others.
    assert limiter.violations == 6


def test_live_erase_is_editor_only_and_validates_cancellation():
    frame = {"type":"live_erase", "client_id":"client_1", "stroke_id":"erase_1",
             "kind":"eraser", "color":"#000000", "weight":180, "offset":0,
             "points":[{"x":10,"y":20}, {"x":20,"y":20}], "finished":False, "cancelled":False, "cut_ids":[]}
    assert accept(frame)["points"] == frame["points"]
    assert accept({**frame,"erase_mode":"stroke"})["erase_mode"] == "stroke"
    assert "erase_mode" not in accept(frame)  # Older clients remain compatible.
    with pytest.raises(InvalidLiveEvent,match="invalid_erase_mode"):
        accept({**frame,"erase_mode":"invalid"})
    assert accept({**frame,"finished":True,"cancelled":True})["cancelled"] is True
    with pytest.raises(InvalidLiveEvent,match="read_only"):
        accept(frame,role="viewer")
    assert accept({**frame,"finished":True,"cut_ids":["old_stroke"]})["cut_ids"] == ["old_stroke"]
    for bad in [{**frame,"cancelled":True}, {**frame,"kind":"marker"}, {**frame,"weight":1001}, {**frame,"cut_ids":["old_stroke"]}]:
        with pytest.raises(InvalidLiveEvent):
            accept(bad)

