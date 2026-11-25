"""Integration tests for the server-authoritative Lektrus admin panel."""
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import asyncpg
import pytest

from app import app
from test_api import TEACHER, STUDENT, OUTSIDER, client, sign_in
import feedback_mail
import telegram_editor
import asyncio
import admin as admin_module


@pytest.mark.asyncio
async def test_site_news_editor_publication_and_access(client):
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET is_admin=true WHERE id=$1", TEACHER)
    _, administrator = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    public, manage = "/api/v1/news", "/api/v1/admin/news"
    seeded = (await client.get(public+"?category=announcement")).json()
    assert {"Анатомия человека", "Виртуальный микроскоп", "Программирование на доске"} <= {row["title"] for row in seeded}
    archive = (await client.get(public+"?limit=50")).json()
    assert len(archive) >= 16
    historical = next(row for row in archive if row["title"] == "Геометрические построения")
    assert historical["published_at"].startswith("2026-10-24")
    payload = {"title":"Анонс для теста", "category":"announcement", "summary":"Краткое описание", "body":"Подробности\nСледующая строка", "version":"1.2", "published":False}
    assert (await client.get(manage)).status_code == 401
    assert (await client.get(manage, headers=student)).status_code == 403
    assert (await client.post(manage, json=payload, headers=student)).status_code == 403
    result = await client.post(manage, json=payload, headers=administrator)
    assert result.status_code == 201, result.text
    article = result.json()
    article_id = article["id"]
    target = manage + "/" + article_id
    assert article["published_at"] is None
    assert article_id not in [entry["id"] for entry in (await client.get(public)).json()]
    assert article_id in [entry["id"] for entry in (await client.get(manage, headers=administrator)).json()]
    assert (await client.put(target, headers=student, json={**payload,"published":True})).status_code == 403
    assert (await client.put(target, headers=administrator, json={**payload,"summary":" ","published":True})).status_code == 422
    publish = await client.put(target, headers=administrator, json={**payload,"published":True})
    assert publish.status_code == 200, publish.text
    published_at = publish.json()["published_at"]
    rows = (await client.get(public+"?category=announcement")).json()
    current = next(row for row in rows if row["id"] == article_id)
    assert current["body"] == payload["body"] and current["published_at"] == published_at
    assert "created_at" not in current and "updated_at" not in current
    assert article_id not in [row["id"] for row in (await client.get(public+"?category=feature")).json()]
    edited = await client.put(target, headers=administrator, json={**payload,"title":"Уточнённый анонс","published":True})
    assert edited.json()["published_at"] == published_at
    assert (await client.get(public+"?limit=51")).status_code == 422
    archived = await client.put(target, headers=administrator, json=payload)
    assert archived.status_code == 200 and archived.json()["published_at"] is None
    assert article_id not in [row["id"] for row in (await client.get(public)).json()]


@pytest.mark.asyncio
async def test_global_interface_layout_is_shared_and_admin_write_only(client):
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET is_admin=true WHERE id=$1", TEACHER)
    _, admin = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    _, other = await sign_in(client, "outsider@example.test")
    read_url = "/api/v1/interface-layout"
    write_url = "/api/v1/admin/interface-layout"
    assert (await client.get(read_url)).json() == {"layout": None}
    design = {"version": 1, "profiles": {
        "desktop": {"toolbar": {"x": 4, "y": 0, "scale": 1}},
        "phonePortrait": {"toolbar": {"x": 0, "y": 5, "scale": 0.9}},
        "phone": {"toolbar": {"x": 0, "y": -5, "scale": 1.1}},
    }, "controls": {}, "extras": {}}
    payload = {"layout": design}
    assert (await client.put(write_url, json=payload)).status_code == 401
    assert (await client.put(write_url, json=payload, headers=student)).status_code == 403
    assert (await client.put(write_url, json={"layout": {}}, headers=admin)).status_code == 422
    assert (await client.put(write_url, json=payload, headers=admin)).status_code == 200
    for headers in (admin, student, other, {}):
        assert (await client.get(read_url, headers=headers)).json() == payload
    design["profiles"]["desktop"]["toolbar"]["x"] = -2
    assert (await client.put(write_url, json=payload, headers=admin)).status_code == 200
    assert (await client.get(read_url, headers=other)).json() == payload
    async with app.state.pool.acquire() as conn:
        assert await conn.fetchval("select count(*) from global_interface_layout") == 1


@pytest.mark.asyncio
async def test_admin_sends_only_selected_mail_templates(client, monkeypatch):
    """Real builders and an SMTP stub: never create live accounts or send live mail."""
    monkeypatch.setattr(admin_module, "_test_mail_attempts", admin_module.deque())
    monkeypatch.setattr(admin_module, "_test_mail_active", False)
    monkeypatch.setattr(feedback_mail, "server_mail_config", lambda: (
        "smtp.example.test", 465, "system", "test-password", "system@example.test", "https://lektrus.example"))
    sent = []
    sessions = []
    class DummySMTP:
        def __init__(self, host, port, **kwargs):
            assert (host,port)==("smtp.example.test",465)
            sessions.append(self)
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def login(self, username, password): assert (username,password)==("system","test-password")
        def send_message(self, msg):
            sent.append(msg)
            if "Ответ Lektrus" in msg["Subject"]:
                raise OSError("test refusal")
            return {}
    monkeypatch.setattr(feedback_mail.smtplib, "SMTP_SSL", DummySMTP)
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET is_admin=true WHERE id=$1", TEACHER)
    _, admin = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    url = "/api/v1/admin/feedback-mail/test"
    payload = {"email":"recipient@example.test","kinds":["confirmation","reply"]}
    assert (await client.post(url,json=payload)).status_code == 401
    assert (await client.post(url,json=payload,headers=student)).status_code == 403
    for invalid in ({"email":"invalid","kinds":["confirmation"]},{**payload,"kinds":[]},{**payload,"kinds":["unknown"]},{**payload,"email":"a@example.test,b@example.test"}):
        assert (await client.post(url,json=invalid,headers=admin)).status_code == 422
    response = await client.post(url,json=payload,headers=admin)
    assert response.status_code == 200, response.text
    assert response.json() == {"email":"recipient@example.test","results":[
        {"kind":"confirmation","status":"sent"},{"kind":"reply","status":"failed"}]}
    assert len(sessions)==1 and len(sent)==2
    for message in sent:
        assert message["To"]=="recipient@example.test"
        assert str(message["Subject"]).startswith("[ТЕСТ] ")
        html = message.get_body(preferencelist=("html",)).get_content()
        assert 'bgcolor="#173961"' in html
        assert "token=" not in html and "password-reset=" not in html
    all_kinds = ["confirmation","password_reset","notification","reply"]
    for _ in range(2):
        result = await client.post(url,json={**payload,"kinds":all_kinds},headers=admin)
        assert result.status_code == 200 and len(result.json()["results"])==4
    assert (await client.post(url,json={**payload,"kinds":all_kinds},headers=admin)).status_code == 429
    async with app.state.pool.acquire() as conn:
        assert await conn.fetchval("SELECT count(*) FROM account_users WHERE email='recipient@example.test'")==0
        assert await conn.fetchval("SELECT count(*) FROM product_feedback")==0
        assert await conn.fetchval("SELECT count(*) FROM feedback_mail")==0


@pytest.mark.asyncio
async def test_feedback_mail_delivery_reply_permissions_and_retry(client, monkeypatch):
    monkeypatch.setenv("LEKTRUS_FEEDBACK_TO", "admin@example.test")
    sent = []
    async def capture(row):
        sent.append(dict(row))
    monkeypatch.setattr(feedback_mail, "send_feedback_email", capture)
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET is_admin=true WHERE id=$1", TEACHER)
    _, admin = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    payload = {"name":"Гость", "email":"visitor@example.test", "topic":"Предложение",
               "message":"<script>alert(1)</script>\nТекст обращения", "source":"app"}
    invalid = await client.post("/api/v1/feedback", json={**payload,"email":"visitor@example.test,other@example.test"})
    assert invalid.status_code == 422
    submitted = await client.post("/api/v1/feedback", json=payload)
    assert submitted.status_code == 201, submitted.text
    feedback_id = submitted.json()["id"]
    url = f"/api/v1/admin/feedback/{feedback_id}/reply"
    reply = {"request_id":str(uuid4()), "message":"Спасибо!\nУчтём предложение."}
    assert (await client.post(url,json=reply)).status_code == 401
    assert (await client.post(url,headers=student,json=reply)).status_code == 403
    assert (await client.get("/api/v1/admin/feedback-mail",headers=student)).status_code == 403
    assert await feedback_mail.deliver_one(app.state.pool)
    assert sent[0]["recipient"] == "admin@example.test"
    message = feedback_mail.build_feedback_email(sent[0],"support@example.test","https://lektrus.ru")
    html = message.get_body(preferencelist=("html",)).get_content()
    assert "Lektrus" in html and "role=\"presentation\"" in html and "border-radius" in html
    assert "&lt;script&gt;" in html and "<script>" not in html
    assert message.get_body(preferencelist=("plain",)).get_content()
    inbox = (await client.get("/api/v1/admin/feedback",headers=admin)).json()
    assert inbox[0]["notification_status"] == "sent"
    for _ in range(2):
        result = await client.post(url,headers=admin,json=reply)
        assert result.status_code == 202, result.text
    outbox = (await client.get("/api/v1/admin/feedback-mail",headers=admin)).json()
    assert len(outbox) == 1 and outbox[0]["recipient"] == payload["email"]
    assert outbox[0]["status"] == "pending"
    async def fail(_row):
        raise OSError("SMTP unavailable")
    monkeypatch.setattr(feedback_mail,"send_feedback_email",fail)
    for _ in range(3):
        async with app.state.pool.acquire() as conn:
            await conn.execute("UPDATE feedback_mail SET send_after=now() WHERE id=$1", UUID(reply["request_id"]))
        assert await feedback_mail.deliver_one(app.state.pool)
    outbox = (await client.get("/api/v1/admin/feedback-mail",headers=admin)).json()
    assert outbox[0]["status"] == "failed" and outbox[0]["attempts"] == 3
    retry = f"/api/v1/admin/feedback-mail/{reply['request_id']}/retry"
    assert (await client.post(retry,headers=student)).status_code == 403
    assert (await client.post(retry,headers=admin)).status_code == 202
    monkeypatch.setattr(feedback_mail,"send_feedback_email",capture)
    assert await feedback_mail.deliver_one(app.state.pool)
    assert sent[-1]["recipient"] == payload["email"]
    assert (await client.post(retry,headers=admin)).status_code == 409
    outbox = (await client.get("/api/v1/admin/feedback-mail",headers=admin)).json()
    assert outbox[0]["status"] == "sent"


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
        json={"plan": "pro", "until": until},
    )
    assert grant.status_code == 200, grant.text
    async with app.state.pool.acquire() as conn:
        plan = await conn.fetchrow(
            "SELECT subscription_plan,subscription_until FROM account_users WHERE id=$1",
            OUTSIDER,
        )
    assert plan["subscription_plan"] == "pro"
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


@pytest.mark.asyncio
async def test_maintenance_schedule_exceptions_and_automatic_end(client):
    from app import lookup_board_sessions
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET is_admin=true WHERE id=$1", TEACHER)
    admin_data, admin = await sign_in(client, "teacher@example.test")
    selected_data, selected = await sign_in(client, "student@example.test")
    ordinary_data, ordinary = await sign_in(client, "outsider@example.test")
    path, status = "/api/v1/admin/maintenance", "/api/v1/maintenance"
    now = datetime.now(timezone.utc)
    config = {"starts_at": (now + timedelta(hours=1)).isoformat(),
              "ends_at": (now + timedelta(hours=2)).isoformat(),
              "notice": "Обновляем Lektrus", "allowed_accounts": [str(STUDENT)]}
    assert (await client.get(status)).json()["state"] == "off"
    assert (await client.put(path, json=config, headers=ordinary)).status_code == 403
    assert (await client.put(path, json={**config,"ends_at":now.isoformat()}, headers=admin)).status_code == 422
    response = await client.put(path, json=config, headers=admin)
    assert response.status_code == 200, response.text
    public = (await client.get(status)).json()
    assert public["state"] == "scheduled" and public["notice"] == config["notice"]
    assert "allowed_accounts" not in public and public["access_allowed"]
    board_id = UUID((await client.post("/api/v1/boards", headers=admin, json={"title":"Maintenance test"})).json()["id"])
    async with app.state.pool.acquire() as conn:
        await conn.execute("INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'viewer'),($1,$3,'viewer')", board_id, STUDENT, OUTSIDER)
    assert (await client.get("/api/v1/boards", headers=ordinary)).status_code == 200
    # Passing the scheduled start needs no process restart or manual action.
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE service_maintenance SET starts_at=now()-interval '1 minute'")
    for headers in (admin, selected):
        assert (await client.get(status, headers=headers)).json()["access_allowed"]
        assert (await client.get("/api/v1/boards", headers=headers)).status_code == 200
    for headers in (ordinary, {}, {"Authorization":"Bearer bogus"}):
        public = (await client.get(status, headers=headers)).json()
        assert public["state"] == "active" and not public["access_allowed"]
        denied = await client.get("/api/v1/boards", headers=headers)
        assert denied.status_code == 503 and denied.json()["code"] == "maintenance"
    assert (await client.post("/api/v1/auth/signup", json={})).status_code == 503
    assert (await client.get("/api/v1/health")).status_code == 200
    assert (await client.get("/api/v1/news")).status_code == 200
    assert (await client.get("/api/v1/auth/me", headers=ordinary)).status_code == 200
    _, relogin = await sign_in(client, "outsider@example.test")
    assert not (await client.get(status, headers=relogin)).json()["access_allowed"]
    tokens = [admin_data["access_token"], selected_data["access_token"], ordinary_data["access_token"]]
    rows = await lookup_board_sessions(app.state.pool, board_id, tokens)
    assert set(rows) == set(tokens[:2])
    # Removing the account from the allowlist applies immediately.
    response = await client.put(path, headers=admin, json={**config,
        "starts_at": (now-timedelta(minutes=1)).isoformat(), "allowed_accounts":[]})
    assert response.status_code == 200, response.text
    assert (await client.get("/api/v1/boards", headers=selected)).status_code == 503
    assert (await client.get(path, headers=admin)).status_code == 200
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE service_maintenance SET ends_at=now()-interval '1 second'")
    assert (await client.get(status)).json()["state"] == "off"
    assert (await client.get("/api/v1/boards", headers=ordinary)).status_code == 200
    assert (await client.put(path, headers=admin, json={"allowed_accounts":[]})).status_code == 200

# Included by the existing explicit integration-suite file list.
from test_billing import (test_free_concurrent_board_limit_manual_pro_and_downgrade,
    test_group_and_storage_limits, test_finance_admin_only_and_manual_grants_not_revenue, test_pro_storage_limit)

@pytest.mark.asyncio
async def test_telegram_editor_access_queue_and_no_duplicate(client, monkeypatch):
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET is_admin=true WHERE id=$1", TEACHER)
        await conn.execute("DELETE FROM telegram_posts")
        await conn.execute("""UPDATE telegram_editor_settings SET auto_news=false,auto_maintenance=false,auto_publish=false,
            verified_chat_id=NULL,verified_bot_id=NULL,verified_channel=NULL,bot_username=NULL WHERE singleton""")
    _, administrator = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    path = "/api/v1/admin/telegram"
    monkeypatch.delenv("LEKTRUS_TELEGRAM_BOT_TOKEN", raising=False)
    assert (await client.get(path, headers=student)).status_code == 403
    assert (await client.post(path+"/posts", headers=student, json={"text":"Test"})).status_code == 403
    draft = await client.post(path+"/posts",headers=administrator,json={"text":"Новые функции Lektrus"})
    assert draft.status_code == 201, draft.text
    post = path+"/posts/"+draft.json()["id"]
    assert (await client.post(post+"/schedule",headers=administrator,json={})).status_code == 409
    monkeypatch.setenv("LEKTRUS_TELEGRAM_BOT_TOKEN","123:fake_token")
    monkeypatch.setenv("LEKTRUS_TELEGRAM_CHANNEL","@lektrus")
    sent = []
    async def fake_api(method, **kwargs):
        if method == "getMe":
            return {"id":123,"username":"lektrus_test_bot"}
        if method == "getChat":
            return {"id":-100123,"type":"channel","username":"lektrus"}
        if method == "getChatMember":
            return {"status":"administrator","can_post_messages":True}
        assert method == "sendMessage"
        sent.append(kwargs["json"]["text"])
        return {"message_id":1234}
    monkeypatch.setattr(telegram_editor,"telegram_api",fake_api)
    assert (await client.post(path+"/verify",headers=administrator)).status_code == 200
    assert (await client.post(post+"/schedule",headers=administrator,json={})).status_code == 200
    await asyncio.gather(telegram_editor.deliver_one(app.state.pool),telegram_editor.deliver_one(app.state.pool))
    assert sent == ["Новые функции Lektrus"]
    overview = (await client.get(path,headers=administrator)).json()
    assert overview["posts"][0]["status"] == "sent"
    assert overview["posts"][0]["telegram_message_id"] == 1234
    assert "fake_token" not in str(overview)
    assert (await client.post(post+"/schedule",headers=administrator,json={})).status_code == 409
    assert not await telegram_editor.deliver_one(app.state.pool)
    assert (await client.put(path+"/settings",headers=administrator,json={"auto_news":True})).status_code == 200
    await telegram_editor.collect_automatic(app.state.pool)
    async with app.state.pool.acquire() as conn:
        await conn.execute("""INSERT INTO site_news(category,title,summary,body,published_at)
            VALUES('update','Тест новой новости','Краткое описание','Текст',now())""")
    await telegram_editor.collect_automatic(app.state.pool)
    await telegram_editor.collect_automatic(app.state.pool)
    overview = (await client.get(path,headers=administrator)).json()
    auto = [p for p in overview["posts"] if p["source_kind"]=="news"]
    assert len(auto)==1 and auto[0]["status"]=="draft"
    assert "Тест новой новости" in auto[0]["text"]
    assert (await client.post(path+"/posts/"+auto[0]["id"]+"/schedule",headers=administrator,json={})).status_code==200
    async def uncertain_api(method, **kwargs):
        if method == "sendMessage":
            raise telegram_editor.Unknown("timeout")
        return await fake_api(method,**kwargs)
    monkeypatch.setattr(telegram_editor,"telegram_api",uncertain_api)
    assert await telegram_editor.deliver_one(app.state.pool)
    assert not await telegram_editor.deliver_one(app.state.pool)
    overview=(await client.get(path,headers=administrator)).json()
    assert next(p for p in overview["posts"] if p["id"]==auto[0]["id"])["status"]=="unknown"
    async with app.state.pool.acquire() as conn:
        await conn.execute("DELETE FROM site_news WHERE title='Тест новой новости'")
        await conn.execute("DELETE FROM telegram_posts")
        await conn.execute("UPDATE telegram_editor_settings SET auto_news=false,auto_maintenance=false,auto_publish=false,verified_chat_id=NULL,verified_bot_id=NULL,verified_channel=NULL WHERE singleton")


@pytest.mark.asyncio
async def test_storage_diagnostics_and_exact_personal_quota(client):
    _, owner = await sign_in(client,"teacher@example.test")
    _, student = await sign_in(client,"student@example.test")
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET is_admin=true WHERE id=$1", OUTSIDER)
    _, admin = await sign_in(client,"outsider@example.test")
    path="/api/v1/admin/storage"
    assert (await client.get(path,headers=student)).status_code==403
    assert (await client.get(path)).status_code==401
    board=UUID((await client.post("/api/v1/boards",headers=owner,json={"title":"Storage diagnostic"})).json()["id"])
    async with app.state.pool.acquire() as conn:
        await conn.execute("""INSERT INTO board_assets(board_id,asset_id,storage_name,content_type,size_bytes,sha256,created_by)
            VALUES($1,'storage-test',$2,'image/png',1024,$3,$4)""",board,uuid4(),"0"*64,STUDENT)
        await conn.execute("""INSERT INTO learning_materials(id,owner_id,title,file_name,mime,size_bytes,storage_name)
            VALUES($1,$2,'File','file.png','image/png',2048,$3)""",uuid4(),TEACHER,uuid4())
        await conn.execute("""INSERT INTO board_templates(id,owner_id,title,document,assets)
            VALUES($1,$2,'Template','{}'::jsonb,'[{"size":512}]'::jsonb)""",uuid4(),TEACHER)
        enforced=await conn.fetchval("SELECT billing_storage($1)",TEACHER)
    response=await client.get("/api/v1/billing",headers=owner)
    assert response.status_code==200,response.text
    personal=response.json()["storage"]
    assert personal=={"used_bytes":3584,"limit_bytes":262144000,"remaining_bytes":262144000-3584,
                      "board_bytes":1024,"material_bytes":2048,"template_bytes":512}
    assert response.json()["usage"]["storage_bytes"]==enforced==personal["used_bytes"]
    assert (await client.get("/api/v1/billing",headers=student)).json()["storage"]["used_bytes"]==0
    report=await client.get(path,headers=admin)
    assert report.status_code==200,report.text
    report=report.json()
    assert report["database_bytes"]>0
    assert report["wal_bytes"] is None or report["wal_bytes"]>=0
    assert report["offset"]==0 and not report["has_more"]
    assert "board_history" in [t["name"] for t in report["tables"]]
    assert all(t["total_bytes"]>=t["data_bytes"] and t["total_bytes"]>=t["index_bytes"] for t in report["tables"])
    row=next(u for u in report["users"] if u["id"]==str(TEACHER))
    assert all(row[k]==v for k,v in personal.items())
    assert next(u for u in report["users"] if u["id"]==str(OUTSIDER))["limit_bytes"] is None
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET subscription_plan='pro',subscription_until=now()+interval '1 day' WHERE id=$1",TEACHER)
    pro=(await client.get("/api/v1/billing",headers=owner)).json()["storage"]
    assert pro["limit_bytes"]==5368709120 and pro["used_bytes"]==personal["used_bytes"]
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET subscription_until=now()-interval '1 day' WHERE id=$1",TEACHER)
    assert (await client.get("/api/v1/billing",headers=owner)).json()["storage"]==personal
    assert (await client.get(path+"?offset=-1",headers=admin)).status_code==422


@pytest.mark.asyncio
async def test_expired_guest_cleanup_preserves_shared_content_and_history(client):
    _, owner=await sign_in(client,"teacher@example.test")
    _, student=await sign_in(client,"student@example.test")
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET is_admin=true WHERE id=$1",OUTSIDER)
    _, admin=await sign_in(client,"outsider@example.test")
    target=(await client.post("/api/v1/boards",headers=owner,json={"title":"Guest cleanup"})).json()["id"]
    root=f"/api/v1/boards/{target}"
    link=(await client.post(root+"/share-links",headers=owner,json={"role":"editor"})).json()
    guests=[]
    for name in ("Historic Guest","Empty Guest","Active Guest"):
        response=await client.post("/api/v1/auth/guest",json={"token":link["token"],"name":name})
        assert response.status_code==200,response.text
        guests.append(response.json())
    historical,empty,active=[UUID(g["user"]["id"]) for g in guests]
    guest={"Authorization":"Bearer "+guests[0]["access_token"]}
    assert (await client.put(root+"/document",headers=guest,json={"expected_version":0,"document":{"version":1,"items":[{"id":"ink","kind":"pen","createdBy":str(historical)}]}})).status_code==200
    assert (await client.post(root+"/visits",headers=guest,json={"visit_id":str(uuid4()),"action":"ping"})).status_code==200
    assert (await client.post(root+"/comments",headers=guest,json={"body":"Preserve this comment"})).status_code==201
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET guest_expires_at=now()-interval '10 minutes' WHERE id=ANY($1::uuid[])",[historical,empty])
    path="/api/v1/admin/storage"
    before=(await client.get(path,headers=admin)).json()
    assert before["guests"]["access_hours"]==72
    assert before["guests"]["active"]==1 and before["guests"]["expired"]==2 and before["guests"]["pending"]==2
    assert not any(u["id"] in [str(historical),str(empty),str(active)] for u in before["users"])
    assert (await client.post(path+"/cleanup-guests",headers=student)).status_code==403
    result=await client.post(path+"/cleanup-guests",headers=admin)
    assert result.status_code==200,result.text
    assert result.json()=={"processed":2,"deleted":2,"retained":0}
    assert (await client.post(path+"/cleanup-guests",headers=admin)).json()=={"processed":0,"deleted":0,"retained":0}
    async with app.state.pool.acquire() as conn:
        assert not await conn.fetchval("SELECT EXISTS(SELECT 1 FROM account_users WHERE id=$1)",empty)
        assert not await conn.fetchval("SELECT EXISTS(SELECT 1 FROM account_users WHERE id=$1)",historical)
        assert await conn.fetchval("SELECT EXISTS(SELECT 1 FROM board_visits WHERE user_id=$1 AND account_user_id IS NULL)",historical)
        assert await conn.fetchval("SELECT EXISTS(SELECT 1 FROM board_comments WHERE author_id=$1 AND account_user_id IS NULL)",historical)
        assert await conn.fetchval("SELECT EXISTS(SELECT 1 FROM account_users WHERE id=$1)",active)
        assert not await conn.fetchval("SELECT EXISTS(SELECT 1 FROM account_sessions WHERE user_id=$1)",historical)
        assert not await conn.fetchval("SELECT EXISTS(SELECT 1 FROM board_members WHERE user_id=$1)",historical)
    assert (await client.get(root+"/document",headers=owner)).json()["document"]["items"][0]["id"]=="ink"
    assert (await client.get(root+"/comments",headers=owner)).json()[0]["body"]=="Preserve this comment"
    assert (await client.get(root+"/visits",headers=owner)).json()[0]["user_name"]=="Historic Guest"
    assert (await client.get(root,headers={"Authorization":"Bearer "+guests[2]["access_token"]})).status_code==200
    after=(await client.get(path,headers=admin)).json()
    assert after["guests"]["pending"]==0 and after["guests"]["historical"]==0
    assert any(d["current"] and d["bytes"]>0 for d in after["databases"])
