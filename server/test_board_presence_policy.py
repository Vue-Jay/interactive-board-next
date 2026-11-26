from board_presence_policy import participant_color, idle_deadline, valid_idle_age, BOARD_IDLE_SECONDS

def test_board_idle_lease_and_colors():
    assert BOARD_IDLE_SECONDS == 600
    assert idle_deadline(0, now=10) == 610
    assert idle_deadline(90_000, now=100) == 610
    assert idle_deadline(600_000, now=610) == 610
    assert not valid_idle_age(True)
    assert not valid_idle_age(-1)
    assert not valid_idle_age(600_001)
    active=[]
    for i in range(100):
        user=f"student-{i}"
        color=participant_color(user,active)
        assert color not in {meta["color"] for meta in active}
        active.append({"user_id":user,"color":color})
        assert participant_color(user,active)==color
