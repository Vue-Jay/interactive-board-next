"""Two real native origins against an isolated API and disposable PostgreSQL.

The mobile WebViews use bearer sessions, never cookies or production credentials.
The test opens genuine WebSockets and verifies HTTP CORS, documents and files.
"""
import asyncio
import json
import socket
from urllib.parse import quote
from uuid import uuid4

import httpx
import pytest
import uvicorn
import websockets

from app import app
from test_api import PASSWORD, client


ANDROID = "https://localhost"
IOS = "capacitor://localhost"


@pytest.mark.asyncio
async def test_native_android_ios_online_roundtrip(client, monkeypatch, tmp_path):
    monkeypatch.setenv("LEKTRUS_ASSETS_DIR", str(tmp_path / "private-assets"))
    # The fixture already started the real application lifespan against the
    # disposable database. Expose that same instance on an ephemeral local port.
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen(128)
        port = listener.getsockname()[1]
        server = uvicorn.Server(uvicorn.Config(app, log_level="error", lifespan="off"))
        server.install_signal_handlers = lambda: None
        task = asyncio.create_task(server.serve(sockets=[listener]))
        try:
            for _ in range(100):
                if server.started:
                    break
                if task.done():
                    await task
                await asyncio.sleep(.05)
            assert server.started, "Isolated server did not start"
            async with httpx.AsyncClient(base_url=f"http://127.0.0.1:{port}", timeout=10) as http:
                async def preflight(path, origin, method, headers):
                    return await http.options(path, headers={
                        "Origin": origin, "Access-Control-Request-Method": method,
                        "Access-Control-Request-Headers": headers,
                    })

                for origin in (ANDROID, IOS):
                    response = await preflight("/api/v1/auth/login", origin, "POST", "content-type")
                    assert response.status_code == 200
                    assert response.headers["access-control-allow-origin"] == origin
                bad = await preflight("/api/v1/auth/login", ANDROID + ".evil.test", "POST", "content-type")
                assert bad.status_code == 400 and "access-control-allow-origin" not in bad.headers

                async def login(email, origin):
                    response = await http.post("/api/v1/auth/login", headers={"Origin": origin},
                                               json={"email": email, "password": PASSWORD})
                    assert response.status_code == 200, response.text
                    assert response.headers["access-control-allow-origin"] == origin
                    session = response.json()
                    return session, {"Origin": origin, "Authorization": "Bearer " + session["access_token"]}

                teacher_session, android = await login("teacher@example.test", ANDROID)
                student_session, ios = await login("student@example.test", IOS)
                _, outsider = await login("outsider@example.test", IOS)
                assert (await http.get("/api/v1/auth/me", headers=android)).json()["id"] == teacher_session["user"]["id"]
                assert (await http.get("/api/v1/auth/me", headers=ios)).json()["id"] == student_session["user"]["id"]

                created = await http.post("/api/v1/boards", headers=android, json={"title": "Native mobile roundtrip"})
                assert created.status_code == 201, created.text
                board = created.json()["id"]
                base = f"/api/v1/boards/{board}"
                assert (await http.get(base, headers=ios)).status_code == 404
                link = await http.post(base + "/share-links", headers=android, json={"role": "editor", "max_uses": 1})
                assert link.status_code == 201, link.text
                token = link.json()["token"]
                joined = await http.post("/api/v1/share-links/redeem", headers=ios, json={"token": token})
                assert joined.status_code == 200 and joined.json()["role"] == "editor"
                assert joined.json()["participant_role"] == "student"
                assert (await http.post("/api/v1/share-links/redeem", headers=outsider, json={"token": token})).status_code == 404

                uri = f"ws://127.0.0.1:{port}{base}/events"
                with pytest.raises(websockets.exceptions.InvalidStatusCode) as rejected:
                    async with websockets.connect(uri, origin=IOS + ".evil.test"):
                        pass
                assert rejected.value.status_code == 403
                async with websockets.connect(uri, origin=ANDROID) as first, websockets.connect(uri, origin=IOS) as second:
                    async def recv(ws):
                        return json.loads(await asyncio.wait_for(ws.recv(), 5))

                    for ws, session in ((first, teacher_session), (second, student_session)):
                        await ws.send(json.dumps({"type": "auth", "token": session["access_token"]}))
                        assert await recv(ws) == {"type": "ready", "version": 0}

                    # Verify both directions, including the remote participant's role and cursor.
                    for sender, receiver, session, role in ((first, second, teacher_session, "owner"),
                                                               (second, first, student_session, "editor")):
                        await sender.send(json.dumps({"type": "cursor", "client_id": "mobile_qa", "x": 43.5, "y": 71.2}))
                        cursor = await recv(receiver)
                        assert cursor["type"] == "cursor" and cursor["user_id"] == session["user"]["id"]
                        assert cursor["role"] == role and cursor["x"] == 43.5 and cursor["y"] == 71.2
                        stroke = {"type": "live_ink", "client_id": "mobile_qa", "stroke_id": "stroke_mobile", "kind": "pen",
                                  "color": "#2477ee", "weight": 3, "offset": 0, "points": [{"x": 20, "y": 30}], "finished": True}
                        await sender.send(json.dumps(stroke))
                        assert (await recv(receiver))["points"] == stroke["points"]
                        assert (await recv(sender))["type"] == "ink_ack"

                    document = {"version": 1, "items": [{"id": "mobile-text", "kind": "text", "text": "Android"}], "ink": []}
                    saved = await http.put(base + "/document", headers=android, json={"expected_version": 0, "document": document})
                    assert saved.status_code == 200, saved.text
                    for ws in (first, second):
                        assert await recv(ws) == {"type": "document_changed", "version": 1}
                    read = await http.get(base + "/document", headers=ios)
                    assert read.json()["document"] == document
                    changed = {"id": "mobile-text", "kind": "text", "text": "iOS"}
                    patch = await http.patch(base + "/document", headers=ios, json={"expected_version": 1, "delta": {"items": {"upsert": [changed]}}})
                    # An editor invitation now means learner access, not ownership
                    # of the teacher's content. Assert the denial and then exercise
                    # the same real native delta / realtime path with learner ink.
                    assert patch.status_code == 403, patch.text
                    assert (await http.get(base + "/document", headers=android)).json()["document"]["items"] == document["items"]
                    ink = {"id": "mobile-learner-ink", "kind": "pen", "createdBy": student_session["user"]["id"], "points": [{"x": 20,"y":30}]}
                    patch = await http.patch(base + "/document", headers=ios, json={"expected_version": 1, "delta": {"items": {"upsert": [ink]}}})
                    assert patch.status_code == 200, patch.text
                    for ws in (first, second):
                        assert await recv(ws) == {"type": "document_changed", "version": 2}
                    assert (await http.get(base + "/document", headers=android)).json()["document"]["items"] == [document["items"][0], ink]
                    assert (await http.get(base + "/document", headers=outsider)).status_code == 404

                # Native teacher uploads a material using the same custom headers as WebView.
                material = f"/api/v1/materials/{uuid4()}"
                pre = await preflight(material, ANDROID, "POST", "authorization,content-type,x-file-name,x-material-title,x-material-folder")
                assert pre.status_code == 200 and pre.headers["access-control-allow-origin"] == ANDROID
                payload = "Материал QA".encode()
                uploaded = await http.post(material, headers={**android, "Content-Type": "text/plain", "X-File-Name": quote("урок.txt"),
                      "X-Material-Title": quote("Урок"), "X-Material-Folder": quote("Тест")}, content=payload)
                assert uploaded.status_code == 201, uploaded.text
                downloaded = await http.get(material + "/file", headers=android)
                assert downloaded.content == payload and downloaded.headers["access-control-allow-origin"] == ANDROID
                assert (await http.get(material + "/file", headers=ios)).status_code == 404

                # Session refresh and logout must behave identically in both apps.
                for session, headers in ((teacher_session, android), (student_session, ios)):
                    refresh = await http.post("/api/v1/auth/refresh", headers={"Origin": headers["Origin"]},
                                              json={"refresh_token": session["refresh_token"]})
                    assert refresh.status_code == 200 and refresh.headers["access-control-allow-origin"] == headers["Origin"]
                    assert (await http.get("/api/v1/auth/me", headers=headers)).status_code == 401
                    renewed = {**headers, "Authorization": "Bearer " + refresh.json()["access_token"]}
                    assert (await http.get("/api/v1/auth/me", headers=renewed)).status_code == 200
                    assert (await http.post("/api/v1/auth/logout", headers=renewed)).status_code == 200
                    assert (await http.get("/api/v1/auth/me", headers=renewed)).status_code == 401
        finally:
            server.should_exit = True
            await asyncio.wait_for(task, 15)
