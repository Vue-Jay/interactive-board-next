"""Integration tests for guest entry plus the migrated board histories."""
import asyncio
from uuid import UUID, uuid4

import pytest

from app import app, lookup_board_sessions
from test_api import client, sign_in, STUDENT, TEACHER


async def board(client, owner):
    response = await client.post("/api/v1/boards", headers=owner, json={"title":"History"})
    assert response.status_code == 201, response.text
    return response.json()["id"]


@pytest.mark.asyncio
async def test_guest_access_is_atomic_scoped_and_expiring(client):
    _, owner = await sign_in(client,"teacher@example.test")
    target = await board(client,owner)
    other = await board(client,owner)
    root = f"/api/v1/boards/{target}"
    link = (await client.post(root+"/share-links",headers=owner,json={"role":"editor","max_uses":1,"password":"secret-test"})).json()
    payload = {"token":link["token"],"name":"Guest Test"}
    assert (await client.post("/api/v1/auth/guest",json=payload)).status_code==403
    assert (await client.get(root+"/share-links",headers=owner)).json()[0]["use_count"]==0
    attempts = await asyncio.gather(*(client.post("/api/v1/auth/guest",json={**payload,"password":"secret-test"}) for _ in range(2)))
    assert sorted(r.status_code for r in attempts)==[200,404]
    session = next(r.json() for r in attempts if r.status_code==200)
    assert session["user"]["guest_board_id"]==target
    assert session["user"]["email"]=="" and not session["user"]["is_admin"]
    async with app.state.pool.acquire() as conn:
        expires = await conn.fetchval("SELECT guest_expires_at FROM account_users WHERE id=$1", UUID(session["user"]["id"]))
        hours = await conn.fetchval("SELECT extract(epoch FROM (guest_expires_at-created_at))/3600 FROM account_users WHERE id=$1", UUID(session["user"]["id"]))
        assert hours == 72
    guest = {"Authorization":"Bearer "+session["access_token"]}
    assert (await client.get(root,headers=guest)).json()["role"]=="editor"
    assert (await client.get(f"/api/v1/boards/{other}",headers=guest)).status_code==404
    assert (await client.get("/api/v1/boards",headers=guest)).status_code==403
    assert (await client.post("/api/v1/boards",headers=guest,json={"title":"Forbidden"})).status_code==403
    assert (await client.post("/api/v1/share-links/redeem",headers=guest,json={"token":link["token"]})).status_code==403
    assert (await client.get(root+"/access",headers=guest)).status_code==403
    assert (await client.get(root+"/history",headers=guest)).status_code==403
    assert (await client.get(root+"/visits",headers=guest)).status_code==403
    assert (await client.put(root+"/document",headers=guest,json={"expected_version":0,"document":{"version":1,"items":[{"id":"ink","kind":"pen","createdBy":session["user"]["id"]}]}})).status_code==200
    assert (await client.get(root+"/document",headers=owner)).json()["document"]["items"][0]["id"]=="ink"
    live = await lookup_board_sessions(app.state.pool,UUID(target),[session["access_token"]])
    assert live[session["access_token"]]["role"]=="editor"
    assert not await lookup_board_sessions(app.state.pool,UUID(other),[session["access_token"]])
    renewed = await client.post("/api/v1/auth/refresh",json={"refresh_token":session["refresh_token"]})
    assert renewed.status_code==200 and renewed.json()["user"]["guest_board_id"]==target
    new = renewed.json()
    async with app.state.pool.acquire() as conn:
        assert await conn.fetchval("SELECT guest_expires_at FROM account_users WHERE id=$1", UUID(session["user"]["id"])) == expires
        await conn.execute("UPDATE account_users SET guest_expires_at=now()-interval '1 second' WHERE id=$1",UUID(session["user"]["id"]))
    assert (await client.get(root,headers={"Authorization":"Bearer "+new["access_token"]})).status_code==401
    assert (await client.post("/api/v1/auth/refresh",json={"refresh_token":new["refresh_token"]})).status_code==401
    assert not await lookup_board_sessions(app.state.pool,UUID(target),[new["access_token"]])


@pytest.mark.asyncio
async def test_guest_viewer_and_visit_history(client):
    _, owner = await sign_in(client,"teacher@example.test")
    _, student = await sign_in(client,"student@example.test")
    target = await board(client,owner)
    root = f"/api/v1/boards/{target}"
    link = (await client.post(root+"/share-links",headers=owner,json={"role":"viewer"})).json()
    session = (await client.post("/api/v1/auth/guest",json={"token":link["token"],"name":"Guest Viewer"})).json()
    guest = {"Authorization":"Bearer "+session["access_token"]}
    assert (await client.get(root,headers=guest)).json()["role"]=="viewer"
    assert (await client.put(root+"/document",headers=guest,json={"expected_version":0,"document":{"version":1,"items":[]}})).status_code==403
    visit = {"visit_id":str(uuid4()),"action":"ping"}
    assert (await client.post(root+"/visits",headers=guest,json=visit)).status_code==200
    assert (await client.post(root+"/visits",headers=guest,json=visit)).status_code==200
    rows = (await client.get(root+"/visits",headers=owner)).json()
    assert len(rows)==1 and rows[0]["active"] and rows[0]["user_name"]=="Guest Viewer"
    assert (await client.get(root+"/visits",headers=guest)).status_code==403
    assert (await client.get(root+"/visits",headers=student)).status_code==404
    assert (await client.post(root+"/visits",headers=guest,json={**visit,"action":"leave"})).status_code==200
    assert (await client.post(root+"/visits",headers=guest,json=visit)).status_code==200
    rows = (await client.get(root+"/visits",headers=owner)).json()
    assert len(rows)==1 and not rows[0]["active"] and rows[0]["left_at"]
    stale={"visit_id":str(uuid4()),"action":"ping"}
    await client.post(root+"/visits",headers=guest,json=stale)
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE board_visits SET started_at=now()-interval '5 minutes',last_seen=now()-interval '3 minutes' WHERE visit_id=$1",UUID(stale["visit_id"]))
    rows=(await client.get(root+"/visits",headers=owner)).json()
    assert len(rows)==2 and all(not row["active"] for row in rows)


@pytest.mark.asyncio
async def test_durable_history_checkpoints_retention_restore_and_permissions(client):
    _, owner=await sign_in(client,"teacher@example.test")
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET subscription_plan='pro',subscription_until=now()+interval '1 day' WHERE id=$1",TEACHER)
    _, student=await sign_in(client,"student@example.test")
    _, outsider=await sign_in(client,"outsider@example.test")
    target=await board(client,owner)
    root=f"/api/v1/boards/{target}"
    url=root+"/document?version_only=true"
    async with app.state.pool.acquire() as conn:
        await conn.execute("INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'editor')",UUID(target),STUDENT)
    initial={"version":1,"title":"Initial","items":[{"id":"a","kind":"pen"}]}
    assert (await client.put(url,headers=owner,json={"expected_version":0,"document":initial})).status_code==200
    # Simulate a board already saved before this migration.
    async with app.state.pool.acquire() as conn:
        await conn.execute("DELETE FROM board_history WHERE board_id=$1",UUID(target))
    assert (await client.get(root+"/history",headers=owner)).json()[0]["version"]==1
    for version in range(1,111):
        delta={"set":{"title":str(version+1)},"items":{"upsert":[{"id":"a","kind":"pen","x":version}]}}
        result=await client.patch(url,headers=student,json={"expected_version":version,"delta":delta})
        assert result.status_code==200, result.text
    history=(await client.get(root+"/history?limit=100",headers=owner)).json()
    assert len(history)==100 and history[0]["version"]==111 and history[-1]["version"]==12
    assert history[0]["saved_by_name"]=="student" and history[0]["changed_count"]==1
    assert (await client.get(root+"/history",headers=student)).status_code==200
    assert (await client.get(root+"/history",headers=outsider)).status_code==404
    assert (await client.get(root+"/history/12",headers=student)).status_code==403
    assert (await client.get(root+"/history/11",headers=owner)).status_code==404
    old=(await client.get(root+"/history/12",headers=owner)).json()
    assert old["title"]=="12" and old["items"][0]["x"]==11
    async with app.state.pool.acquire() as conn:
        count=await conn.fetchval("SELECT count(*) FROM board_history WHERE board_id=$1",UUID(target))
        checkpoints=await conn.fetchval("SELECT count(*) FROM board_history WHERE board_id=$1 AND checkpoint IS NOT NULL",UUID(target))
        assert count<=109 and checkpoints<=11
    assert (await client.put(url,headers=owner,json={"expected_version":111,"document":old})).json()=={"version":112}
    assert (await client.get(root+"/document",headers=owner)).json()["document"]==old


@pytest.mark.asyncio
async def test_free_history_retention_25_versions(client):
    _, owner=await sign_in(client,"teacher@example.test")
    target=await board(client,owner)
    root=f"/api/v1/boards/{target}"
    url=root+"/document?version_only=true"
    initial={"version":1,"title":"Initial","items":[]}
    assert (await client.put(url,headers=owner,json={"expected_version":0,"document":initial})).status_code==200
    for version in range(1,35):
        result=await client.patch(url,headers=owner,json={"expected_version":version,"delta":{"set":{"title":str(version+1)}}})
        assert result.status_code==200,result.text
    rows=(await client.get(root+"/history?limit=100",headers=owner)).json()
    assert len(rows)==25 and rows[0]["version"]==35 and rows[-1]["version"]==11
    assert (await client.get(root+"/history/11",headers=owner)).status_code==200
    assert (await client.get(root+"/history/10",headers=owner)).status_code==409
    async with app.state.pool.acquire() as conn:
        assert await conn.fetchval("SELECT count(*) FROM board_history WHERE board_id=$1",UUID(target))<=34
