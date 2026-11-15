"""End-to-end authorization and workflow tests for native education APIs."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from test_api import TEACHER, STUDENT, OUTSIDER, client, sign_in


async def teacher_board(client):
    _, teacher = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    _, outsider = await sign_in(client, "outsider@example.test")
    board_response = await client.post(
        "/api/v1/boards", headers=teacher, json={"title":"Математика"}
    )
    assert board_response.status_code == 201, board_response.text
    board_id = board_response.json()["id"]
    invitation = await client.post(
        f"/api/v1/boards/{board_id}/invitations", headers=teacher,
        json={"email":"student@example.test","role":"editor"},
    )
    assert invitation.status_code == 200, invitation.text
    return teacher, student, outsider, board_id


@pytest.mark.asyncio
async def test_student_roster_profiles_and_session_records(client):
    teacher, student, outsider, board_id = await teacher_board(client)

    roster = await client.get("/api/v1/students", headers=teacher)
    assert roster.status_code == 200, roster.text
    rows = roster.json()
    assert len(rows) == 1
    assert rows[0]["user_id"] == str(STUDENT)
    assert rows[0]["board_ids"] == [board_id]
    assert rows[0]["note"] == "" and rows[0]["tags"] == []

    assert (await client.get("/api/v1/students",headers=student)).status_code == 403
    assert (await client.get("/api/v1/students",headers=outsider)).status_code == 403
    assert (await client.put(f"/api/v1/students/{OUTSIDER}/profile",
        headers=teacher,json={"note":"чужой"})).status_code == 404

    saved = await client.put(
        f"/api/v1/students/{STUDENT}/profile",headers=teacher,
        json={"note":"Сильная геометрия","tags":["геометрия","домашнее задание"]},
    )
    assert saved.status_code == 200, saved.text
    await client.put(
        f"/api/v1/students/{STUDENT}/profile",headers=teacher,
        json={"note":"Повторить доказательства"},
    )
    roster = (await client.get("/api/v1/students",headers=teacher)).json()
    assert roster[0]["note"] == "Повторить доказательства"
    assert roster[0]["tags"] == ["геометрия","домашнее задание"]

    session_id = uuid4()
    payload = {
        "id":str(session_id),"student_id":str(STUDENT),"board_id":board_id,
        "date":datetime.now(timezone.utc).isoformat(),"duration_minutes":55,
        "topic":"Треугольники","homework":"№ 12–15","result":"Разобрали признаки равенства",
    }
    saved_session = await client.put(
        f"/api/v1/student-sessions/{session_id}",headers=teacher,json=payload
    )
    assert saved_session.status_code == 200, saved_session.text
    history = await client.get(
        f"/api/v1/students/{STUDENT}/sessions",headers=teacher
    )
    assert history.status_code == 200
    assert history.json()[0]["topic"] == "Треугольники"
    assert history.json()[0]["board_title"] == "Математика"
    assert (await client.get(
        f"/api/v1/students/{STUDENT}/sessions",headers=student
    )).status_code == 403
    assert (await client.delete(
        f"/api/v1/student-sessions/{session_id}",headers=student
    )).status_code == 403
    assert (await client.delete(
        f"/api/v1/student-sessions/{session_id}",headers=teacher
    )).status_code == 204


@pytest.mark.asyncio
async def test_assignment_create_submit_review_and_permissions(client):
    teacher, student, outsider, board_id = await teacher_board(client)
    assignment_id = uuid4()
    due = (datetime.now(timezone.utc)+timedelta(days=3)).isoformat()
    created = await client.post(
        "/api/v1/assignments",headers=teacher,json={
            "id":str(assignment_id),"student_id":str(STUDENT),
            "board_id":board_id,"title":"Решить задачи","description":"Задачи 1–5",
            "due_at":due,"max_score":20,
        }
    )
    assert created.status_code == 201, created.text
    assert (await client.post(
        "/api/v1/assignments",headers=teacher,json={
            "id":str(uuid4()),"student_id":str(OUTSIDER),
            "title":"Чужое задание","max_score":10,
        }
    )).status_code == 404

    student_list = await client.get("/api/v1/assignments",headers=student)
    assert student_list.status_code == 200
    assert len(student_list.json()) == 1
    assert student_list.json()[0]["id"] == str(assignment_id)
    assert student_list.json()[0]["submissions"] is None
    assert (await client.delete(
        f"/api/v1/assignments/{assignment_id}",headers=student
    )).status_code == 403

    submitted = await client.post(
        f"/api/v1/assignments/{assignment_id}/submit",headers=student,
        json={"content":"Решение с пояснениями"},
    )
    assert submitted.status_code == 200, submitted.text
    teacher_list = await client.get("/api/v1/assignments",headers=teacher)
    submission = teacher_list.json()[0]["submissions"]
    assert submission["content"] == "Решение с пояснениями"
    assert submission["submitted_at"] is not None

    assert (await client.post(
        f"/api/v1/assignments/{assignment_id}/review",headers=teacher,
        json={"score":21,"feedback":"Слишком много"},
    )).status_code == 422
    reviewed = await client.post(
        f"/api/v1/assignments/{assignment_id}/review",headers=teacher,
        json={"score":18,"feedback":"Хорошее решение"},
    )
    assert reviewed.status_code == 200, reviewed.text
    student_row = (await client.get("/api/v1/assignments",headers=student)).json()[0]
    assert student_row["submissions"]["score"] == 18
    assert student_row["submissions"]["reviewed_at"] is not None
    assert (await client.post(
        f"/api/v1/assignments/{assignment_id}/review",headers=student,
        json={"score":10},
    )).status_code == 403
    assert (await client.delete(
        f"/api/v1/assignments/{assignment_id}",headers=teacher
    )).status_code == 204
    assert (await client.get("/api/v1/assignments",headers=student)).json() == []


@pytest.mark.asyncio
async def test_schedule_and_live_lesson_flow(client):
    teacher, student, outsider, board_id = await teacher_board(client)
    schedule_id = uuid4()
    group_id = uuid4()
    starts = (datetime.now(timezone.utc)+timedelta(days=2)).isoformat()
    created = await client.post("/api/v1/schedule",headers=teacher,json={
        "items":[{
            "id":str(schedule_id),"student_id":str(STUDENT),"board_id":board_id,
            "title":"Алгебра","starts_at":starts,"duration_minutes":60,
            "recurrence":"weekly","recurrence_group_id":str(group_id),"note":"Подготовить тетрадь",
        }],
    })
    assert created.status_code == 201, created.text
    student_schedule = await client.get("/api/v1/schedule",headers=student)
    assert student_schedule.status_code == 200
    assert student_schedule.json()[0]["student_name"] == "student"
    assert student_schedule.json()[0]["board_title"] == "Математика"
    assert (await client.patch(
        f"/api/v1/schedule/{schedule_id}",headers=student,json={"title":"Подмена"}
    )).status_code == 403

    patch = await client.patch(
        f"/api/v1/schedule/{schedule_id}",headers=teacher,
        json={"title":"Алгебра: уравнения","duration_minutes":75},
    )
    assert patch.status_code == 200, patch.text
    started_schedule = await client.post(
        f"/api/v1/schedule/{schedule_id}/start",headers=teacher
    )
    assert started_schedule.status_code == 200

    lesson = await client.post(
        f"/api/v1/boards/{board_id}/lessons",headers=teacher,
        json={"student_id":str(STUDENT),"topic":"Уравнения","schedule_id":str(schedule_id)},
    )
    assert lesson.status_code == 201, lesson.text
    lesson_id = lesson.json()["id"]
    active_for_student = await client.get(
        f"/api/v1/boards/{board_id}/lessons/active",headers=student
    )
    assert active_for_student.status_code == 200
    assert active_for_student.json()["student_id"] == str(STUDENT)
    conflict = await client.post(
        f"/api/v1/boards/{board_id}/lessons",headers=teacher,
        json={"student_id":str(STUDENT),"topic":"Второе занятие"},
    )
    assert conflict.status_code == 409

    finish = await client.post(
        f"/api/v1/lessons/{lesson_id}/finish",headers=teacher,
        json={"result":"Освоили перенос слагаемых","homework":"№ 8–12"},
    )
    assert finish.status_code == 200, finish.text
    assert finish.json()["minutes"] >= 1
    assert (await client.get(
        f"/api/v1/boards/{board_id}/lessons/active",headers=student
    )).json() is None
    completed_schedule = (await client.get("/api/v1/schedule",headers=teacher)).json()[0]
    assert completed_schedule["status"] == "completed"
    sessions = await client.get(
        f"/api/v1/students/{STUDENT}/sessions",headers=teacher
    )
    assert sessions.status_code == 200
    assert sessions.json()[0]["topic"] == "Уравнения"
    assert sessions.json()[0]["homework"] == "№ 8–12"

    assert (await client.post(
        f"/api/v1/lessons/{lesson_id}/finish",headers=teacher,json={}
    )).status_code == 404
    assert (await client.delete(
        f"/api/v1/schedule/{schedule_id}?series=true&group_id={group_id}",
        headers=student,
    )).status_code == 403
    assert (await client.delete(
        f"/api/v1/schedule/{schedule_id}?series=true&group_id={group_id}",
        headers=teacher,
    )).status_code == 204
