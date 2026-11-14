"""Durable pilot-only ink operations, idempotency, undo and access checks."""
import asyncio
from uuid import uuid4

import pytest

from app import app
from test_api import TEACHER, STUDENT, OUTSIDER, client, sign_in


def append(stroke_id: str, operation_id=None):
    return {
        "operation_id": str(operation_id or uuid4()),
        "client_id": "browser_A",
        "stroke_id": stroke_id,
        "kind": "pen",
        "color": "#275ec7",
        "weight": 3,
        "points": [{"x": 10.0, "y": 15.0}, {"x": 25.0, "y": 30.0}],
    }


async def new_pilot_board(client, owner):
    created = await client.post("/api/v1/boards",
                                json={"title": "Пилот: синхронизация", "is_pilot": True}, headers=owner)
    assert created.status_code == 201, created.text
    board = created.json()["id"]
    saved = await client.put(
        f"/api/v1/boards/{board}/document",
        headers=owner,
        json={"expected_version": 0, "document": {
            "pilot_schema": 1, "items": [], "ink": [], "note": "first",
        }},
    )
    assert saved.status_code == 200, saved.text
    return board


@pytest.mark.asyncio
async def test_concurrent_strokes_merge_without_overwriting_and_are_idempotent(client):
    _, teacher = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    _, stranger = await sign_in(client, "outsider@example.test")
    board = await new_pilot_board(client, teacher)
    url = f"/api/v1/boards/{board}/pilot/ink"
    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'editor')",
            __import__("uuid").UUID(board), STUDENT,
        )
    teacher_stroke, student_stroke = append("teacher_1"), append("student_1")
    result1, result2 = await asyncio.gather(
        client.post(url, json=teacher_stroke, headers=teacher),
        client.post(url, json=student_stroke, headers=student),
    )
    assert result1.status_code == 201, result1.text
    assert result2.status_code == 201, result2.text
    assert {result1.json()["version"], result2.json()["version"]} == {2, 3}
    saved = (await client.get(
        f"/api/v1/boards/{board}/document", headers=student
    )).json()
    assert saved["version"] == 3
    assert saved["document"]["note"] == "first"
    assert {x["id"] for x in saved["document"]["ink"]} == {"teacher_1", "student_1"}
    assert {x["created_by"] for x in saved["document"]["ink"]} == {
        str(TEACHER), str(STUDENT),
    }

    repeated = await client.post(url, headers=teacher, json=teacher_stroke)
    assert repeated.status_code == 201
    assert repeated.json()["duplicate"] is True
    assert repeated.json()["version"] == result1.json()["version"]
    assert (await client.get(
        f"/api/v1/boards/{board}/document", headers=teacher
    )).json()["version"] == 3
    same_id_different_payload = await client.post(
        url, headers=teacher,
        json={**teacher_stroke, "stroke_id": "forged-retry"},
    )
    assert same_id_different_payload.status_code == 409
    different_operation_same_stroke = await client.post(
        url, headers=teacher, json={**teacher_stroke,
                                    "operation_id": str(uuid4())},
    )
    assert different_operation_same_stroke.status_code == 409

    assert (await client.post(url, headers=stranger,
                              json=append("outsider"))).status_code == 404
    history = await client.get(
        f"/api/v1/boards/{board}/pilot/history", headers=student,
    )
    assert history.status_code == 200
    assert len(history.json()) == 2
    assert {x["type"] for x in history.json()} == {"ink_append"}
    assert all("payload" not in x and "points" not in x for x in history.json())
    assert (await client.get(
        f"/api/v1/boards/{board}/pilot/history", headers=stranger
    )).status_code == 404


@pytest.mark.asyncio
async def test_undo_only_own_last_stroke_and_preserve_other_members(client):
    _, teacher = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    board = await new_pilot_board(client, teacher)
    base = f"/api/v1/boards/{board}/pilot"
    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'editor')",
            __import__("uuid").UUID(board), STUDENT,
        )
    for actor, name in [(teacher, "t_1"), (student, "s_1"), (teacher, "t_2")]:
        result = await client.post(base+"/ink", json=append(name), headers=actor)
        assert result.status_code == 201, result.text

    undo_id = str(uuid4())
    undo1 = await client.post(base+"/ink/undo",
                              headers=teacher, json={"operation_id": undo_id})
    assert undo1.status_code == 200, undo1.text
    assert undo1.json()["stroke_id"] == "t_2"
    redo_request = await client.post(base+"/ink/undo",
                                    headers=teacher, json={"operation_id": undo_id})
    assert redo_request.status_code == 200
    assert redo_request.json()["duplicate"] is True
    saved = (await client.get(
        f"/api/v1/boards/{board}/document", headers=teacher
    )).json()
    assert [x["id"] for x in saved["document"]["ink"]] == ["t_1", "s_1"]

    undo2 = await client.post(base+"/ink/undo",
                              headers=teacher, json={"operation_id": str(uuid4())})
    assert undo2.status_code == 200
    assert undo2.json()["stroke_id"] == "t_1"
    no_more = await client.post(base+"/ink/undo",
                                headers=teacher, json={"operation_id": str(uuid4())})
    assert no_more.status_code == 409
    saved = (await client.get(
        f"/api/v1/boards/{board}/document", headers=teacher
    )).json()
    assert [x["id"] for x in saved["document"]["ink"]] == ["s_1"]
    history = (await client.get(base+"/history", headers=teacher)).json()
    assert len(history) == 5
    assert [x["type"] for x in history[:2]] == ["ink_undo", "ink_undo"]


@pytest.mark.asyncio
async def test_pilot_ops_fail_closed_on_ordinary_board_and_viewer(client):
    _, teacher = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    full = (await client.post("/api/v1/boards",
        headers=teacher,json={"title":"Обычная доска"})).json()["id"]
    base = f"/api/v1/boards/{full}/pilot"
    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'viewer')",
            __import__("uuid").UUID(full), STUDENT,
        )
    invalid = await client.post(base+"/ink",headers=teacher,json=append("test_1"))
    assert invalid.status_code == 409
    assert (await client.get(base+"/history",headers=teacher)).status_code == 409
    assert (await client.post(base+"/ink",headers=student,
                              json=append("test_1"))).status_code == 403
    assert (await client.post(base+"/ink/undo",headers=student,
                              json={"operation_id":str(uuid4())})).status_code == 403
    row = (await client.get(f"/api/v1/boards/{full}/document",
                            headers=teacher)).json()
    assert row["document"] is None

    board = await new_pilot_board(client,teacher)
    url = f"/api/v1/boards/{board}/pilot/ink"
    for input in [
        {**append("invalid"),"points":[{"x":10_000_001,"y":10}]},
        {**append("invalid"),"points":[{"x":True,"y":10}]},
        {**append("invalid"),"points":[{"x":1,"y":10,"role":"admin"}]},
        {**append("invalid"),"points":[{"x":1,"y":10}]*201},
        {**append("invalid"),"weight":10000},
        {**append("invalid"),"kind":"eraser"},
        {**append("invalid"),"created_by":str(TEACHER)},
    ]:
        response = await client.post(url,headers=teacher,json=input)
        assert response.status_code in (413,422), response.text
    assert (await client.get(
        f"/api/v1/boards/{board}/document",headers=teacher
    )).json()["version"] == 1
