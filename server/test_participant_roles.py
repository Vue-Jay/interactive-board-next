"""Board-local roles stay fixed when account capabilities change."""
from copy import deepcopy
from uuid import UUID, uuid4
import pytest
from app import app
from test_api import client, sign_in, STUDENT, OUTSIDER

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
