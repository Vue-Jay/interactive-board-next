"""No WS revision notices after membership revocation or session logout."""
from uuid import UUID

import pytest

from app import app, _subscribers, announce
from test_api import TEACHER, STUDENT, client, sign_in


class FakeWebSocket:
    def __init__(self):
        self.messages=[]
        self.closed_codes=[]
    async def send_json(self, message):
        self.messages.append(message)
    async def close(self, code=1000):
        self.closed_codes.append(code)


@pytest.mark.asyncio
async def test_document_notice_rechecks_live_board_permission(client):
    owner_session, owner = await sign_in(client, "teacher@example.test")
    viewer_session, viewer = await sign_in(client, "student@example.test")
    board = (await client.post(
        "/api/v1/boards",headers=owner,json={"title":"Совместная доска"}
    )).json()["id"]
    board_id=UUID(board)
    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'viewer')",
            board_id,STUDENT
        )

    owner_ws,viewer_ws=FakeWebSocket(),FakeWebSocket()
    _subscribers[board_id][owner_ws]=owner_session["access_token"]
    _subscribers[board_id][viewer_ws]=viewer_session["access_token"]
    try:
        saved=await client.put(
            "/api/v1/boards/"+board+"/document",
            headers=owner,
            json={"expected_version":0,"document":{"items":[],"ink":[]}},
        )
        assert saved.status_code==200,saved.text
        assert [m["version"] for m in owner_ws.messages]==[1]
        assert [m["version"] for m in viewer_ws.messages]==[1]

        async with app.state.pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM board_members WHERE board_id=$1 AND user_id=$2",
                board_id,STUDENT
            )
        saved=await client.put(
            "/api/v1/boards/"+board+"/document",
            headers=owner,
            json={"expected_version":1,"document":{"items":[],"ink":[],"note":"second"}},
        )
        assert saved.status_code==200,saved.text
        assert [m["version"] for m in owner_ws.messages]==[1,2]
        assert [m["version"] for m in viewer_ws.messages]==[1]
        assert viewer_ws.closed_codes==[4403]
        assert viewer_ws not in _subscribers[board_id]

        # A server-revoked session cannot receive notifications either.
        assert (await client.post("/api/v1/auth/logout",headers=owner)).status_code==200
        await announce(board_id,3,app.state.pool)
        assert [m["version"] for m in owner_ws.messages]==[1,2]
        assert owner_ws.closed_codes==[4403]
    finally:
        _subscribers.pop(board_id,None)
