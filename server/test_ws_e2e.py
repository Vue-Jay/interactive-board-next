"""Real Uvicorn + two WebSocket peers; synthetic accounts, disposable Postgres."""
import asyncio
import json
import os
from uuid import UUID

import asyncpg
import bcrypt
import httpx
import pytest
import uvicorn
import websockets
from websockets.exceptions import ConnectionClosed

from app import app, announce, _login_attempts, _subscribers, _subscriber_users, _presence_watchers
from schema import apply_schema
from test_api import TEACHER, STUDENT, PASSWORD


@pytest.mark.asyncio
async def test_two_live_sockets_receive_revision_then_revoke():
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

            uri="ws://127.0.0.1:18762/api/v1/boards/"+board+"/events"
            async with websockets.connect(uri,origin="https://lektrus.example") as ws_owner:
                async with websockets.connect(uri,origin="https://lektrus.example") as ws_student:
                    await ws_owner.send(json.dumps({
                        "type":"auth","token":owner_session["access_token"],
                        "presence":True,"visible":True,
                    }))
                    await ws_student.send(json.dumps({
                        "type":"auth","token":student_session["access_token"],
                        "presence":True,"visible":True,
                    }))
                    oready=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    sready=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    assert oready=={"type":"ready","version":1}
                    assert sready=={"type":"ready","version":1}
                    owner_presence=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    student_presence=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    owner_join=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    assert owner_presence["type"]=="presence_state"
                    assert [u["user_id"] for u in owner_presence["users"]]==[str(TEACHER)]
                    assert student_presence["type"]=="presence_state"
                    assert {u["user_id"] for u in student_presence["users"]}=={str(TEACHER),str(STUDENT)}
                    assert owner_join["type"]=="presence_diff"
                    assert [u["user_id"] for u in owner_join["joins"]]==[str(STUDENT)]

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
            _subscribers.pop(board_id,None)
            _subscriber_users.pop(board_id,None)
            _presence_watchers.pop(board_id,None)
    finally:
        server.should_exit=True
        await asyncio.wait_for(task,timeout=8)
