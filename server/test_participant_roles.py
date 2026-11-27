"""Board-local roles stay fixed when account capabilities change."""
from copy import deepcopy
from uuid import UUID, uuid4
import pytest
from app import app
from test_api import client, sign_in, TEACHER, STUDENT, OUTSIDER

@pytest.mark.asyncio
async def test_participant_roles_and_self_service_teacher_activation(client):
    _, owner = await sign_in(client, "teacher@example.test")
    _, pupil = await sign_in(client, "student@example.test")
    _, observer = await sign_in(client, "outsider@example.test")
    board_id = (await client.post("/api/v1/boards",headers=owner,json={"title":"Lesson"})).json()["id"]
    root = "/api/v1/boards/"+board_id
    async def invite(email, kind):
        return await client.post(root+"/invitations",headers=owner,json={"email":email,"role":"viewer" if kind=="observer" else "editor","participant_role":kind})
    assert (await invite("student@example.test","student")).status_code == 200
    assert (await invite("outsider@example.test","observer")).status_code == 200
    assert (await invite("outsider@example.test","co_teacher")).status_code == 422
    assert (await client.get(root,headers=pupil)).json()["participant_role"] == "student"
    assert (await client.get(root,headers=observer)).json()["participant_role"] == "observer"
    assert (await client.get(root,headers=owner)).json()["participant_role"] == "owner"
    doc = {"version":1,"title":"Lesson","items":[{"id":"quiz","kind":"quiz","quizQuestions":[]}]}
    result=await client.put(root+"/document",headers=owner,json={"expected_version":0,"document":doc})
    assert result.status_code==200,result.text
    assignment_id = str(uuid4())
    result=await client.post("/api/v1/assignments",headers=owner,json={"id":assignment_id,"student_id":str(STUDENT),"board_id":board_id,"title":"Homework"})
    assert result.status_code==201,result.text
    activated=await client.post("/api/v1/account/role/teacher",headers=pupil)
    assert activated.status_code==200,activated.text
    assert activated.json()["role"]=="teacher"
    assert (await client.get(root,headers=pupil)).json()["participant_role"]=="student"
    assert next(x for x in (await client.get("/api/v1/boards",headers=pupil)).json() if x["id"]==board_id)["participant_role"]=="student"
    # A teacher account can still complete a pupil assignment on another teacher's board.
    result=await client.post("/api/v1/assignments/"+assignment_id+"/submit",headers=pupil,json={"content":"My answer"})
    assert result.status_code==200,result.text
    assert (await client.post("/api/v1/boards",headers=pupil,json={"title":"My teaching board"})).json()["participant_role"]=="owner"
    forged = deepcopy(doc)
    forged["items"].append({"id":"forged","kind":"quiz","createdBy":str(STUDENT)})
    assert (await client.put(root+"/document",headers=pupil,json={"expected_version":1,"document":forged})).status_code==403
    assert (await client.patch(root+"/document",headers=pupil,json={"expected_version":1,"delta":{"set":{"title":"Changed"}}})).status_code==403
    assert (await client.patch(root,headers=pupil,json={"title":"Changed"})).status_code==403
    assert (await client.delete(root,headers=pupil)).status_code==403
    assert (await client.get(root+"/access",headers=pupil)).status_code==403
    ink={"id":"ink","kind":"pen","createdBy":str(STUDENT)}
    result=await client.patch(root+"/document",headers=pupil,json={"expected_version":1,"delta":{"items":{"upsert":[ink]}}})
    assert result.status_code==200,result.text
    assert (await client.patch(root+"/document",headers=observer,json={"expected_version":2,"delta":{"items":{"upsert":[ink]}}})).status_code==403
    assert (await client.post("/api/v1/account/role/teacher",headers=observer)).status_code==200
    assert (await client.get(root,headers=observer)).json()["participant_role"]=="observer"
    assert (await invite("outsider@example.test","co_teacher")).status_code==200
    assert (await client.get(root,headers=observer)).json()["participant_role"]=="co_teacher"
    result=await client.patch(root+"/document",headers=observer,json={"expected_version":2,"delta":{"items":{"upsert":[{"id":"teacher-quiz","kind":"quiz","createdBy":str(OUTSIDER)}]}}})
    assert result.status_code==200,result.text
    assert (await client.get(root+"/access",headers=observer)).status_code==403

@pytest.mark.asyncio
async def test_guest_can_never_redeem_co_teacher_link(client):
    _, owner=await sign_in(client,"teacher@example.test")
    _, pupil=await sign_in(client,"student@example.test")
    board_id=(await client.post("/api/v1/boards",headers=owner,json={"title":"Guest lesson"})).json()["id"]
    root="/api/v1/boards/"+board_id
    link=(await client.post(root+"/share-links",headers=owner,json={"role":"editor","participant_role":"co_teacher","max_uses":1})).json()
    token=link["token"]
    assert (await client.post("/api/v1/auth/guest",json={"token":token,"name":"Guest"})).status_code==403
    assert (await client.post("/api/v1/share-links/redeem",headers=pupil,json={"token":token})).status_code==403
    assert (await client.get(root+"/share-links",headers=owner)).json()[0]["use_count"]==0
    assert (await client.post("/api/v1/account/role/teacher",headers=pupil)).status_code==200
    result=await client.post("/api/v1/share-links/redeem",headers=pupil,json={"token":token})
    assert result.status_code==200,result.text
    assert result.json()["participant_role"]=="co_teacher"
    student_link=(await client.post(root+"/share-links",headers=owner,json={"role":"editor","participant_role":"student"})).json()
    result=await client.post("/api/v1/auth/guest",json={"token":student_link["token"],"name":"Guest Learner"})
    assert result.status_code==200,result.text
    guest={"Authorization":"Bearer "+result.json()["access_token"]}
    assert (await client.get(root,headers=guest)).json()["participant_role"]=="student"
    assert (await client.post("/api/v1/account/role/teacher",headers=guest)).status_code==403
    assert (await client.post(root+"/share-links",headers=owner,json={"role":"viewer","participant_role":"co_teacher"})).status_code==422


@pytest.mark.asyncio
async def test_student_and_guest_can_erase_shared_ink_but_not_locked_lesson(client):
    _, owner = await sign_in(client, "teacher@example.test")
    _, pupil = await sign_in(client, "student@example.test")
    _, observer = await sign_in(client, "outsider@example.test")
    board_id = (await client.post("/api/v1/boards", headers=owner, json={"title":"Shared ink"})).json()["id"]
    root = "/api/v1/boards/"+board_id
    for email,role,kind in [("student@example.test","editor","student"),("outsider@example.test","viewer","observer")]:
        invite=await client.post(root+"/invitations", headers=owner, json={"email":email,"role":role,"participant_role":kind})
        assert invite.status_code==200, invite.text
    link=(await client.post(root+"/share-links",headers=owner,json={"role":"editor","participant_role":"student"})).json()
    guest=await client.post("/api/v1/auth/guest",json={"token":link["token"],"name":"Guest Learner"})
    assert guest.status_code==200,guest.text
    guest_headers={"Authorization":"Bearer "+guest.json()["access_token"]}
    locked={"id":"lesson","kind":"text","text":"Protected task","locked":True,"createdBy":str(TEACHER)}
    teacher_ink={"id":"shared-pen","kind":"pen","createdBy":str(TEACHER),"points":[{"x":1,"y":2},{"x":3,"y":4}]}
    compact_stroke={"id":"shared-marker","kind":"marker","createdBy":str(TEACHER),"points":[{"x":10,"y":20},{"x":30,"y":40}]}
    document={"version":1,"items":[locked,teacher_ink],"ink":[{"after":1,"stroke":compact_stroke}]}
    saved=await client.put(root+"/document",headers=owner,json={"expected_version":0,"document":document})
    assert saved.status_code==200,saved.text
    for headers in (pupil,guest_headers):
        deleted=await client.patch(root+"/document",headers=headers,json={"expected_version":1,"delta":{"items":{"remove":["lesson"]}}})
        assert deleted.status_code==403,deleted.text
        moved=await client.patch(root+"/document",headers=headers,json={"expected_version":1,"delta":{"items":{"upsert":[{**locked,"x":10}]}}})
        assert moved.status_code==403,moved.text
        lock_ink=await client.patch(root+"/document",headers=headers,json={"expected_version":1,"delta":{"items":{"upsert":[{**teacher_ink,"locked":True}]}}})
        assert lock_ink.status_code==403,lock_ink.text
    erase_delta={"items":{"remove":["shared-pen"]}}
    assert (await client.patch(root+"/document",headers=observer,json={"expected_version":1,"delta":erase_delta})).status_code==403
    erased=await client.patch(root+"/document",headers=pupil,json={"expected_version":1,"delta":erase_delta})
    assert erased.status_code==200,erased.text
    compact_erase=await client.patch(root+"/document",headers=guest_headers,json={"expected_version":2,"delta":{"set":{"ink":[]}}})
    assert compact_erase.status_code==200,compact_erase.text
    actual=(await client.get(root+"/document",headers=owner)).json()
    assert actual["version"]==3
    assert actual["document"]["items"]==[locked] and actual["document"]["ink"]==[]


@pytest.mark.asyncio
async def test_shared_ink_eraser_in_both_directions(client):
    _, owner = await sign_in(client, "teacher@example.test")
    _, pupil = await sign_in(client, "student@example.test")
    _, colleague = await sign_in(client, "outsider@example.test")
    board_id = (await client.post("/api/v1/boards",headers=owner,json={"title":"Shared eraser matrix"})).json()["id"]
    root = "/api/v1/boards/"+board_id
    assert (await client.post(root+"/invitations",headers=owner,json={"email":"student@example.test","role":"editor","participant_role":"student"})).status_code==200
    assert (await client.post("/api/v1/account/role/teacher",headers=colleague)).status_code==200
    assert (await client.post(root+"/invitations",headers=owner,json={"email":"outsider@example.test","role":"editor","participant_role":"co_teacher"})).status_code==200
    link=(await client.post(root+"/share-links",headers=owner,json={"role":"editor","participant_role":"student"})).json()
    guest=(await client.post("/api/v1/auth/guest",json={"token":link["token"],"name":"Guest Learner"})).json()
    guest_headers={"Authorization":"Bearer "+guest["access_token"]}
    locked={"id":"task","kind":"text","createdBy":str(TEACHER),"locked":True,"text":"Keep"}
    doc={"version":1,"items":[locked]}
    assert (await client.put(root+"/document",headers=owner,json={"expected_version":0,"document":doc})).status_code==200
    version=1
    roles=[(owner,str(TEACHER)),(pupil,str(STUDENT)),(colleague,str(OUTSIDER)),(guest_headers,guest["user"]["id"])]
    for writer,writer_id in roles:
        for eraser,eraser_id in roles:
            for kind in ("pen","marker"):
                original={"id":str(uuid4()),"kind":kind,"createdBy":writer_id,"points":[{"x":0,"y":0},{"x":20,"y":0}]}
                response=await client.patch(root+"/document",headers=writer,json={"expected_version":version,"delta":{"items":{"upsert":[original]}}})
                assert response.status_code==200,response.text
                version+=1
                fragment={**original,"id":str(uuid4()),"createdBy":eraser_id,"points":[{"x":0,"y":0},{"x":5,"y":0}]}
                response=await client.patch(root+"/document",headers=eraser,json={"expected_version":version,"delta":{"items":{"remove":[original["id"]],"upsert":[fragment]}}})
                assert response.status_code==200,response.text
                version+=1
                response=await client.patch(root+"/document",headers=writer,json={"expected_version":version,"delta":{"items":{"remove":[fragment["id"]]}}})
                assert response.status_code==200,response.text
                version+=1
    result=(await client.get(root+"/document",headers=owner)).json()
    assert result["document"]["items"]==[locked]
    assert result["version"]==version


@pytest.mark.asyncio
async def test_photo_permissions_and_peer_document_convergence(client):
    from document_delta import apply_delta
    _, owner = await sign_in(client, "teacher@example.test")
    _, pupil = await sign_in(client, "student@example.test")
    board_id = (await client.post("/api/v1/boards", headers=owner, json={"title":"Photo lesson"})).json()["id"]
    root = "/api/v1/boards/"+board_id
    url = root+"/document"
    invite = await client.post(root+"/invitations", headers=owner, json={"email":"student@example.test","role":"editor","participant_role":"student"})
    assert invite.status_code == 200, invite.text
    teacher_image = {"id":"teacher-photo","kind":"image","x":0,"y":0,"width":100,"height":100,"createdBy":str(TEACHER)}
    legacy_image = {"id":"legacy-photo","kind":"image"}
    initial = {"version":1,"items":[teacher_image,legacy_image]}
    saved = await client.put(url,headers=owner,json={"expected_version":0,"document":initial})
    assert saved.status_code == 200, saved.text
    crop = {"x":0.1,"y":0.1,"width":0.8,"height":0.8}
    for image in (teacher_image,legacy_image):
        attempt = await client.patch(url,headers=pupil,json={"expected_version":1,"delta":{"items":{"upsert":[{**image,"imageCrop":crop}]}}})
        assert attempt.status_code == 403, attempt.text
    forged = deepcopy(initial)
    forged["items"][0]["imageCrop"] = crop
    assert (await client.put(url,headers=pupil,json={"expected_version":1,"document":forged})).status_code == 403
    assert (await client.patch(url,headers=pupil,json={"expected_version":1,"delta":{"items":{"remove":["teacher-photo"]}}})).status_code == 403
    pupil_photo = {"id":"pupil-photo","kind":"image","createdBy":str(STUDENT)}
    moved = {**teacher_image,"x":40,"width":125}
    changes = [
        (pupil, {"items":{"upsert":[moved,pupil_photo]}}),
        (pupil, {"items":{"upsert":[{**pupil_photo,"imageCrop":crop}]}}),
        (owner, {"items":{"upsert":[{**moved,"imageCrop":crop}]}}),
        (owner, {"items":{"remove":["teacher-photo","legacy-photo"]}}),
    ]
    for version,(headers,delta) in enumerate(changes,1):
        result = await client.patch(url,headers=headers,json={"expected_version":version,"delta":delta})
        assert result.status_code == 200, result.text
    remote = (await client.get(url+"?since_version=1",headers=pupil)).json()
    assert remote["version"] == 5 and remote["base_version"] == 1
    reconstructed = initial
    for patch in remote["patches"]:
        reconstructed = apply_delta(reconstructed,patch)
    final = (await client.get(url,headers=owner)).json()["document"]
    assert reconstructed == final == {"version":1,"items":[{**pupil_photo,"imageCrop":crop}]}
    assert (await client.get(url,headers=pupil)).json()["document"] == final

@pytest.mark.asyncio
async def test_student_all_allowed_object_kinds_and_admin_sync_journal(client):
    _, owner=await sign_in(client,"teacher@example.test")
    _, pupil=await sign_in(client,"student@example.test")
    board_id=(await client.post("/api/v1/boards",headers=owner,json={"title":"Lesson"})).json()["id"]
    root="/api/v1/boards/"+board_id
    assert (await client.post(root+"/invitations",headers=owner,json={"email":"student@example.test","role":"editor","participant_role":"student"})).status_code==200
    original={"id":"teacher-shape","kind":"shape","createdBy":str(TEACHER),"x":0,"y":0}
    doc={"version":1,"title":"Lesson","items":[original]}
    assert (await client.put(root+"/document",headers=owner,json={"expected_version":0,"document":doc})).status_code==200
    kinds=("sticky","text","shape","image","pdf","connector","comment","fraction","instrument","pen","marker")
    objects=[{"id":"student-"+kind,"kind":kind,"createdBy":str(STUDENT),"x":1,"y":2} for kind in kinds]
    saved=await client.patch(root+"/document",headers=pupil,json={"expected_version":1,"delta":{"items":{"upsert":objects}}})
    assert saved.status_code==200,saved.text
    assert (await client.get(root+"/document",headers=owner)).json()["document"]["items"]==[original,*objects]
    changed=[{**item,"x":10,"y":11} for item in objects]
    assert (await client.patch(root+"/document",headers=pupil,json={"expected_version":2,"delta":{"items":{"upsert":changed}}})).status_code==200
    assert (await client.get(root+"/document",headers=owner)).json()["document"]["items"]==[original,*changed]
    assert (await client.patch(root+"/document",headers=pupil,json={"expected_version":3,"delta":{"items":{"remove":[item["id"] for item in changed]}}})).status_code==200
    assert (await client.get(root+"/document",headers=owner)).json()["document"]["items"]==[original]
    assert (await client.post(root+"/sync-journal",headers=pupil,json={"events":[{"event":"object_change","added":len(objects),"version":1}]})).status_code==200
    assert (await client.post(root+"/sync-journal",headers=pupil,json={"events":[{"event":"object_change","text":"private lesson"}]})).status_code==422
    assert (await client.get(root+"/sync-journal",headers=pupil)).status_code==403
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET is_admin=true WHERE id=$1",TEACHER)
    exported=await client.get(root+"/sync-journal",headers=owner)
    assert exported.status_code==200,exported.text
    rows=exported.json()["events"]
    assert any(row["source"]=="client" and row["event"]=="object_change" and row["actor_id"]==str(STUDENT) for row in rows)
    assert any(row["source"]=="server" and row["event"]=="save_ack" and row["version"]==4 for row in rows)
