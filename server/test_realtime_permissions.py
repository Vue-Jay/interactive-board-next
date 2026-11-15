"""No WS revision notices after membership revocation or session logout."""
import asyncio
import json
from uuid import UUID

import pytest

from app import app, _subscribers, _compact_ink_subscribers, announce, relay_live_event, lookup_board_sessions
from test_api import TEACHER, STUDENT, client, sign_in


class FakeWebSocket:
    def __init__(self):
        self.messages=[]
        self.closed_codes=[]
    async def send_json(self, message):
        self.messages.append(message)
    async def send_text(self, message):
        self.messages.append(json.loads(message))
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


@pytest.mark.asyncio
async def test_fanout_batches_query_and_does_not_block_fast_peers(client):
    owner_session, owner = await sign_in(client, "teacher@example.test")
    viewer_session, _ = await sign_in(client, "student@example.test")
    outsider_session, _ = await sign_in(client, "outsider@example.test")
    board_id = UUID((await client.post("/api/v1/boards",headers=owner,json={"title":"Batch"})).json()["id"])
    async with app.state.pool.acquire() as conn:
        await conn.execute("INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'viewer')",board_id,STUDENT)

    # Count database round trips without replacing the real auth query.
    class CountingPool:
        def __init__(self,pool):
            self.pool=pool
            self.calls=0
        def acquire(self):
            self.calls+=1
            return self.pool.acquire()
    pool=CountingPool(app.state.pool)
    owner_token,viewer_token,outsider_token=(s["access_token"] for s in (owner_session,viewer_session,outsider_session))
    rows=await lookup_board_sessions(pool,board_id,[owner_token,viewer_token,outsider_token,"invalid"])
    assert pool.calls==1
    assert rows[owner_token]["role"]=="owner"
    assert rows[viewer_token]["role"]=="viewer"
    assert rows[outsider_token]["role"] is None
    assert "invalid" not in rows

    class SlowSocket(FakeWebSocket):
        async def send_text(self,message):
            await asyncio.Event().wait()

    sender,slow,denied=FakeWebSocket(),SlowSocket(),FakeWebSocket()
    fast=[FakeWebSocket() for _ in range(10)]
    _subscribers[board_id].update({sender:owner_token,slow:viewer_token,denied:outsider_token,**{ws:viewer_token for ws in fast}})
    event={"type":"cursor","x":1,"y":2}
    try:
        before=pool.calls
        task=asyncio.create_task(relay_live_event(board_id,sender,event,pool))
        # All 10 fast recipients get the event without waiting for the slow peer.
        for _ in range(30):
            if all(ws.messages for ws in fast):
                break
            await asyncio.sleep(.01)
        assert all(ws.messages==[event] for ws in fast)
        assert not task.done()
        assert pool.calls-before==1
        await asyncio.wait_for(task,3)
        assert slow.closed_codes==[1011] and denied.closed_codes==[4403]
        assert not sender.messages and not denied.messages
        # Role revocation is visible in the very next query, no cache window.
        async with app.state.pool.acquire() as conn:
            await conn.execute("DELETE FROM board_members WHERE board_id=$1 AND user_id=$2",board_id,STUDENT)
        await relay_live_event(board_id,sender,event,pool)
        assert all(ws.messages==[event] and ws.closed_codes==[4403] for ws in fast)
    finally:
        _subscribers.pop(board_id,None)


@pytest.mark.asyncio
async def test_ink_fanout_preserves_old_clients_and_compacts_new_clients(client):
    owner_session, owner = await sign_in(client, "teacher@example.test")
    viewer_session, _ = await sign_in(client, "student@example.test")
    board_id = UUID((await client.post("/api/v1/boards",headers=owner,json={"title":"Compact"})).json()["id"])
    async with app.state.pool.acquire() as conn:
        await conn.execute("INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'viewer')",board_id,STUDENT)
    sender, legacy, compact = FakeWebSocket(), FakeWebSocket(), FakeWebSocket()
    _subscribers[board_id].update({sender:owner_session["access_token"],legacy:viewer_session["access_token"],compact:viewer_session["access_token"]})
    _compact_ink_subscribers.add(compact)
    try:
        event = {"type":"live_ink","points":[{"x":1.25,"y":-3.5},{"x":5,"y":7}],"offset":8,"finished":True}
        await relay_live_event(board_id,sender,event,app.state.pool)
        assert legacy.messages == [event]
        assert compact.messages == [{**event,"points":[[1.25,-3.5],[5,7]]}]
    finally:
        _compact_ink_subscribers.discard(compact)
        _subscribers.pop(board_id,None)
