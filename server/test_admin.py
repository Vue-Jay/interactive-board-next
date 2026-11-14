"""Integration tests for the server-authoritative Lektrus admin panel."""
from datetime import datetime, timedelta, timezone
from uuid import UUID

import asyncpg
import pytest

from app import app
from test_api import STUDENT, OUTSIDER, client, sign_in


@pytest.mark.asyncio
async def test_admin_can_manage_accounts_boards_and_feedback_but_students_cannot(client):
    _, teacher = await sign_in(client, "teacher@example.test")
    board = await client.post(
        "/api/v1/boards", headers=teacher, json={"title": "Доска преподавателя"}
    )
    assert board.status_code == 201, board.text
    board_id = UUID(board.json()["id"])

    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "UPDATE account_users SET is_admin=true WHERE id=$1", STUDENT
        )
        await conn.execute(
            "INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'viewer')",
            board_id, STUDENT,
        )

    _, admin = await sign_in(client, "student@example.test")
    _, ordinary_student = await sign_in(client, "outsider@example.test")

    assert (await client.get("/api/v1/admin/users", headers=ordinary_student)).status_code == 403
    users = await client.get("/api/v1/admin/users", headers=admin)
    assert users.status_code == 200, users.text
    admin_row = next(row for row in users.json() if row["email"] == "student@example.test")
    assert admin_row["is_admin"] is True
    assert admin_row["role"] == "teacher"

    boards = await client.get("/api/v1/admin/boards", headers=admin)
    assert boards.status_code == 200, boards.text
    assert any(row["id"] == str(board_id) and row["member_count"] == 1 for row in boards.json())

    workspace = await client.get(
        f"/api/v1/admin/users/{STUDENT}/boards", headers=admin
    )
    assert workspace.status_code == 200, workspace.text
    assert [row["id"] for row in workspace.json()] == [str(board_id)]

    # An administrator can inspect any active board and, when the UI's
    # maintenance switch is enabled, the server accepts the admin save.
    document = await client.get(
        f"/api/v1/boards/{board_id}/document", headers=admin
    )
    assert document.status_code == 200
    saved = await client.put(
        f"/api/v1/boards/{board_id}/document", headers=admin,
        json={"expected_version": 0, "document": {"items": [], "ink": []}},
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["version"] == 1

    until = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    grant = await client.patch(
        f"/api/v1/admin/users/{OUTSIDER}/subscription", headers=admin,
        json={"plan": "teacher", "until": until},
    )
    assert grant.status_code == 200, grant.text
    async with app.state.pool.acquire() as conn:
        plan = await conn.fetchrow(
            "SELECT subscription_plan,subscription_until FROM account_users WHERE id=$1",
            OUTSIDER,
        )
    assert plan["subscription_plan"] == "teacher"
    assert plan["subscription_until"] is not None

    application = {
        "phone": "+7 900 000-00-00", "city": "Пермь",
        "organization": "Школа № 1", "focusArea": "Физика",
        "experience": "Пять лет", "motivation": "Люблю преподавать",
    }
    requested = await client.post(
        "/api/v1/account/teacher-request", headers=ordinary_student, json=application
    )
    assert requested.status_code == 200, requested.text
    assert requested.json()["teacher_status"] == "pending"

    requests = await client.get("/api/v1/admin/teacher-requests", headers=admin)
    assert requests.status_code == 200, requests.text
    request_row = next(row for row in requests.json() if row["user_id"] == str(OUTSIDER))
    assert request_row["application"]["focusArea"] == "Физика"
    approved = await client.post(
        f"/api/v1/admin/teacher-requests/{OUTSIDER}/review",
        headers=admin, json={"approve": True},
    )
    assert approved.status_code == 200, approved.text
    refreshed_access = await client.get("/api/v1/auth/me", headers=ordinary_student)
    assert refreshed_access.status_code == 200
    assert refreshed_access.json()["teacher_status"] == "approved"

    feedback = await client.post("/api/v1/feedback", json={
        "name": "Гость", "email": "guest@example.test",
        "topic": "Предложение", "message": "Добавьте больше учебных материалов.",
        "source": "site",
    })
    assert feedback.status_code == 201, feedback.text
    feedback_id = feedback.json()["id"]
    inbox = await client.get("/api/v1/admin/feedback", headers=admin)
    assert inbox.status_code == 200, inbox.text
    assert any(row["id"] == feedback_id for row in inbox.json())
    closed = await client.patch(
        f"/api/v1/admin/feedback/{feedback_id}", headers=admin,
        json={"status": "closed"},
    )
    assert closed.status_code == 200, closed.text
    assert closed.json()["status"] == "closed"
    assert (await client.get("/api/v1/admin/feedback", headers=ordinary_student)).status_code == 403
