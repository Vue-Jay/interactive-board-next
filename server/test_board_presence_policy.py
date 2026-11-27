from board_presence_policy import (BOARD_IDLE_SECONDS, TEACHER_COLOR, STUDENT_PALETTE,
                                   participant_color, idle_deadline, valid_idle_age, background_deadline)

def test_board_idle_lease_and_colors():
    assert BOARD_IDLE_SECONDS == 600
    assert idle_deadline(0, now=10) == 610
    assert idle_deadline(90_000, now=100) == 610
    assert idle_deadline(600_000, now=610) == 610
    assert not valid_idle_age(True)
    assert not valid_idle_age(-1)
    assert not valid_idle_age(600_001)

def test_room_color_queue_and_owner_reservation():
    assert TEACHER_COLOR == "#3056c8"
    assert TEACHER_COLOR not in STUDENT_PALETTE
    active=[]
    assert participant_color("teacher", active, role="owner")==TEACHER_COLOR
    assert participant_color("student-first", active, role="editor",sequence=0)==STUDENT_PALETTE[0]
    owner={"user_id":"teacher","role":"owner","color":TEACHER_COLOR}
    active.append(owner)
    for i in range(100):
        user=f"student-{i}"
        color=participant_color(user,active,role="editor",sequence=i)
        assert color != TEACHER_COLOR
        assert color not in {meta["color"] for meta in active}
        active.append({"user_id":user,"role":"editor","color":color})
        assert participant_color(user,active,role="editor",sequence=i+99)==color
    assert participant_color("teacher",active,role="owner",sequence=400)==TEACHER_COLOR

def test_new_entry_renews_color_but_empty_board_resets_queue():
    teacher={"user_id":"teacher","role":"owner","color":TEACHER_COLOR}
    first=participant_color("pupil", [teacher],sequence=0)
    other={"user_id":"other","role":"editor","color":first}
    second=participant_color("pupil",[teacher,other],sequence=1)
    assert second != first == STUDENT_PALETTE[0]
    # A new connection for the same visible user keeps the same seat.
    assert participant_color("pupil",[teacher,other,{"user_id":"pupil","role":"editor","color":second}],sequence=50)==second
    # When the last presence socket goes away, the server drops its counter.
    assert participant_color("pupil",[],sequence=0)==first

def test_background_only_lease():
    import pytest
    assert background_deadline(False, 0, now=10000) is None
    assert background_deadline(True, 0, now=10000) == 10600
    assert background_deadline(True, 599000, now=10599) == 10600
    assert background_deadline(True, 600000, now=10600) == 10600
    assert background_deadline(False, 0, now=10599) is None
    with pytest.raises(ValueError):
        background_deadline(False, 1)
    with pytest.raises(ValueError):
        background_deadline("false", 0)
