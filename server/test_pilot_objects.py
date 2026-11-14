"""Pilot object create/move contracts and concurrent PostgreSQL commits."""
import asyncio
from uuid import UUID, uuid4

import pytest

from app import app
from test_api import TEACHER, STUDENT, OUTSIDER, client, sign_in
from test_pilot_operations import new_pilot_board


def new_rect(object_id, operation_id=None):
    return {
        "operation_id": str(operation_id or uuid4()),
        "object_id": object_id, "kind": "pilot_rect",
        "x": 100, "y": 150, "width": 120, "height": 80,
        "color": "#275ec7",
    }


def move(revision=1, x=200, y=260, operation_id=None):
    return {
        "operation_id": str(operation_id or uuid4()),
        "expected_revision": revision, "x": x, "y": y,
    }


@pytest.mark.asyncio
async def test_two_editors_create_and_move_independent_objects(client):
    _, owner = await sign_in(client, "teacher@example.test")
    _, editor = await sign_in(client, "student@example.test")
    board = await new_pilot_board(client, owner)
    base = f"/api/v1/boards/{board}/pilot/objects"
    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'editor')",
            UUID(board), STUDENT,
        )
    a, b = new_rect("rect_teacher"), new_rect("rect_student")
    create1, create2 = await asyncio.gather(
        client.post(base, headers=owner, json=a),
        client.post(base, headers=editor, json=b),
    )
    assert create1.status_code == 201, create1.text
    assert create2.status_code == 201, create2.text
    assert {create1.json()["version"], create2.json()["version"]} == {2, 3}
    assert create1.json()["object_revision"] == 1
    assert create2.json()["object_revision"] == 1

    first = move(x=250, y=300)
    second = move(x=400, y=450)
    result1, result2 = await asyncio.gather(
        client.post(base + "/rect_teacher/move", headers=owner, json=first),
        client.post(base + "/rect_student/move", headers=editor, json=second),
    )
    assert result1.status_code == 200, result1.text
    assert result2.status_code == 200, result2.text
    assert {result1.json()["version"], result2.json()["version"]} == {4, 5}
    doc = (await client.get(
        f"/api/v1/boards/{board}/document", headers=owner
    )).json()
    assert doc["version"] == 5
    objects = {o["id"]: o for o in doc["document"]["items"]}
    assert (objects["rect_teacher"]["x"], objects["rect_teacher"]["y"]) == (250, 300)
    assert (objects["rect_student"]["x"], objects["rect_student"]["y"]) == (400, 450)
    assert all(o["revision"] == 2 for o in objects.values())
    assert objects["rect_student"]["created_by"] == str(STUDENT)

    retry = await client.post(base + "/rect_teacher/move", headers=owner, json=first)
    assert retry.status_code == 200 and retry.json()["duplicate"]
    assert retry.json()["version"] == result1.json()["version"]
    assert (await client.get(
        f"/api/v1/boards/{board}/document", headers=owner
    )).json()["version"] == 5
    conflict = await client.post(
        base + "/rect_teacher/move", headers=owner,
        json={**first, "x": 300},
    )
    assert conflict.status_code == 409
    duplicate_create = await client.post(base, headers=editor, json=a)
    assert duplicate_create.status_code == 409
    history = (await client.get(base + "/history", headers=editor)).json()
    assert [e["type"] for e in history].count("object_create") == 2
    assert [e["type"] for e in history].count("object_move") == 2
    assert all("payload" not in e for e in history)


@pytest.mark.asyncio
async def test_same_object_conflicts_and_idempotent_create(client):
    _, owner = await sign_in(client, "teacher@example.test")
    _, editor = await sign_in(client, "student@example.test")
    board = await new_pilot_board(client, owner)
    base = f"/api/v1/boards/{board}/pilot/objects"
    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'editor')",
            UUID(board), STUDENT,
        )
    req = new_rect("shared")
    first = await client.post(base, headers=owner, json=req)
    assert first.status_code == 201, first.text
    same = await client.post(base, headers=owner, json=req)
    assert same.status_code == 201 and same.json()["duplicate"]
    assert same.json()["version"] == first.json()["version"]
    different = await client.post(base, headers=owner, json={**req, "color": "#ff9933"})
    assert different.status_code == 409
    left, right = move(x=300, y=300), move(x=500, y=500)
    results = await asyncio.gather(
        client.post(base + "/shared/move", headers=owner, json=left),
        client.post(base + "/shared/move", headers=editor, json=right),
    )
    assert sorted(r.status_code for r in results) == [200, 409]
    latest = (await client.get(
        f"/api/v1/boards/{board}/document", headers=owner
    )).json()["document"]["items"][0]
    assert latest["revision"] == 2
    assert (latest["x"], latest["y"]) in {(300, 300), (500, 500)}
    assert (await client.post(base + "/shared/move", headers=editor,
        json=move(revision=1, x=300, y=300))).status_code == 409
    moved_again = await client.post(base + "/shared/move", headers=editor,
        json=move(revision=2, x=450, y=550))
    assert moved_again.status_code == 200 and moved_again.json()["object_revision"] == 3


@pytest.mark.asyncio
async def test_object_permissions_and_no_production_board_mutation(client):
    _, owner = await sign_in(client, "teacher@example.test")
    _, viewer = await sign_in(client, "student@example.test")
    _, outsider = await sign_in(client, "outsider@example.test")
    pilot = await new_pilot_board(client, owner)
    base = f"/api/v1/boards/{pilot}/pilot/objects"
    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'viewer')",
            UUID(pilot), STUDENT,
        )
    assert (await client.post(base, headers=viewer,
                              json=new_rect("unauthorized"))).status_code == 403
    assert (await client.post(base, headers=outsider,
                              json=new_rect("unauthorized"))).status_code == 404
    created = await client.post(base, headers=owner, json=new_rect("one"))
    assert created.status_code == 201
    assert (await client.post(base+"/one/move", headers=viewer,
                              json=move())).status_code == 403
    assert (await client.get(base+"/history", headers=viewer)).status_code == 200
    assert (await client.get(base+"/history", headers=outsider)).status_code == 404

    normal = (await client.post(
        "/api/v1/boards", headers=owner,
        json={"title": "Реальная доска", "is_pilot": False},
    )).json()["id"]
    # Forged JSON schema must never grant access to pilot-only endpoints.
    saved = await client.put(
        f"/api/v1/boards/{normal}/document", headers=owner,
        json={"expected_version": 0, "document": {
            "pilot_schema": 1, "items": [], "ink": [], "note": "real",
        }},
    )
    assert saved.status_code == 200
    root = f"/api/v1/boards/{normal}/pilot/objects"
    assert (await client.post(root, headers=owner,
                              json=new_rect("forbidden"))).status_code == 409
    assert (await client.post(root+"/forbidden/move", headers=owner,
                              json=move())).status_code == 409
    assert (await client.get(root+"/history", headers=owner)).status_code == 409
    assert (await client.get(f"/api/v1/boards/{normal}/document",
                             headers=owner)).json()["document"]["items"] == []


@pytest.mark.asyncio
async def test_object_bounds_and_unexpected_fields_rejected(client):
    _, owner = await sign_in(client, "teacher@example.test")
    board = await new_pilot_board(client, owner)
    base = f"/api/v1/boards/{board}/pilot/objects"
    for bad in [
        {**new_rect("bad"), "x": 900},
        {**new_rect("bad"), "y": 950},
        {**new_rect("bad"), "object_id": "../../escape"},
        {**new_rect("bad"), "kind": "iframe"},
        {**new_rect("bad"), "color": "url(javascript:alert(1))"},
        {**new_rect("bad"), "created_by": str(TEACHER)},
        {**new_rect("bad"), "width": -30},
    ]:
        response = await client.post(base, headers=owner, json=bad)
        assert response.status_code == 422, response.text
    valid = await client.post(base, headers=owner, json=new_rect("valid"))
    assert valid.status_code == 201
    for bad in [
        {**move(), "x": 990},
        {**move(), "y": -1},
        {**move(), "expected_revision": 0},
        {**move(), "actor_id": str(TEACHER)},
    ]:
        response = await client.post(base+"/valid/move", headers=owner, json=bad)
        assert response.status_code == 422, response.text
    assert (await client.post(
        base+"/not_found/move", headers=owner, json=move()
    )).status_code == 404
    assert (await client.get(
        f"/api/v1/boards/{board}/document", headers=owner
    )).json()["version"] == 2
