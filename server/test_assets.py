"""Authenticated Storage checks using synthetic files and a disposable Postgres."""
import hashlib
from uuid import UUID

import pytest

import assets
from app import app
from test_api import TEACHER, STUDENT, OUTSIDER, client, sign_in


@pytest.mark.asyncio
async def test_personal_templates_keep_assets_and_isolate_owners(client, tmp_path, monkeypatch):
    monkeypatch.setenv("LEKTRUS_ASSETS_DIR", str(tmp_path / "private-files"))
    _, owner = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    async with app.state.pool.acquire() as conn:
        await conn.execute("update account_users set account_role='teacher',teacher_status='approved' where id=$1", OUTSIDER)
    _, other = await sign_in(client, "outsider@example.test")
    base = "/api/v1/board-templates"
    assert (await client.get(base, headers=owner)).json() == []
    assert (await client.get(base, headers=student)).status_code == 403
    source = (await client.post("/api/v1/boards", json={"title": "Мой урок"}, headers=owner)).json()["id"]
    copied = (await client.post("/api/v1/boards", json={"title": "Копия"}, headers=owner)).json()["id"]
    asset_url = f"/api/v1/boards/{source}/assets/photo"
    content = b"\x89PNG\r\n\x1a\n" + b"template-photo"
    assert (await client.post(asset_url, content=content, headers={**owner,"Content-Type":"image/png"})).status_code == 201
    document = {"version":1,"title":"Мой урок","items":[{"id":"i","kind":"image","assetId":"photo"}]}
    payload = {"board_id":source,"title":"Личный шаблон","document":document}
    assert (await client.post(base, json=payload, headers=other)).status_code == 404
    result = await client.post(base, json=payload, headers=owner)
    assert result.status_code == 201, result.text
    template = result.json()
    path = f'{base}/{template["id"]}'
    assert template["document"] == document
    assert (await client.get(base, headers=other)).json() == []
    assert (await client.delete(path, headers=other)).status_code == 404
    assert (await client.post(path+"/copy-assets", json={"board_id":copied}, headers=other)).status_code == 404
    # Source attachment deletion must not break the reusable snapshot.
    assert (await client.delete(asset_url, headers=owner)).status_code == 204
    for _ in range(2):
        response = await client.post(path+"/copy-assets", json={"board_id":copied}, headers=owner)
        assert response.status_code == 200, response.text
    assert (await client.post(path+"/used", headers=owner)).status_code == 200
    assert (await client.get(base, headers=owner)).json()[0]["use_count"] == 1
    assert (await client.delete(path, headers=owner)).status_code == 204
    assert (await client.get(base, headers=owner)).json() == []
    # Deleting the template must not remove attachments in a board made from it.
    assert (await client.get(f"/api/v1/boards/{copied}/assets/photo", headers=owner)).content == content


@pytest.mark.asyncio
async def test_board_assets_permissions_streaming_and_etag(client, tmp_path, monkeypatch):
    monkeypatch.setenv("LEKTRUS_ASSETS_DIR", str(tmp_path / "private-files"))
    _, teacher = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    _, outsider = await sign_in(client, "outsider@example.test")
    board = await client.post(
        "/api/v1/boards", json={"title": "Файлы урока"}, headers=teacher
    )
    assert board.status_code == 201
    board_id = board.json()["id"]
    base = f"/api/v1/boards/{board_id}/assets"
    url = base + "/image_1"
    body = b"\x89PNG\r\n\x1a\n" + b"image-content" * 30

    assert (await client.get(url)).status_code == 401
    preflight = await client.options(url, headers={
        "Origin": "https://lektrus.example",
        "Access-Control-Request-Method": "HEAD",
        "Access-Control-Request-Headers": "authorization",
    })
    assert preflight.status_code == 200, preflight.text
    assert "HEAD" in preflight.headers.get("access-control-allow-methods", "")
    assert preflight.headers.get("access-control-allow-origin") == "https://lektrus.example"
    assert (await client.get(url, headers=outsider)).status_code == 404
    assert (await client.head(url, headers=outsider)).status_code == 404
    assert (await client.post(
        url, headers={**outsider, "Content-Type": "image/png"}, content=body
    )).status_code == 404

    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'viewer')",
            UUID(board_id), STUDENT,
        )

    viewer_upload = await client.post(
        url, headers={**student, "Content-Type": "image/png"}, content=body
    )
    assert viewer_upload.status_code == 403
    viewer_delete = await client.delete(url, headers=student)
    assert viewer_delete.status_code == 403

    upload = await client.post(
        url, headers={**teacher, "Content-Type": "image/png"}, content=body
    )
    assert upload.status_code == 201, upload.text
    assert upload.json()["name"] == board_id + "/image_1"
    assert upload.json()["size_bytes"] == len(body)
    assert upload.json()["sha256"] == hashlib.sha256(body).hexdigest()

    files = await client.get(base, headers=student)
    assert files.status_code == 200
    assert len(files.json()) == 1
    assert files.json()[0]["name"] == board_id + "/image_1"
    assert (await client.get(base, headers=outsider)).status_code == 404

    fetched = await client.get(url, headers=student)
    assert fetched.status_code == 200, fetched.text
    assert fetched.content == body
    assert fetched.headers["content-type"] == "image/png"
    assert fetched.headers["vary"].lower() == "authorization"
    assert fetched.headers["cache-control"] == "private, no-cache"
    etag = fetched.headers["etag"]
    assert etag == '"' + hashlib.sha256(body).hexdigest() + '"'

    head = await client.head(url, headers=student)
    assert head.status_code == 200
    assert head.content == b""
    assert int(head.headers["content-length"]) == len(body)
    assert head.headers["etag"] == etag

    unchanged = await client.get(
        url, headers={**student, "If-None-Match": etag}
    )
    assert unchanged.status_code == 304
    assert unchanged.content == b""
    assert unchanged.headers["etag"] == etag

    partial = await client.get(
        url, headers={**teacher, "Range": "bytes=0-7"}
    )
    assert partial.status_code == 206, partial.text
    assert partial.content == body[:8]

    duplicate = await client.post(
        url, headers={**teacher, "Content-Type": "image/png"}, content=b"CHANGED"
    )
    assert duplicate.status_code == 409
    assert (await client.get(url, headers=teacher)).content == body

    # Access revocation must override even conditional/ETag requests.
    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM board_members WHERE board_id=$1 AND user_id=$2",
            UUID(board_id), STUDENT,
        )
    revoked = await client.get(
        url, headers={**student, "If-None-Match": etag}
    )
    assert revoked.status_code == 404

    # Editors may upload and delete, but readers may not.
    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'editor')",
            UUID(board_id), STUDENT,
        )
    editor = await client.post(
        base + "/image_2",
        headers={**student, "Content-Type": "image/webp"},
        content=b"RIFF" + b"test-data" * 8,
    )
    assert editor.status_code == 201
    assert (await client.delete(base + "/image_2", headers=student)).status_code == 204
    assert (await client.get(base + "/image_2", headers=teacher)).status_code == 404
    assert (await client.delete(url, headers=teacher)).status_code == 204
    assert (await client.get(url, headers=teacher)).status_code == 404
    assert (tmp_path / "private-files").is_dir()
    assert not list((tmp_path / "private-files").rglob(".incoming-*")), (
        "Temporary uploads must always be deleted"
    )


@pytest.mark.asyncio
async def test_board_asset_validation_and_quota(client, tmp_path, monkeypatch):
    monkeypatch.setenv("LEKTRUS_ASSETS_DIR", str(tmp_path / "private"))
    _, teacher = await sign_in(client, "teacher@example.test")
    board = await client.post("/api/v1/boards", json={"title": "Тест"}, headers=teacher)
    base = f"/api/v1/boards/{board.json()['id']}/assets/"
    assert (await client.post(
        base+"bad.ext", headers={**teacher, "Content-Type": "image/png"},
        content=b"contents"
    )).status_code == 404
    assert (await client.post(
        base+"a", headers={**teacher, "Content-Type": "text/html"},
        content=b"<script>bad()</script>"
    )).status_code == 415
    assert (await client.post(
        base+"a", headers={**teacher, "Content-Type": "image/png"},
        content=b""
    )).status_code in (413, 422)

    # Tests do not need to allocate or transmit fifty megabytes.
    monkeypatch.setattr(assets, "MAX_ASSET_BYTES", 64)
    over_limit = await client.post(
        base+"too_large", headers={**teacher, "Content-Type": "image/png"},
        content=b"x" * 65,
    )
    assert over_limit.status_code == 413
    assert (await client.get(base.rstrip("/"), headers=teacher)).json() == []

    svg = await client.post(
        base+"vector", headers={**teacher, "Content-Type": "image/svg+xml"},
        content=b"<svg xmlns='http://www.w3.org/2000/svg'></svg>",
    )
    assert svg.status_code == 201
    get_svg = await client.get(base+"vector", headers=teacher)
    assert get_svg.status_code == 200
    assert get_svg.headers["content-disposition"] == "attachment"
    assert get_svg.headers["content-security-policy"] == "sandbox"
    assert get_svg.headers["x-content-type-options"] == "nosniff"
