"""Integration checks against a disposable PostgreSQL instance only.

No connection to real Lectrus/Supabase data is used by these tests.
"""
import asyncio
import json
import os
from uuid import UUID

import asyncpg
import bcrypt
import httpx
import pytest
import pytest_asyncio

from app import app, _login_attempts
from schema import apply_schema

TEACHER = UUID("00000000-0000-4000-8000-000000000001")
STUDENT = UUID("00000000-0000-4000-8000-000000000002")
OUTSIDER = UUID("00000000-0000-4000-8000-000000000003")
PASSWORD = "integration-test-password"

@pytest_asyncio.fixture
async def client():
    # Each integration scenario starts with a clean login-rate-limit window.
    # Production rate limiting remains enabled and unchanged.
    _login_attempts.clear()
    connection = await asyncpg.connect(os.environ["DATABASE_URL"])
    await apply_schema(connection)
    await connection.execute(
        "TRUNCATE account_sessions,board_documents,board_members,boards,account_users CASCADE"
    )
    hashed = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode()
    for user_id, email, role in [
        (TEACHER, "teacher@example.test", "teacher"),
        (STUDENT, "student@example.test", "student"),
        (OUTSIDER, "outsider@example.test", "student"),
    ]:
        await connection.execute(
            """INSERT INTO account_users
               (id,email,password_hash,display_name,account_role,teacher_status,email_confirmed_at)
               VALUES ($1,$2,$3,$4,$5,$6,now())""",
            user_id, email, hashed, role, role,
            "approved" if role == "teacher" else "none",
        )
    await connection.close()
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as instance:
            yield instance

async def sign_in(client: httpx.AsyncClient, email: str):
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    return body, {"Authorization": "Bearer " + body["access_token"]}


@pytest.mark.asyncio
async def test_share_link_access_and_atomic_use_limit(client):
    _, owner = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    _, outsider = await sign_in(client, "outsider@example.test")
    board = await client.post("/api/v1/boards", headers=owner, json={"title": "Share test"})
    board_id = board.json()["id"]
    links = f"/api/v1/boards/{board_id}/share-links"
    redeem = "/api/v1/share-links/redeem"
    created = await client.post(links, headers=owner, json={
        "role": "editor", "max_uses": 1, "password": "test-code",
    })
    assert created.status_code == 201, created.text
    link = created.json()
    assert link["protected"] and link["use_count"] == 0
    assert (await client.get(links, headers=outsider)).status_code == 404
    assert (await client.post(redeem, json={"token": link["token"]})).status_code == 401
    bad = await client.post(redeem, headers=student, json={"token": link["token"], "password": "wrong"})
    assert bad.status_code == 403
    visible = (await client.get(links, headers=owner)).json()[0]
    assert visible["use_count"] == 0 and "token" not in visible and "password_hash" not in visible
    payload = {"token": link["token"], "password": "test-code"}
    attempts = await asyncio.gather(*(
        client.post(redeem, headers=headers, json=payload) for headers in (student, outsider)
    ))
    assert sorted(response.status_code for response in attempts) == [200, 404]
    winning_headers = student if attempts[0].status_code == 200 else outsider
    assert (await client.get(f"/api/v1/boards/{board_id}", headers=winning_headers)).json()["role"] == "editor"
    assert (await client.post(links, headers=winning_headers, json={"role": "viewer"})).status_code == 403
    assert (await client.get(links, headers=owner)).json() == []

    second = (await client.post(links, headers=owner, json={"role": "viewer"})).json()
    accepted = await client.post(redeem, headers=winning_headers, json={"token": second["token"]})
    assert accepted.json()["role"] == "editor"
    revoke = f"/api/v1/share-links/{second['id']}"
    assert (await client.delete(revoke, headers=winning_headers)).status_code == 403
    assert (await client.delete(revoke, headers=owner)).status_code == 204
    assert (await client.post(redeem, headers=student, json={"token": second["token"]})).status_code == 404


@pytest.mark.asyncio
async def test_profile_changes_persist_for_current_account(client):
    _, teacher = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    profile = "/api/v1/account/profile"
    assert (await client.get(profile)).status_code == 401
    settings = {"display_name": "Updated name", "theme": "light",
                "compact_ui": True, "default_board_zoom": 125}
    details = {"first_name": "Anna", "last_name": "Example", "middle_name": "",
               "phone": "+7 900 000 00 00", "city": "Moscow",
               "organization": "School", "focus_area": "Math"}
    responses = await asyncio.gather(
        client.put(profile + "/settings", headers=teacher, json=settings),
        client.put(profile + "/details", headers=teacher, json=details),
    )
    assert [response.status_code for response in responses] == [204, 204]
    assert (await client.get(profile, headers=teacher)).json() == {**settings, **details}
    assert (await client.get(profile, headers=student)).json()["phone"] == ""
    assert (await client.get("/api/v1/auth/me", headers=teacher)).json()["user_metadata"]["display_name"] == "Updated name"

@pytest.mark.asyncio
async def test_health_and_login_session_rotation(client):
    health = await client.get("/api/v1/health")
    assert health.status_code == 200
    assert health.json()["ok"] is True

    unauthorized = await client.get("/api/v1/boards")
    assert unauthorized.status_code == 401
    wrong_password = await client.post(
        "/api/v1/auth/login",
        json={"email": "teacher@example.test", "password": "wrong"},
    )
    assert wrong_password.status_code == 401

    login, headers = await sign_in(client, "teacher@example.test")
    assert login["user"]["account_role"] == "teacher"
    assert (await client.get("/api/v1/auth/me", headers=headers)).status_code == 200

    refresh = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": login["refresh_token"]},
    )
    assert refresh.status_code == 200
    assert (await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]}
    )).status_code == 401, "A refresh token must be single-use"
    assert (await client.get("/api/v1/auth/me", headers=headers)).status_code == 401
    newer = {"Authorization": "Bearer " + refresh.json()["access_token"]}
    assert (await client.get("/api/v1/auth/me", headers=newer)).status_code == 200
    assert (await client.post("/api/v1/auth/logout", headers=newer)).status_code == 200
    assert (await client.get("/api/v1/auth/me", headers=newer)).status_code == 401

@pytest.mark.asyncio
async def test_board_access_and_conflict_free_save(client):
    _, teacher = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    _, outsider = await sign_in(client, "outsider@example.test")

    created = await client.post(
        "/api/v1/boards", json={"title": "Урок химии"}, headers=teacher
    )
    assert created.status_code == 201, created.text
    board_id = created.json()["id"]
    url = f"/api/v1/boards/{board_id}"
    assert created.json()["role"] == "owner"
    assert (await client.get(url, headers=outsider)).status_code == 404
    assert (await client.get(url+"/document", headers=outsider)).status_code == 404
    assert (await client.get(url+"/document", headers=teacher)).json()["version"] == 0

    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'viewer')",
            UUID(board_id), STUDENT,
        )

    assert (await client.get(url, headers=student)).json()["role"] == "viewer"
    assert (await client.get(url+"/document", headers=student)).status_code == 200

    doc = {"version": 1, "title": "Урок химии", "items": [
        {"id": "teacher-note", "kind": "text", "text": "Важно"}
    ], "ink": []}
    blocked = await client.put(
        url+"/document", headers=student,
        json={"expected_version": 0, "document": doc},
    )
    assert blocked.status_code == 403

    saved = await client.put(
        url+"/document", headers=teacher,
        json={"expected_version": 0, "document": doc},
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["version"] == 1
    assert saved.json()["document"] == doc
    assert (await client.get(url+"/document", headers=student)).json()["document"] == doc

    conflict = await client.put(
        url+"/document", headers=teacher,
        json={"expected_version": 0, "document": doc},
    )
    assert conflict.status_code == 409

    async with app.state.pool.acquire() as conn:
        await conn.execute(
            """UPDATE board_members SET role='editor'
               WHERE board_id=$1 AND user_id=$2""",
            UUID(board_id), STUDENT,
        )
    doc2 = {**doc, "items": doc["items"] + [{"id": "student-note", "kind": "text"}]}
    editor_save = await client.put(
        url+"/document", headers=student,
        json={"expected_version": 1, "document": doc2},
    )
    assert editor_save.status_code == 200, editor_save.text
    assert editor_save.json()["version"] == 2
    assert editor_save.json()["updated_by"] == str(STUDENT)

    # The ordinary document endpoint must preserve the full native Lektrus
    # JSON shape, including subject-specific object payloads, not just pilot ink.
    native_document = {
        "version": 1,
        "title": "Химия: нативная доска",
        "subject": "chemistry",
        "view": {"x": 12.5, "y": -8.25, "zoom": 1.2},
        "items": [
            {"id": "native-text", "kind": "text", "x": 20, "y": 30,
             "width": 240, "height": 80, "text": "Закон сохранения массы",
             "fontSize": 22, "textAlign": "left"},
            {"id": "native-chart", "kind": "graph", "x": 300, "y": 40,
             "width": 420, "height": 260, "text": "",
             "graphFigureId": "lektrus-chart", "chartStyle": "bar",
             "chartEntries": [{"label": "Опыт 1", "value": 12.5},
                              {"label": "Опыт 2", "value": 18}]},
        ],
    }
    native_save = await client.put(
        url+"/document", headers=teacher,
        json={"expected_version": 2, "document": native_document},
    )
    assert native_save.status_code == 200, native_save.text
    assert native_save.json()["version"] == 3
    assert native_save.json()["document"] == native_document
    native_reload = await client.get(url+"/document", headers=student)
    assert native_reload.json()["document"] == native_document

    listed = await client.get("/api/v1/boards", headers=student)
    assert listed.status_code == 200
    assert [b["id"] for b in listed.json()] == [board_id]

    renamed = await client.patch(url,headers=teacher,json={"title":"Урок химии: итог"})
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["title"] == "Урок химии: итог"
    assert (await client.patch(url,headers=student,
                               json={"title":"Чужое название"})).status_code == 403
    assert (await client.delete(url,headers=student)).status_code == 403
    trashed = await client.delete(url,headers=teacher)
    assert trashed.status_code == 200 and trashed.json()["ok"] is True
    assert (await client.get(url,headers=teacher)).status_code == 404
    assert (await client.get("/api/v1/boards",headers=teacher)).json() == []

@pytest.mark.asyncio
async def test_payload_limits_and_unconfirmed_accounts(client, monkeypatch):
    _, teacher = await sign_in(client, "teacher@example.test")
    created = await client.post(
        "/api/v1/boards", json={"title": "Тест ограничений"}, headers=teacher
    )
    board_id = created.json()["id"]
    url = f"/api/v1/boards/{board_id}/document"
    assert (await client.put(
        url, headers=teacher,
        json={"expected_version": 0, "document": {"ink": "not-an-array", "items": []}},
    )).status_code == 422
    # Keep the test small while proving the server enforces its configured
    # native-document byte ceiling (24 MiB in production).
    monkeypatch.setattr("app.MAX_DOCUMENT_BYTES",256)
    assert (await client.put(
        url, headers=teacher,
        json={"expected_version": 0, "document": {"items": [{"id": "x"}],
                                                    "ink": [], "title": "a" * 300}},
    )).status_code == 413

    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "UPDATE account_users SET email_confirmed_at=NULL WHERE id=$1", STUDENT
        )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "student@example.test", "password": PASSWORD},
    )
    assert response.status_code == 401
