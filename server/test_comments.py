"""PostgreSQL-backed access checks for native board discussion threads."""
from uuid import UUID

import pytest

from app import app
from test_api import OUTSIDER, STUDENT, client, sign_in


@pytest.mark.asyncio
async def test_board_comments_follow_membership_and_author_or_editor_permissions(client):
    _, teacher = await sign_in(client, "teacher@example.test")
    board_id = UUID((await client.post(
        "/api/v1/boards", headers=teacher, json={"title": "Обсуждение"}
    )).json()["id"])
    other_board = UUID((await client.post(
        "/api/v1/boards", headers=teacher, json={"title": "Другая доска"}
    )).json()["id"])
    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'viewer')",
            board_id, STUDENT,
        )

    participants = await client.get(
        f"/api/v1/boards/{board_id}/comment-participants", headers=teacher
    )
    assert participants.status_code == 200, participants.text
    assert {row["user_id"] for row in participants.json()} == {
        str(UUID("00000000-0000-4000-8000-000000000001")), str(STUDENT)
    }

    root = await client.post(
        f"/api/v1/boards/{board_id}/comments", headers=teacher,
        json={"body": "Проверьте решение"},
    )
    assert root.status_code == 201, root.text
    root_row = root.json()
    assert root_row["author_id"] == "00000000-0000-4000-8000-000000000001"
    assert root_row["parent_id"] is None

    _, student = await sign_in(client, "student@example.test")
    reply = await client.post(
        f"/api/v1/boards/{board_id}/comments", headers=student,
        json={"body": "Готово", "parent_id": root_row["id"], "author_id": str(OUTSIDER)},
    )
    assert reply.status_code == 201, reply.text
    reply_row = reply.json()
    assert reply_row["author_id"] == str(STUDENT)
    assert reply_row["parent_id"] == root_row["id"]

    wrong_parent = await client.post(
        f"/api/v1/boards/{board_id}/comments", headers=student,
        json={"body": "Чужая ветка", "parent_id": "00000000-0000-4000-8000-000000000099"},
    )
    assert wrong_parent.status_code == 404
    assert (await client.patch(
        f"/api/v1/comments/{root_row['id']}", headers=student,
        json={"resolved": True},
    )).status_code == 403
    student_resolved = await client.patch(
        f"/api/v1/comments/{reply_row['id']}", headers=student,
        json={"resolved": True},
    )
    assert student_resolved.status_code == 200
    assert student_resolved.json()["resolved"] is True

    comments = await client.get(f"/api/v1/boards/{board_id}/comments", headers=teacher)
    assert comments.status_code == 200
    assert [row["id"] for row in comments.json()] == [root_row["id"], reply_row["id"]]
    resolved = await client.patch(
        f"/api/v1/comments/{reply_row['id']}", headers=teacher,
        json={"resolved": False},
    )
    assert resolved.status_code == 200 and resolved.json()["resolved"] is False

    _, outsider = await sign_in(client, "outsider@example.test")
    assert (await client.get(
        f"/api/v1/boards/{board_id}/comments", headers=outsider
    )).status_code == 404
    assert (await client.get(
        f"/api/v1/boards/{board_id}/comment-participants", headers=outsider
    )).status_code == 404
    assert (await client.post(
        f"/api/v1/boards/{other_board}/comments", headers=outsider,
        json={"body": "Нет доступа"},
    )).status_code == 404
