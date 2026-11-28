"""Real Uvicorn + two WebSocket peers; synthetic accounts, disposable Postgres."""
import asyncio
from collections import Counter
from contextlib import AsyncExitStack
import gc
import json
import os
import signal
import sys
from pathlib import Path
from time import perf_counter
from uuid import UUID, uuid4

import asyncpg
import bcrypt
import httpx
import pytest
import uvicorn
import websockets
from websockets.exceptions import ConnectionClosed

import app as api
from app import app, announce, _login_attempts, _subscribers, _subscriber_users, _presence_watchers, _compact_ink_subscribers
from schema import apply_schema
from test_api import TEACHER, STUDENT, PASSWORD


@pytest.mark.asyncio
async def test_two_live_sockets_receive_revision_then_revoke(monkeypatch,tmp_path):
    monkeypatch.setenv("LEKTRUS_ASSETS_DIR",str(tmp_path/"private-assets"))
    monkeypatch.setenv("LEKTRUS_DEPLOYMENT_ORIGINS","https://lektrus.ru,https://lectrus.ru,http://127.0.0.1:5173")
    _login_attempts.clear()
    conn=await asyncpg.connect(os.environ["DATABASE_URL"])
    try:
        await apply_schema(conn)
        await conn.execute(
            "TRUNCATE account_sessions,board_documents,board_members,boards,account_users CASCADE"
        )
        hashed=bcrypt.hashpw(PASSWORD.encode(),bcrypt.gensalt(rounds=4)).decode()
        for uid,email,role in [
            (TEACHER,"teacher@example.test","teacher"),
            (STUDENT,"student@example.test","student"),
        ]:
            await conn.execute(
                """INSERT INTO account_users
                   (id,email,password_hash,display_name,account_role,teacher_status,email_confirmed_at)
                   VALUES($1,$2,$3,$4,$5,$6,now())""",
                uid,email,hashed,"Тест",role,"approved" if role=="teacher" else "none",
            )
    finally:
        await conn.close()

    config=uvicorn.Config(app,host="127.0.0.1",port=18762,log_level="error",lifespan="on")
    server=uvicorn.Server(config)
    server.install_signal_handlers=lambda:None
    task=asyncio.create_task(server.serve())
    try:
        for _ in range(100):
            if server.started:
                break
            if task.done():
                raise RuntimeError("Uvicorn stopped before test startup")
            await asyncio.sleep(.05)
        assert server.started,"Real API server did not start"

        async with httpx.AsyncClient(base_url="http://127.0.0.1:18762",timeout=8) as http:
            async def login(email):
                response=await http.post("/api/v1/auth/login",
                    json={"email":email,"password":PASSWORD})
                assert response.status_code==200,response.text
                session=response.json()
                return session,{"Authorization":"Bearer "+session["access_token"]}

            owner_session,owner=await login("teacher@example.test")
            student_session,student=await login("student@example.test")
            created=await http.post("/api/v1/boards",headers=owner,
                                    json={"title":"Socket test","is_pilot":True})
            assert created.status_code==201,created.text
            board=created.json()["id"]
            board_id=UUID(board)
            async with app.state.pool.acquire() as db:
                await db.execute(
                    "INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'viewer')",
                    board_id,STUDENT,
                )
                await db.execute(
                    """INSERT INTO board_documents(board_id,document,version,updated_by)
                       VALUES($1,$2::jsonb,1,$3)""",
                    board_id,json.dumps({
                        "pilot_schema":1,"note":"","ink":[],
                        "items":[{
                            "id":"rect_1","kind":"pilot_rect","x":100,"y":100,
                            "width":120,"height":80,"color":"#dbeafe",
                            "revision":1,"created_by":str(TEACHER),
                        }],
                    }),TEACHER,
                )

            # Native board (not the pilot): actual two-user live relay on both aliases.
            native=(await http.post("/api/v1/boards",headers=owner,json={"title":"Native","is_pilot":False})).json()["id"]
            async with app.state.pool.acquire() as db:
                await db.execute("INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'editor')",UUID(native),STUDENT)
            native_uri="ws://127.0.0.1:18762/api/v1/boards/"+native+"/events"
            async with websockets.connect(native_uri,origin="https://lektrus.ru") as first:
                async with websockets.connect(native_uri,origin="https://lectrus.ru") as second:
                    for ws,session in ((first,owner_session),(second,student_session)):
                        await ws.send(json.dumps({"type":"auth","token":session["access_token"],"document_patches":ws is second,"ink_point_deltas":ws is second,"durable_ink_commits":True,"durable_object_commits":True,"ink_commit_chain":True,"ink_motion":True}))
                        assert json.loads(await asyncio.wait_for(ws.recv(),3))=={"type":"ready","version":0,"durable_ink_commits":True,"durable_object_commits":True,"ink_commit_chain":True,"ink_motion":True}
                    for sender,receiver in ((first,second),(second,first)):
                        packet={"type":"live_ink","client_id":"native_1","stroke_id":"native_stroke","kind":"pen",
                                "color":"#112233","weight":3,"offset":0,"points":[{"x":10,"y":20}],"finished":False}
                        await sender.send(json.dumps(packet))
                        received=json.loads(await asyncio.wait_for(receiver.recv(),3))
                        assert received["type"]=="live_ink" and received["points"]==packet["points"]
                        assert json.loads(await asyncio.wait_for(sender.recv(),3))["type"]=="ink_ack"
                        erase={**packet,"type":"live_erase","kind":"eraser","stroke_id":"native_eraser",
                               "weight":120,"cancelled":False,"cut_ids":[]}
                        await sender.send(json.dumps(erase))
                        preview=json.loads(await asyncio.wait_for(receiver.recv(),3))
                        assert preview["type"]=="live_erase" and preview["finished"] is False
                        assert preview["points"]==erase["points"]
                        assert json.loads(await asyncio.wait_for(sender.recv(),3))["type"]=="ink_ack"
                        await sender.send(json.dumps({**erase,"finished":True,"cut_ids":["native_stroke"]}))
                        final=json.loads(await asyncio.wait_for(receiver.recv(),3))
                        assert final["finished"] is True and final["cut_ids"]==["native_stroke"]
                        assert json.loads(await asyncio.wait_for(sender.recv(),3))["type"]=="ink_ack"
                    saved=await http.put(f"/api/v1/boards/{native}/document?version_only=true",headers=owner,
                        json={"expected_version":0,"document":{"version":1,"items":[],"ink":[]}})
                    assert saved.status_code==200,saved.text
                    for ws in (first,second):
                        assert json.loads(await asyncio.wait_for(ws.recv(),3))=={"type":"document_changed","version":1}
                    version=await http.get(f"/api/v1/boards/{native}/document?version_only=true",headers=student)
                    assert version.json()=={"version":1}
                    # Exercise durable collaboration through real sockets
                    # and the same incremental HTTP read used by browsers.
                    from document_delta import apply_delta
                    url=f"/api/v1/boards/{native}/document"
                    peer=(await http.get(url,headers=student)).json()["document"]
                    kinds=("sticky","text","shape","pen","marker","image","pdf","frame","connector","comment",
                           "table","formula","graph","fraction","checklist","quiz","flashcard","cover","linkmedia","instrument")
                    # Use complete, parser-compatible object payloads rather than
                    # just a kind and ID; the wire matrix must carry real content.
                    extras={
                        "pen":{"points":[{"x":1,"y":2},{"x":20,"y":10}],"weight":2,"color":"#123456"},
                        "marker":{"points":[{"x":1,"y":2},{"x":20,"y":10}],"weight":12,"color":"#123456"},
                        "sticky":{"color":"#ffeeaa","stickerInk":[{"id":"attached","kind":"pen","color":"#123456","weight":2,"points":[{"x":1,"y":1}]}]},
                        "shape":{"shapeType":"rectangle","color":"#123456"},
                        "image":{"assetId":"matrix-image","name":"photo.png","mime":"image/png","imageSourceAspect":2},
                        "pdf":{"assetId":"matrix-pdf","name":"file.pdf","mime":"application/pdf","pdfPage":1},
                        "connector":{"connectorStart":{"x":0,"y":0},"connectorEnd":{"x":100,"y":50}},
                        "table":{"tableRows":1,"tableCols":2,"tableCells":["A","B"]},
                        "graph":{"graphPurpose":"coordinates","graphPoints":[{"id":"a","x":1,"y":2,"label":"A"}]},
                        "fraction":{"fractionNumerator":1,"fractionDenominator":2},
                        "checklist":{"checklistItems":["Task"],"checklistDone":[False]},
                        "quiz":{"quizOptions":["A","B"],"quizCorrect":0},
                        "flashcard":{"flashcardBack":"Answer"},
                        "cover":{"coverOpen":False,"coverOpacity":1},
                        "linkmedia":{"mediaUrl":"https://example.test/video","mediaTitle":"Video"},
                        "instrument":{"instrumentType":"ruler","instrumentScale":1},
                    }
                    def object_fixture(prefix,kind,author):
                        return {"id":prefix+kind,"kind":kind,"x":0,"y":0,"width":100,"height":50,
                                "text":"","createdBy":str(author),**extras.get(kind,{})}
                    objects=[object_fixture("sync-",kind,TEACHER) for kind in kinds]
                    moved=[{**item,"x":100,"y":50} for item in objects]
                    edited=[{**item,"text":"updated"} for item in moved]
                    for revision,delta in enumerate((
                        {"items":{"upsert":objects}},
                        {"items":{"upsert":moved}},
                        {"items":{"upsert":edited}},
                        {"items":{"remove":[item["id"] for item in objects]}},
                    ),1):
                        await first.send(json.dumps({"type":"ink_commit","request_id":f"object-{revision}","expected_version":revision,"delta":delta}))
                        legacy=json.loads(await asyncio.wait_for(first.recv(),3))
                        assert legacy=={"type":"document_changed","version":revision+1}
                        push=json.loads(await asyncio.wait_for(second.recv(),3))
                        assert push["type"]=="document_changed" and push["version"]==revision+1
                        assert push["base_version"]==revision and push["delta"]==delta
                        assert json.loads(await asyncio.wait_for(first.recv(),3))=={"type":"ink_commit_ack","request_id":f"object-{revision}","version":revision+1}
                        pushed=apply_delta(peer,push["delta"])
                        update=(await http.get(url+f"?since_version={revision}",headers=student)).json()
                        assert update["version"]==revision+1
                        for patch in update["patches"]:
                            peer=apply_delta(peer,patch)
                        assert pushed==peer==(await http.get(url,headers=owner)).json()["document"]
                    assert peer["items"]==[]
                    async with app.state.pool.acquire() as db:
                        await db.execute("UPDATE board_members SET participant_role='student' WHERE board_id=$1 AND user_id=$2",UUID(native),STUDENT)
                    pupil_objects=[object_fixture("pupil-",kind,STUDENT)
                                   for kind in ("sticky","text","shape","image","pdf","connector","comment","fraction","instrument","pen","marker")]
                    current_version=5
                    for idx,delta in enumerate(({"items":{"upsert":pupil_objects}},
                            {"items":{"upsert":[{**item,"x":15,"y":20} for item in pupil_objects]}},
                            {"items":{"upsert":[{**item,"x":15,"y":20,"text":"pupil edit"} for item in pupil_objects]}},
                            {"items":{"remove":[item["id"] for item in pupil_objects]}})):
                        request_id=f"pupil-object-{idx}"
                        await second.send(json.dumps({"type":"ink_commit","request_id":request_id,"expected_version":current_version,"delta":delta}))
                        notice=json.loads(await asyncio.wait_for(first.recv(),3))
                        pushed=json.loads(await asyncio.wait_for(second.recv(),3))
                        current_version+=1
                        assert notice=={"type":"document_changed","version":current_version}
                        assert pushed["version"]==current_version and pushed["delta"]==delta
                        assert json.loads(await asyncio.wait_for(second.recv(),3))=={"type":"ink_commit_ack","request_id":request_id,"version":current_version}
                        peer=apply_delta(peer,delta)
                        assert peer==(await http.get(url,headers=owner)).json()["document"]
                    assert peer["items"]==[]
                    async with app.state.pool.acquire() as db:
                        await db.execute("UPDATE board_members SET participant_role=NULL WHERE board_id=$1 AND user_id=$2",UUID(native),STUDENT)
                    # A modern peer receives only the committed suffix; an
                    # old peer gets a version notice and the existing GET path.
                    version = (await http.get(url+"?version_only=true",headers=owner)).json()["version"]
                    capability = (await http.get(url+"?ink_point_deltas=true",headers=owner)).json()
                    assert capability["ink_point_deltas"] is True
                    points = [{"x": i/10, "y": i%5} for i in range(200)]
                    ink = {"id":"durable-ink","kind":"pen","createdBy":str(TEACHER),
                           "x":10,"y":20,"width":25,"height":10,"weight":2,"color":"#112233","text":"","points":points}
                    stroke_url = url+"?version_only=true&ink_gesture=durable-ink"
                    created_ink = await http.patch(stroke_url,headers=owner,json={"expected_version":version,
                        "delta":{"items":{"upsert":[ink]}}})
                    assert created_ink.status_code==200,created_ink.text
                    version += 1
                    for ws in (first,second):
                        assert json.loads(await asyncio.wait_for(ws.recv(),3))["version"]==version
                    base = (await http.get(url,headers=student)).json()["document"]
                    edit={"id":"durable-ink","count":200,"keep":199,"points":[{"x":0,"y":0},{"x":1,"y":1}],
                          "geometry":{"x":9,"y":18,"width":27,"height":12}}
                    delta={"items":{"point_edits":[edit]}}
                    packet={"type":"ink_commit","request_id":"write_1","expected_version":version,
                            "delta":delta,"ink_gesture":"durable-ink","cursor":{"client_id":"ink_client","x":10,"y":19}}
                    await first.send(json.dumps(packet))
                    assert json.loads(await asyncio.wait_for(first.recv(),3))=={"type":"document_changed","version":version+1}
                    push=json.loads(await asyncio.wait_for(second.recv(),3))
                    assert push["base_version"]==version and push["delta"]==delta
                    assert push["ink_cursor"]["user_id"]==str(TEACHER)
                    assert push["ink_cursor"]["x"]==10 and push["ink_cursor"]["y"]==19
                    assert json.loads(await asyncio.wait_for(first.recv(),3))=={"type":"ink_commit_ack","request_id":"write_1","version":version+1}
                    await first.send(json.dumps({**packet,"request_id":"stale"}))
                    stale_ack=json.loads(await asyncio.wait_for(first.recv(),3))
                    assert stale_ack["status"]==409 and stale_ack["request_id"]=="stale"
                    expected=apply_delta(base,delta)
                    legacy_update=(await http.get(url+f"?since_version={version}",headers=student)).json()
                    assert "upsert" in legacy_update["patches"][0]["items"]
                    assert apply_delta(base,legacy_update["patches"][0])==expected
                    compact_update=(await http.get(url+f"?since_version={version}&ink_point_deltas=true",headers=student)).json()
                    assert compact_update["patches"]==[delta]
                    assert apply_delta(base,compact_update["patches"][0])==expected
                    assert (await http.get(url,headers=owner)).json()["document"]==expected
                    # Old version, wrong point count, and deleted stroke are
                    # never accepted as a new checkpoint.
                    stale=await http.patch(stroke_url,headers=owner,json={"expected_version":version,"delta":delta})
                    assert stale.status_code==409,stale.text
                    version += 1
                    bad=await http.patch(stroke_url,headers=owner,json={"expected_version":version,"delta":delta})
                    assert bad.status_code==422,bad.text
                    await second.send(json.dumps({"type":"ink_commit","request_id":"erase_1","expected_version":version,
                        "ink_gesture":"erase:gesture_1","delta":{"items":{"remove":["durable-ink"]}},
                        "cursor":{"client_id":"student_1","x":10,"y":19}}))
                    version += 1
                    for ws in (first,second):
                        assert json.loads(await asyncio.wait_for(ws.recv(),3))["version"]==version
                    assert json.loads(await asyncio.wait_for(second.recv(),3))=={"type":"ink_commit_ack","request_id":"erase_1","version":version}
                    erased_edit=await http.patch(stroke_url,headers=owner,json={"expected_version":version,"delta":delta})
                    assert erased_edit.status_code==422,erased_edit.text
                    assert (await http.get(url,headers=owner)).json()["document"]["items"]==[]
                    # No ACK wait between successive permanent frames.
                    chained_ink={**ink,"id":"chain-ink","points":[{"x":0,"y":0}]}
                    chain1={"type":"ink_commit","request_id":"chain1","expected_version":version,
                            "ink_gesture":"chain-ink","delta":{"items":{"upsert":[chained_ink]}}}
                    chain2={**chain1,"request_id":"chain2","after_request_id":"chain1","expected_version":version+1,
                            "delta":{"items":{"upsert":[{**chained_ink,"points":[{"x":0,"y":0},{"x":1,"y":1}]}]}}}
                    await first.send(json.dumps(chain1))
                    await first.send(json.dumps(chain2))
                    for index,request_id in enumerate(("chain1","chain2"),1):
                        assert json.loads(await asyncio.wait_for(first.recv(),3))["version"]==version+index
                        assert json.loads(await asyncio.wait_for(second.recv(),3))["version"]==version+index
                        assert json.loads(await asyncio.wait_for(first.recv(),3))=={"type":"ink_commit_ack","request_id":request_id,"version":version+index}
                    version+=2
                    await first.send(json.dumps({**chain1,"request_id":"bad-chain","expected_version":version-1}))
                    await first.send(json.dumps({**chain2,"request_id":"blocked-chain","after_request_id":"bad-chain","expected_version":version}))
                    for request_id in ("bad-chain","blocked-chain"):
                        rejected=json.loads(await asyncio.wait_for(first.recv(),3))
                        assert rejected["status"]==409 and rejected["request_id"]==request_id
                    current=(await http.get(url,headers=owner)).json()
                    assert current["version"]==version and len(current["document"]["items"][0]["points"])==2
                    await second.send(json.dumps({"type":"ink_commit","request_id":"peer-erase-chain","expected_version":version,
                        "ink_gesture":"erase:peer","delta":{"items":{"remove":["chain-ink"]}}}))
                    version+=1
                    for ws in (first,second):
                        assert json.loads(await asyncio.wait_for(ws.recv(),3))["version"]==version
                    assert json.loads(await asyncio.wait_for(second.recv(),3))["version"]==version
                    await first.send(json.dumps({**chain2,"request_id":"late-after-erase","after_request_id":"chain2","expected_version":version}))
                    assert json.loads(await asyncio.wait_for(first.recv(),3))["status"]==409
                    current=(await http.get(url,headers=owner)).json()
                    assert current["version"]==version and current["document"]["items"]==[]
                    # Hold the actual PostgreSQL board row lock. A durable
                    # checkpoint must not block the socket's geometry relay.
                    live_item={**ink,"id":"fast-ink","points":[{"x":1,"y":1},{"x":19,"y":1}]}
                    motion_item={k:v for k,v in live_item.items() if k!="text"}
                    motion={"type":"ink_motion","client_id":"motion_1","gesture":"fast-ink","base_version":version,
                            "seq":1,"x":29,"y":21,"changes":[{"id":"fast-ink","index":0,"seq":1,"value":motion_item}]}
                    async with app.state.pool.acquire() as blocker:
                        async with blocker.transaction():
                            await blocker.fetchval("SELECT id FROM boards WHERE id=$1 FOR UPDATE",UUID(native))
                            await first.send(json.dumps({"type":"ink_commit","request_id":"motion-write","expected_version":version,
                                "ink_gesture":"fast-ink","delta":{"items":{"upsert":[live_item]}}}))
                            await first.send(json.dumps(motion))
                            relayed=json.loads(await asyncio.wait_for(second.recv(),3))
                            assert relayed["type"]=="ink_motion" and relayed["changes"]==motion["changes"]
                            assert relayed["user_id"]==str(TEACHER)
                            assert (await http.get(url+"?version_only=true",headers=owner)).json()["version"]==version
                    version+=1
                    for ws in (first,second):
                        committed=json.loads(await asyncio.wait_for(ws.recv(),3))
                        assert committed["type"]=="document_changed" and committed["version"]==version
                    assert json.loads(await asyncio.wait_for(first.recv(),3))=={"type":"ink_commit_ack","request_id":"motion-write","version":version}
                    await first.send(json.dumps({"type":"ink_motion_ack","client_id":"motion_1","seq":1,"version":version}))
                    settled=json.loads(await asyncio.wait_for(second.recv(),3))
                    assert settled["type"]=="ink_motion_ack" and settled["version"]==version
                    assert (await http.get(url,headers=owner)).json()["document"]["items"]==[live_item]
            # Negotiate a nearly elapsed inactivity window to exercise the
            # real server deadline without waiting ten minutes in CI.
            async with websockets.connect(native_uri,origin="https://lektrus.ru") as idle:
                await idle.send(json.dumps({"type":"auth","token":owner_session["access_token"],
                    "presence":True,"visible":True,"idle_age_ms":598500}))
                assert json.loads(await asyncio.wait_for(idle.recv(),3))["idle_lease"] is True
                assert json.loads(await asyncio.wait_for(idle.recv(),3))["type"]=="presence_state"
                await idle.send(json.dumps({"type":"ping"}))
                assert json.loads(await asyncio.wait_for(idle.recv(),3))["type"]=="pong"
                with pytest.raises(ConnectionClosed) as timed_out:
                    await asyncio.wait_for(idle.recv(),4)
                assert timed_out.value.code==4410,"Heartbeat must not extend user inactivity"
            async with websockets.connect(native_uri,origin="https://lektrus.ru") as resumed:
                await resumed.send(json.dumps({"type":"auth","token":owner_session["access_token"],
                    "presence":True,"visible":True,"idle_age_ms":598500}))
                assert json.loads(await asyncio.wait_for(resumed.recv(),3))["idle_lease"] is True
                assert json.loads(await asyncio.wait_for(resumed.recv(),3))["type"]=="presence_state"
                await resumed.send(json.dumps({"type":"activity","idle_age_ms":0}))
                await asyncio.sleep(1.7)
                await resumed.send(json.dumps({"type":"ping"}))
                assert json.loads(await asyncio.wait_for(resumed.recv(),3))["type"]=="pong"
            # The current client negotiates a background-only lease, unlike
            # legacy inactivity leases above. Foreground age must never expire
            # a session, and resuming before the deadline cancels it.
            async with websockets.connect(native_uri,origin="https://lektrus.ru") as foreground:
                await foreground.send(json.dumps({"type":"auth","token":owner_session["access_token"],
                    "presence":True,"visible":True,"idle_age_ms":0,"background_idle":True,"background":False}))
                ready=json.loads(await asyncio.wait_for(foreground.recv(),3))
                assert ready["idle_lease"] is True and ready["background_idle"] is True
                assert json.loads(await asyncio.wait_for(foreground.recv(),3))["type"]=="presence_state"
                await foreground.send(json.dumps({"type":"activity","idle_age_ms":598500,"background":True}))
                await foreground.send(json.dumps({"type":"activity","idle_age_ms":0,"background":False}))
                await asyncio.sleep(1.7)
                await foreground.send(json.dumps({"type":"ping"}))
                assert json.loads(await asyncio.wait_for(foreground.recv(),3))["type"]=="pong"
                await foreground.send(json.dumps({"type":"activity","idle_age_ms":598500,"background":True}))
                with pytest.raises(ConnectionClosed) as expired_background:
                    await asyncio.wait_for(foreground.recv(),4)
                assert expired_background.value.code==4410
            with pytest.raises(websockets.exceptions.InvalidStatusCode) as blocked:
                async with websockets.connect(native_uri,origin="https://untrusted.example"):
                    pass
            assert blocked.value.status_code==403

            # Reuse the existing Playwright acceptance harness with genuine
            # UI login, separate browser contexts, and the running disposable API.
            if os.getenv("LEKTRUS_RUN_BROWSER_SYNC") == "1":
                # CORSMiddleware captures configured origins when the API module
                # is imported. A late monkeypatch alone cannot open browser access.
                browser_origin="http://127.0.0.1:5173"
                preflight=await http.options("/api/v1/auth/login",headers={
                    "Origin":browser_origin,"Access-Control-Request-Method":"POST",
                    "Access-Control-Request-Headers":"content-type",
                })
                assert preflight.status_code==200,preflight.text
                assert preflight.headers.get("access-control-allow-origin")==browser_origin
                health=await http.get("/api/v1/health",headers={"Origin":browser_origin})
                assert health.status_code==200 and health.json()["ok"],health.text
                assert health.headers.get("access-control-allow-origin")==browser_origin
                root=Path(__file__).resolve().parents[1]
                artifacts=root/"artifacts"/"participant-roles"
                artifacts.mkdir(parents=True,exist_ok=True)
                env={**os.environ,"VITE_LEKTRUS_BACKEND":"selfhost",
                     "VITE_LEKTRUS_API_ORIGIN":"http://127.0.0.1:18762",
                     "LEKTRUS_QA_BASE":"http://127.0.0.1:5173",
                     "LEKTRUS_QA_API":"http://127.0.0.1:18762"}
                with (artifacts/"sync-vite.log").open("wb") as log:
                    vite=await asyncio.create_subprocess_exec(
                        "npm","run","dev","--","--host","127.0.0.1","--port","5173","--strictPort",
                        cwd=root,env=env,stdout=log,stderr=asyncio.subprocess.STDOUT,start_new_session=True)
                    try:
                        for _ in range(120):
                            if vite.returncode is not None:
                                raise AssertionError("Vite exited before browser tests")
                            try:
                                probe=await http.get("http://127.0.0.1:5173/app",timeout=2)
                                if probe.status_code==200:break
                            except httpx.HTTPError:pass
                            await asyncio.sleep(.5)
                        else:raise AssertionError("Vite did not start")
                        browser=await asyncio.create_subprocess_exec(
                            sys.executable,"tests/participant-roles-browser.py","--sync-only",cwd=root,env=env,
                            stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.STDOUT,start_new_session=True)
                        try:
                            output,_=await asyncio.wait_for(browser.communicate(),timeout=900)
                        except asyncio.TimeoutError:
                            os.killpg(browser.pid,signal.SIGKILL)
                            await browser.wait()
                            raise
                        assert browser.returncode==0,output.decode("utf-8",errors="replace")
                        print(output.decode("utf-8",errors="replace"))
                    finally:
                        if vite.returncode is None:
                            os.killpg(vite.pid,signal.SIGTERM)
                            try:await asyncio.wait_for(vite.wait(),timeout=5)
                            except asyncio.TimeoutError:
                                os.killpg(vite.pid,signal.SIGKILL)
                                await vite.wait()

            uri="ws://127.0.0.1:18762/api/v1/boards/"+board+"/events"
            async with websockets.connect(uri,origin="https://lektrus.ru") as ws_owner:
                async with websockets.connect(uri,origin="https://lektrus.ru") as ws_student:
                    await ws_owner.send(json.dumps({
                        "type":"auth","token":owner_session["access_token"],
                        "presence":True,"visible":True,
                    }))
                    # The subsequent assertion expects a join notification on an
                    # ALREADY subscribed owner. Authenticate in that order rather
                    # than racing two independent asynchronous handshakes.
                    oready=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    assert oready=={"type":"ready","version":1}
                    owner_presence=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    await ws_student.send(json.dumps({
                        "type":"auth","token":student_session["access_token"],
                        "presence":True,"visible":True,
                    }))
                    sready=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    assert sready=={"type":"ready","version":1}
                    student_presence=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    owner_join=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    assert owner_presence["type"]=="presence_state"
                    assert [u["user_id"] for u in owner_presence["users"]]==[str(TEACHER)]
                    assert student_presence["type"]=="presence_state"
                    assert {u["user_id"] for u in student_presence["users"]}=={str(TEACHER),str(STUDENT)}
                    assert owner_join["type"]=="presence_diff"
                    assert [u["user_id"] for u in owner_join["joins"]]==[str(STUDENT)]
                    assert owner_presence["users"][0]["participant_role"]=="owner"
                    assert owner_join["joins"][0]["participant_role"]=="observer"
                    assert owner_presence["users"][0]["color"] == "#3056c8"
                    assert owner_join["joins"][0]["color"] == "#087f69"
                    assert owner_presence["users"][0]["color"] != owner_join["joins"][0]["color"]
                    assert {u["user_id"]:u["color"] for u in student_presence["users"]} == {u["user_id"]:u["color"] for u in [owner_presence["users"][0],owner_join["joins"][0]]}

                    # View-only participants can show their cursor but cannot
                    # pretend to be the teacher or publish drawing strokes.
                    await ws_student.send(json.dumps({
                        "type":"cursor","client_id":"viewer_1","x":22.5,"y":-18.1
                    }))
                    cursor=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    assert cursor["type"]=="cursor"
                    assert cursor["user_id"]==str(STUDENT)
                    assert cursor["role"]=="viewer"
                    assert cursor["client_id"]=="viewer_1"
                    assert cursor["x"]==22.5

                    stroke={
                        "type":"live_ink","client_id":"owner_1",
                        "stroke_id":"stroke_A","kind":"pen",
                        "color":"#2477ee","weight":3,
                        "offset":0,"points":[{"x":10,"y":20},{"x":11,"y":22}],
                        "finished":True,
                    }
                    await ws_owner.send(json.dumps(stroke))
                    ink=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    ack=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    assert ink["type"]=="live_ink"
                    assert ink["user_id"]==str(TEACHER)
                    assert ink["role"]=="owner"
                    assert ink["stroke_id"]=="stroke_A"
                    assert ink["points"]==stroke["points"]
                    assert ink["finished"] is True
                    assert ack=={
                        "type":"ink_ack","client_id":"owner_1",
                        "stroke_id":"stroke_A","offset":0,"finished":True,
                    }
                    # Native editor presence, live edits, transforms and view control.
                    await ws_owner.send(json.dumps({
                        "type":"work_state","selected_ids":["rect_1"],"editing_id":"rect_1"
                    }))
                    work=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    assert work["type"]=="work_state"
                    assert work["user_id"]==str(TEACHER) and work["role"]=="owner"
                    assert work["selected_ids"]==["rect_1"] and work["editing_id"]=="rect_1"

                    mutation={
                        "type":"editor_mutation","id":"client_1:1","item_id":"rect_1",
                        "client_id":"client_1","ops":[
                            {"path":["text"],"kind":"set","value":"Изменено"}
                        ],
                    }
                    await ws_owner.send(json.dumps(mutation))
                    edited=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    assert edited["type"]=="editor_mutation"
                    assert edited["user_id"]==str(TEACHER)
                    assert edited["ops"]==mutation["ops"]

                    transform={
                        "type":"object_transform","client_id":"client_1","seq":1,
                        "finished":False,"items":[{
                            "id":"rect_1","x":130,"y":145,"width":120,"height":80,
                            "rotation":0,"origin":"100,100,120,80,0",
                        }],
                    }
                    await ws_owner.send(json.dumps(transform))
                    transformed=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    assert transformed["type"]=="object_transform"
                    assert transformed["user_id"]==str(TEACHER)
                    assert transformed["items"][0]["x"]==130

                    await ws_owner.send(json.dumps({
                        "type":"focus_view","target_user_id":str(STUDENT),
                        "center_x":220,"center_y":160,"zoom":1.5,
                    }))
                    focus=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    assert focus["type"]=="focus_view"
                    assert focus["user_id"]==str(TEACHER)
                    assert focus["target_user_id"]==str(STUDENT)
                    await ws_owner.send(json.dumps({
                        "type":"teacher_view","center_x":220,"center_y":160,"zoom":1.5
                    }))
                    teacher_view=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    assert teacher_view["type"]=="teacher_view"
                    await ws_owner.send(json.dumps({"type":"guided_follow","enabled":True}))
                    guided=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    assert guided["type"]=="guided_follow" and guided["enabled"] is True

                    await ws_student.send(json.dumps({
                        "type":"attachment_request","request_id":"request_1",
                        "asset_id":"asset_1","name":"Фото опыта.png",
                        "mime":"image/png","kind":"image","width":1200,"height":800,
                    }))
                    attachment_request=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    assert attachment_request["type"]=="attachment_request"
                    assert attachment_request["user_id"]==str(STUDENT)
                    assert attachment_request["name"]=="Тест"
                    assert attachment_request["attachment_name"]=="Фото опыта.png"
                    await ws_owner.send(json.dumps({
                        "type":"attachment_result","request_id":"request_1",
                        "target_user_id":str(STUDENT),"approved":True,
                        "name":"Фото опыта.png",
                    }))
                    attachment_result=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    assert attachment_result["type"]=="attachment_result"
                    assert attachment_result["user_id"]==str(TEACHER)
                    assert attachment_result["target_user_id"]==str(STUDENT)
                    assert attachment_result["attachment_name"]=="Фото опыта.png"

                    await ws_student.send(json.dumps({
                        "type":"object_transform","client_id":"viewer_1","seq":1,
                        "finished":False,"items":transform["items"],
                    }))
                    readonly_error=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    assert readonly_error["type"]=="event_error"
                    assert readonly_error["reason"]=="read_only"

                    # The pilot object preview is attributed by the server and
                    # relayed only when the object exists at the requested revision.
                    preview={
                        "type":"object_preview","client_id":"owner_1",
                        "object_id":"rect_1","gesture_id":"gesture_1",
                        "seq":1,"object_revision":1,"x":140,"y":150,
                    }
                    await ws_owner.send(json.dumps(preview))
                    moved=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    assert moved["type"]=="object_preview"
                    assert moved["user_id"]==str(TEACHER)
                    assert moved["role"]=="owner"
                    assert moved["object_id"]=="rect_1"
                    assert moved["object_revision"]==1
                    assert (moved["x"],moved["y"])==(140,150)
                    # A reader cannot publish object motion.
                    await ws_student.send(json.dumps({
                        **preview,"client_id":"viewer_1","gesture_id":"viewer_gesture"
                    }))
                    error=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    assert error["type"]=="event_error" and error["reason"]=="read_only"
                    # A stale object revision is rejected before fan-out.
                    await ws_owner.send(json.dumps({
                        **preview,"object_revision":9,"seq":2
                    }))
                    error=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    assert error["type"]=="event_error" and error["reason"]=="stale_object"
                    # Forged metadata or unexpected event keys never fan out.
                    await ws_student.send(json.dumps({
                        **stroke,"user_id":str(TEACHER)
                    }))
                    error=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    assert error["type"]=="event_error"
                    assert error["reason"]=="read_only"
                    await ws_owner.send(json.dumps({
                        **stroke,"user_id":str(STUDENT)
                    }))
                    error=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    assert error["type"]=="event_error"
                    assert error["reason"]=="invalid_ink_fields"

                    saved=await http.put(
                        "/api/v1/boards/"+board+"/document?version_only=true",
                        headers=owner,
                        json={"expected_version":1,"document":{
                            "pilot_schema":1,"items":[
                                {"id":"rect_1","kind":"pilot_rect","x":100,"y":100,
                                 "width":120,"height":80,"color":"#dbeafe",
                                 "revision":1,"created_by":str(TEACHER)}
                            ],"ink":[],"note":"first"
                        }},
                    )
                    assert saved.status_code==200,saved.text
                    assert saved.json()=={"version":2}
                    for ws in (ws_owner,ws_student):
                        msg=json.loads(await asyncio.wait_for(ws.recv(),3))
                        assert msg=={"type":"document_changed","version":2}
                        assert "document" not in msg, "WS should not resend full board JSON"

                    await ws_student.send(json.dumps({"type":"ping"}))
                    assert json.loads(await asyncio.wait_for(ws_student.recv(),3)) == {
                        "type":"pong","version":2,
                    }
                    comment=await http.post(
                        "/api/v1/boards/"+board+"/comments",headers=student,
                        json={"body":"A question"},
                    )
                    assert comment.status_code==201,comment.text
                    resolved=await http.patch(
                        "/api/v1/comments/"+comment.json()["id"],headers=owner,
                        json={"resolved":True},
                    )
                    assert resolved.status_code==200,resolved.text
                    for ws in (ws_owner,ws_student):
                        for _ in range(2):
                            assert json.loads(await asyncio.wait_for(ws.recv(),3)) == {
                                "type":"comments_changed",
                            }

                    async with app.state.pool.acquire() as db:
                        await db.execute("UPDATE board_members SET role='editor',participant_role='student' WHERE board_id=$1 AND user_id=$2",board_id,STUDENT)
                    await ws_student.send(json.dumps({"type":"ping"}))
                    for ws in (ws_owner,ws_student):
                        changed=json.loads(await asyncio.wait_for(ws.recv(),3))
                        assert changed["type"]=="presence_diff"
                        assert changed["joins"][0]["participant_role"]=="student"
                        assert changed["joins"][0]["role"]=="editor"
                    assert json.loads(await asyncio.wait_for(ws_student.recv(),3))=={"type":"pong","version":2}

                    async with app.state.pool.acquire() as db:
                        await db.execute(
                            "DELETE FROM board_members WHERE board_id=$1 AND user_id=$2",
                            board_id,STUDENT,
                        )
                    saved=await http.put(
                        "/api/v1/boards/"+board+"/document",
                        headers=owner,
                        json={"expected_version":2,"document":{
                            "pilot_schema":1,"items":[
                                {"id":"rect_1","kind":"pilot_rect","x":100,"y":100,
                                 "width":120,"height":80,"color":"#dbeafe",
                                 "revision":1,"created_by":str(TEACHER)}
                            ],"ink":[],"note":"second"
                        }},
                    )
                    assert saved.status_code==200,saved.text
                    second=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    assert second=={"type":"document_changed","version":3}
                    departed=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    assert departed["type"]=="presence_diff"
                    assert [u["user_id"] for u in departed["leaves"]]==[str(STUDENT)]
                    with pytest.raises(ConnectionClosed) as closed:
                        await asyncio.wait_for(ws_student.recv(),3)
                    assert closed.value.code==4403

                    logout=await http.post("/api/v1/auth/logout",headers=owner)
                    assert logout.status_code==200
                    await announce(board_id,3,app.state.pool)
                    with pytest.raises(ConnectionClosed) as closed:
                        await asyncio.wait_for(ws_owner.recv(),3)
                    assert closed.value.code==4403
            assert board_id not in api._board_color_slots, "Empty classroom must reset its color queue"
            _subscribers.pop(board_id,None)
            _subscriber_users.pop(board_id,None)
            _presence_watchers.pop(board_id,None)
    finally:
        server.should_exit=True
        await asyncio.wait_for(task,timeout=8)


@pytest.mark.asyncio
async def test_thirty_socket_sustained_classroom_load(monkeypatch):
    """One minute of real sockets, distinct accounts, and disposable Postgres."""
    count, active, rounds = 30, 3, 120
    monkeypatch.setenv("LEKTRUS_DEPLOYMENT_ORIGINS", "https://lektrus.example")
    board_id = uuid4()
    identities = [(uuid4(), uuid4()) for _ in range(count)]
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    try:
        await apply_schema(conn)
        await conn.execute("TRUNCATE account_sessions,board_documents,board_members,boards,account_users CASCADE")
        await conn.executemany(
            """INSERT INTO account_users(id,email,password_hash,display_name,email_confirmed_at)
               VALUES($1,$2,'test-only-session',$3,now())""",
            [(uid, f"load-{i}@example.test", f"Participant {i}") for i, (uid, _) in enumerate(identities)],
        )
        await conn.executemany(
            "INSERT INTO account_sessions(id,user_id,refresh_sha256,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
            [(sid, uid, str(sid)) for uid, sid in identities],
        )
        await conn.execute("UPDATE account_users SET subscription_plan='pro',subscription_until=now()+interval '1 day' WHERE id=$1", identities[0][0])
        await conn.execute("INSERT INTO boards(id,owner_id,title) VALUES($1,$2,'Load test')", board_id, identities[0][0])
        await conn.executemany("INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,$3)",
                               [(board_id, uid, "editor" if i < active else "viewer")
                                for i, (uid, _) in enumerate(identities) if i])
    finally:
        await conn.close()

    class CountingPool:
        def __init__(self, pool):
            self.pool, self.calls = pool, 0
        def acquire(self, *args, **kwargs):
            self.calls += 1
            return self.pool.acquire(*args, **kwargs)
        def __getattr__(self, name):
            return getattr(self.pool, name)

    def rss_bytes():
        try:
            return int(Path("/proc/self/statm").read_text().split()[1]) * os.sysconf("SC_PAGE_SIZE")
        except (OSError, ValueError, IndexError, AttributeError):
            return None

    config = uvicorn.Config(app, host="127.0.0.1", port=18763, log_level="error", lifespan="on")
    server = uvicorn.Server(config)
    server.install_signal_handlers = lambda: None
    task = asyncio.create_task(server.serve())
    tokens = [api.access_token(uid, sid) for uid, sid in identities]
    headers = [{"Authorization": "Bearer " + token} for token in tokens]
    try:
        for _ in range(100):
            if server.started:
                break
            if task.done():
                raise RuntimeError("Uvicorn stopped before load test startup")
            await asyncio.sleep(.05)
        assert server.started
        pool = CountingPool(app.state.pool)
        app.state.pool = pool
        # Saves are spaced five seconds apart, exactly Uvicorn's idle HTTP
        # keep-alive timeout. Avoid a transport reuse race at that boundary;
        # the 30 real WebSocket connections remain open throughout the test.
        async with httpx.AsyncClient(base_url="http://127.0.0.1:18763", timeout=8,
                                     limits=httpx.Limits(max_keepalive_connections=0)) as http:
            url = f"/api/v1/boards/{board_id}/document"
            document = {"version": 1, "items": [{"id": f"existing-{i}", "text": "a" * 4000} for i in range(400)]}
            response = await http.put(url, headers=headers[0], json={"expected_version": 0, "document": document})
            assert response.status_code == 200, response.text
            response = await http.patch(url+"?version_only=true", headers=headers[0],
                                        json={"expected_version": 1, "delta": {"set": {"title": "Load test"}}})
            assert response.json() == {"version": 2}, response.text
            version = 2
            async with AsyncExitStack() as sockets:
                clients = []
                for token in tokens:
                    ws = await sockets.enter_async_context(websockets.connect(
                        f"ws://127.0.0.1:18763/api/v1/boards/{board_id}/events",
                        origin="https://lektrus.example", max_queue=64,
                    ))
                    await ws.send(json.dumps({"type": "auth", "token": token, "compact_ink": True}))
                    ready = json.loads(await asyncio.wait_for(ws.recv(), 5))
                    assert ready == {"type": "ready", "version": 2, "compact_ink": True}
                    clients.append(ws)
                assert len(_subscribers[board_id]) == count
                server_sockets = set(_subscribers[board_id])

                async def run_round(index, expected_queries):
                    messages = [json.dumps({"type": "cursor", "client_id": f"p{i}", "x": index, "y": i}) for i in range(count)]
                    ink = [json.dumps({"type": "live_ink", "client_id": f"p{i}", "stroke_id": f"stroke-{index}-{i}",
                                       "kind": "pen", "color": "#112233", "weight": 3, "offset": 0,
                                       "points": [[index+n/10, i+n/10] for n in range(20)], "finished": True})
                           for i in range(active)]

                    async def send(i):
                        await clients[i].send(messages[i])
                        if i < active:
                            await clients[i].send(ink[i])

                    async def receive(i):
                        expected = Counter(("cursor", f"p{j}") for j in range(count) if j != i)
                        expected.update(("live_ink", f"p{j}") for j in range(active) if j != i)
                        if i < active:
                            expected[("ink_ack", f"p{i}")] += 1
                        actual, size = Counter(), 0
                        for _ in range(sum(expected.values())):
                            raw = await asyncio.wait_for(clients[i].recv(), 8)
                            size += len(raw.encode("utf-8"))
                            msg = json.loads(raw)
                            actual[(msg["type"], msg["client_id"])] += 1
                            if msg["type"] == "live_ink":
                                assert msg["finished"] and len(msg["points"]) == 20 and isinstance(msg["points"][0], list)
                                assert msg["stroke_id"].startswith(f"stroke-{index}-")
                            elif msg["type"] == "cursor":
                                assert msg["x"] == index
                        assert actual == expected
                        return size

                    before, started = pool.calls, perf_counter()
                    _, sizes = await asyncio.gather(
                        asyncio.gather(*(send(i) for i in range(count))),
                        asyncio.gather(*(receive(i) for i in range(count))),
                    )
                    assert pool.calls - before == expected_queries
                    return perf_counter()-started, sum(map(lambda s: len(s.encode("utf-8")), messages+ink)), sum(sizes)

                # A/B the exact same traffic pattern without any test-only change to SQL.
                with monkeypatch.context() as scoped:
                    scoped.setattr(api, "INLINE_RELAY_TYPES", ())
                    baseline = [await run_round(-i-1, 2*(count+active)) for i in range(5)]
                await asyncio.sleep(1.05)
                optimized = [await run_round(-i-1, count+active) for i in range(5)]
                await asyncio.sleep(1.05)
                gc.collect()
                rss_start = rss_bytes()
                rss_peak = rss_start
                times, inbound, outbound = [], 0, 0
                started = perf_counter()
                for i in range(rounds):
                    tick = perf_counter()
                    elapsed, sent, received = await run_round(i, count+active)
                    times.append(elapsed)
                    inbound += sent
                    outbound += received
                    if (i+1) % 10 == 0:
                        editor = (i//10) % active
                        response = await http.patch(url+"?version_only=true", headers=headers[editor], json={
                            "expected_version": version, "delta": {"items": {"upsert": [{"id": f"saved-{i}", "text": "lesson"}]}},
                        })
                        version += 1
                        assert response.json() == {"version": version}, response.text
                        notices = await asyncio.gather(*(asyncio.wait_for(ws.recv(), 8) for ws in clients))
                        assert all(json.loads(raw) == {"type": "document_changed", "version": version} for raw in notices)
                        outbound += sum(len(raw.encode("utf-8")) for raw in notices)
                        current_rss = rss_bytes()
                        if rss_peak is not None and current_rss is not None:
                            rss_peak = max(rss_peak, current_rss)
                    await asyncio.sleep(max(0, .5-(perf_counter()-tick)))
                duration = perf_counter()-started
                gc.collect()
                rss_end = rss_bytes()
                result = await http.get(url, headers=headers[0])
                assert result.json()["version"] == version
                assert len(result.json()["document"]["items"]) == 400+rounds//10
                assert {f"saved-{i}" for i in range(9, rounds, 10)} <= {item["id"] for item in result.json()["document"]["items"]}
                # Revocation in the immediately following event: no TTL grace period.
                async with pool.acquire() as db:
                    await db.execute("DELETE FROM board_members WHERE board_id=$1 AND user_id=$2", board_id, identities[-1][0])
                await clients[0].send(json.dumps({"type": "cursor", "client_id": "p0", "x": 1, "y": 1}))
                with pytest.raises(ConnectionClosed) as closed:
                    await asyncio.wait_for(clients[-1].recv(), 5)
                assert closed.value.code == 4403
                print("Classroom load:", json.dumps({
                    "participants": count, "seconds": round(duration, 2), "client_events": rounds*(count+active),
                    "delivered_messages": rounds*count*(count+active-1)+rounds//10*count,
                    "inbound_text_bytes": inbound, "outbound_text_bytes": outbound,
                    "database_checks_before_per_round": 2*(count+active), "database_checks_after_per_round": count+active,
                    "baseline_round_ms_median": round(sorted(r[0] for r in baseline)[2]*1000, 2),
                    "optimized_round_ms_median": round(sorted(r[0] for r in optimized)[2]*1000, 2),
                    "steady_round_ms_p95": round(sorted(times)[int(.95*len(times))-1]*1000, 2),
                    "combined_server_and_test_client_rss_bytes": [rss_start, rss_peak, rss_end],
                    "durable_saves": rounds//10,
                }))
            for _ in range(100):
                if not _subscribers.get(board_id):
                    break
                await asyncio.sleep(.02)
            assert board_id not in _subscribers
            assert board_id not in _subscriber_users and board_id not in _presence_watchers
            assert server_sockets.isdisjoint(_compact_ink_subscribers)
    finally:
        server.should_exit = True
        await asyncio.wait_for(task, timeout=8)
