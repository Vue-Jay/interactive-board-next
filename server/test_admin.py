"""Integration tests for the server-authoritative Lektrus admin panel."""
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import asyncpg
import pytest

from app import app
from test_api import TEACHER, STUDENT, OUTSIDER, client, sign_in


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


@pytest.mark.asyncio
async def test_admin_delete_account_preserves_other_users_boards(client, tmp_path, monkeypatch):
    monkeypatch.setenv("LEKTRUS_ASSETS_DIR", str(tmp_path))
    shared, owned, root, reply, chat, material = (uuid4() for _ in range(6))
    shared_storage, owned_storage, material_storage = (uuid4() for _ in range(3))
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET is_admin=true WHERE id IN ($1,$2)", TEACHER, STUDENT)
        await conn.execute("INSERT INTO boards(id,owner_id,title) VALUES($1,$2,'Shared'),($3,$4,'Owned')",
                           shared, TEACHER, owned, OUTSIDER)
        await conn.execute("INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'editor')", shared, OUTSIDER)
        await conn.execute(
            """INSERT INTO board_documents(board_id,document,updated_by)
               VALUES($1,'{"items":[],"ink":[]}'::jsonb,$2)""", shared, OUTSIDER)
        for board, storage in [(shared, shared_storage), (owned, owned_storage)]:
            await conn.execute(
                """INSERT INTO board_assets(board_id,asset_id,storage_name,content_type,size_bytes,sha256,created_by)
                   VALUES($1,'asset',$2,'image/png',1,$3,$4)""",
                board, storage, "a"*64, OUTSIDER)
            folder = tmp_path / str(board)
            folder.mkdir()
            (folder / storage.hex).write_bytes(b"x")
        await conn.execute(
            """INSERT INTO learning_materials(id,owner_id,title,file_name,mime,size_bytes,storage_name)
               VALUES($1,$2,'Private','private.png','image/png',1,$3)""", material, OUTSIDER, material_storage)
        (tmp_path / "materials").mkdir()
        (tmp_path / "materials" / material_storage.hex).write_bytes(b"x")
        await conn.execute("INSERT INTO board_comments(id,board_id,author_id,body) VALUES($1,$2,$3,'Root')",
                           root, shared, OUTSIDER)
        await conn.execute("INSERT INTO board_comments(id,board_id,author_id,parent_id,body) VALUES($1,$2,$3,$4,'Reply')",
                           reply, shared, TEACHER, root)
        await conn.execute(
            """INSERT INTO board_pilot_operations(board_id,operation_id,actor_id,operation_type,stroke_id,request_sha256,resulting_version,payload)
               VALUES($1,$2,$3,'ink_append','stroke',$4,1,'{}')""", shared, uuid4(), OUTSIDER, "a"*64)
        await conn.execute(
            """INSERT INTO board_pilot_object_operations(board_id,operation_id,actor_id,operation_type,object_id,request_sha256,object_revision,resulting_version,payload)
               VALUES($1,$2,$3,'object_create','object',$4,1,1,'{}')""", shared, uuid4(), OUTSIDER, "a"*64)
        await conn.execute("INSERT INTO direct_conversations(id,unique_id) VALUES($1,$2)", chat, str(chat))
        await conn.execute("INSERT INTO direct_conversation_members(conversation_id,user_id) VALUES($1,$2),($1,$3)",
                           chat, TEACHER, OUTSIDER)
        await conn.execute("INSERT INTO direct_messages(id,conversation_id,sender_id,sender_name,body) VALUES($1,$2,$3,'Outsider','Hello')",
                           uuid4(), chat, OUTSIDER)
        await conn.execute("INSERT INTO board_invites(id,board_id,email,role) VALUES($1,$2,'outsider@example.test','viewer')",
                           uuid4(), shared)
    _, admin = await sign_in(client, "student@example.test")
    victim, ordinary = await sign_in(client, "outsider@example.test")
    url = f"/api/v1/admin/users/{OUTSIDER}"
    body = {"email": "outsider@example.test"}
    assert (await client.request("DELETE", url, json=body)).status_code == 401
    assert (await client.request("DELETE", url, headers=ordinary, json=body)).status_code == 403
    assert (await client.request("DELETE", f"/api/v1/admin/users/{STUDENT}", headers=admin,
                                 json={"email":"student@example.test"})).status_code == 409
    assert (await client.request("DELETE", f"/api/v1/admin/users/{TEACHER}", headers=admin,
                                 json={"email":"teacher@example.test"})).status_code == 409
    assert (await client.request("DELETE", url, headers=admin, json={"email":"wrong@example.test"})).status_code == 409
    assert (tmp_path / str(owned) / owned_storage.hex).exists()
    deleted = await client.request("DELETE", url, headers=admin, json=body)
    assert deleted.status_code == 200, deleted.text
    assert deleted.json() == {"ok": True, "files_pending": 0}
    assert (await client.request("DELETE", url, headers=admin, json=body)).status_code == 404
    assert (await client.get("/api/v1/auth/me", headers=ordinary)).status_code == 401
    assert (await client.post("/api/v1/auth/refresh", json={"refresh_token":victim["refresh_token"]})).status_code == 401
    users = (await client.get("/api/v1/admin/users", headers=admin)).json()
    assert {row["email"] for row in users} == {"teacher@example.test", "student@example.test"}
    async with app.state.pool.acquire() as conn:
        assert await conn.fetchval("SELECT count(*) FROM boards WHERE id=$1", owned) == 0
        assert await conn.fetchval("SELECT count(*) FROM boards WHERE id=$1", shared) == 1
        assert await conn.fetchval("SELECT count(*) FROM board_members WHERE user_id=$1", OUTSIDER) == 0
        assert await conn.fetchval("SELECT count(*) FROM account_sessions WHERE user_id=$1", OUTSIDER) == 0
        assert await conn.fetchval("SELECT count(*) FROM board_documents WHERE board_id=$1 AND updated_by IS NULL", shared) == 1
        assert await conn.fetchval("SELECT count(*) FROM board_assets WHERE board_id=$1 AND created_by IS NULL", shared) == 1
        assert await conn.fetchval("SELECT count(*) FROM board_pilot_operations WHERE board_id=$1 AND actor_id IS NULL", shared) == 1
        assert await conn.fetchval("SELECT count(*) FROM board_pilot_object_operations WHERE board_id=$1 AND actor_id IS NULL", shared) == 1
        assert await conn.fetchval("SELECT count(*) FROM board_comments WHERE id=$1 AND parent_id IS NULL", reply) == 1
        assert await conn.fetchval("SELECT count(*) FROM board_comments WHERE id=$1", root) == 0
        assert await conn.fetchval("SELECT count(*) FROM direct_conversations WHERE id=$1", chat) == 0
        assert await conn.fetchval("SELECT count(*) FROM learning_materials WHERE id=$1", material) == 0
        assert await conn.fetchval("SELECT count(*) FROM board_invites WHERE email='outsider@example.test'") == 0
    assert (tmp_path / str(shared) / shared_storage.hex).exists()
    assert not (tmp_path / str(owned) / owned_storage.hex).exists()
    assert not (tmp_path / "materials" / material_storage.hex).exists()
