"""Real Uvicorn + two WebSocket peers; synthetic accounts, disposable Postgres."""
import asyncio
import json
import os
from pathlib import Path
from uuid import UUID

import asyncpg
import bcrypt
import httpx
import pytest
import uvicorn
import websockets
from websockets.exceptions import ConnectionClosed

from app import app, announce, _login_attempts, _subscribers
from test_api import TEACHER, STUDENT, PASSWORD


@pytest.mark.asyncio
async def test_two_live_sockets_receive_revision_then_revoke():
    _login_attempts.clear()
    conn=await asyncpg.connect(os.environ["DATABASE_URL"])
    try:
        sql_dir=Path(__file__).with_name("sql")
        for script in ("001_initial.sql","002_board_assets.sql",
                       "003_board_invites.sql","004_account_verification.sql"):
            await conn.execute(sql_dir.joinpath(script).read_text())
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
                                    json={"title":"Socket test"})
            assert created.status_code==201,created.text
            board=created.json()["id"]
            board_id=UUID(board)
            async with app.state.pool.acquire() as db:
                await db.execute(
                    "INSERT INTO board_members(board_id,user_id,role) VALUES($1,$2,'viewer')",
                    board_id,STUDENT,
                )

            uri="ws://127.0.0.1:18762/api/v1/boards/"+board+"/events"
            async with websockets.connect(uri,origin="https://lektrus.example") as ws_owner:
                async with websockets.connect(uri,origin="https://lektrus.example") as ws_student:
                    await ws_owner.send(json.dumps({
                        "type":"auth","token":owner_session["access_token"]
                    }))
                    await ws_student.send(json.dumps({
                        "type":"auth","token":student_session["access_token"]
                    }))
                    oready=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    sready=json.loads(await asyncio.wait_for(ws_student.recv(),3))
                    assert oready=={"type":"ready","version":0}
                    assert sready=={"type":"ready","version":0}

                    saved=await http.put(
                        "/api/v1/boards/"+board+"/document",
                        headers=owner,
                        json={"expected_version":0,"document":{
                            "pilot_schema":1,"items":[],"ink":[],"note":"first"
                        }},
                    )
                    assert saved.status_code==200,saved.text
                    for ws in (ws_owner,ws_student):
                        msg=json.loads(await asyncio.wait_for(ws.recv(),3))
                        assert msg=={"type":"document_changed","version":1}
                        assert "document" not in msg, "WS should not resend full board JSON"

                    async with app.state.pool.acquire() as db:
                        await db.execute(
                            "DELETE FROM board_members WHERE board_id=$1 AND user_id=$2",
                            board_id,STUDENT,
                        )
                    saved=await http.put(
                        "/api/v1/boards/"+board+"/document",
                        headers=owner,
                        json={"expected_version":1,"document":{
                            "pilot_schema":1,"items":[],"ink":[],"note":"second"
                        }},
                    )
                    assert saved.status_code==200,saved.text
                    second=json.loads(await asyncio.wait_for(ws_owner.recv(),3))
                    assert second=={"type":"document_changed","version":2}
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
    finally:
        server.should_exit=True
        await asyncio.wait_for(task,timeout=8)
