"""Owner-only board invitations, role changes, and verified account claims."""
from uuid import UUID, uuid4

import asyncpg
import bcrypt
import pytest

from app import app
from test_api import TEACHER, STUDENT, OUTSIDER, PASSWORD, client, sign_in


@pytest.mark.asyncio
async def test_owner_controls_membership_and_existing_account_invitation(client):
    _, teacher = await sign_in(client, "teacher@example.test")
    _, student = await sign_in(client, "student@example.test")
    _, stranger = await sign_in(client, "outsider@example.test")
    response = await client.post(
        "/api/v1/boards", headers=teacher, json={"title":"Алгебра"}
    )
    assert response.status_code == 201
    board = response.json()["id"]
    base = f"/api/v1/boards/{board}"
    invite = base + "/invitations"

    assert (await client.post(invite, headers=stranger, json={
        "email":"student@example.test", "role":"editor"
    })).status_code == 404
    assert (await client.get(base+"/access", headers=stranger)).status_code == 404
    assert (await client.get(base+"/access", headers=student)).status_code == 404
    assert (await client.post(invite, headers=teacher, json={
        "email":"teacher@example.test", "role":"editor"
    })).status_code == 422
    assert (await client.post(invite, headers=teacher, json={
        "email":"student@example.test", "role":"owner"
    })).status_code == 422
    accepted = await client.post(invite, headers=teacher, json={
        "email":" STUDENT@EXAMPLE.TEST ", "role":"editor"
    })
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["kind"] == "member"
    assert (await client.get(base, headers=student)).json()["role"] == "editor"

    # An editor cannot manage permissions or invite outsiders.
    assert (await client.post(invite, headers=student, json={
        "email":"outsider@example.test","role":"viewer"
    })).status_code == 403
    assert (await client.get(base+"/access", headers=student)).status_code == 403
    assert (await client.patch(base+f"/members/{OUTSIDER}",headers=student,
        json={"role":"viewer"})).status_code == 403
    assert (await client.delete(base+f"/members/{TEACHER}",
                                headers=student)).status_code == 403

    members = await client.get(base+"/access", headers=teacher)
    assert members.status_code == 200, members.text
    assert len(members.json()["members"]) == 1
    assert members.json()["members"][0]["user_id"] == str(STUDENT)
    downgrade = await client.patch(
        base+f"/members/{STUDENT}", headers=teacher, json={"role":"viewer"}
    )
    assert downgrade.status_code == 200
    assert (await client.get(base, headers=student)).json()["role"] == "viewer"
    assert (await client.patch(base+f"/members/{STUDENT}",headers=teacher,
        json={"role":"owner"})).status_code == 422

    assert (await client.delete(base+f"/members/{STUDENT}",
                                headers=teacher)).status_code == 204
    assert (await client.get(base, headers=student)).status_code == 404
    assert (await client.get(base+"/access", headers=teacher)).json()["members"] == []


@pytest.mark.asyncio
async def test_invitation_for_future_confirmed_student_and_revoke(client):
    _, teacher = await sign_in(client, "teacher@example.test")
    board = (await client.post(
        "/api/v1/boards",headers=teacher,json={"title":"Математика"}
    )).json()["id"]
    root = f"/api/v1/boards/{board}"
    base = root + "/invitations"
    first = await client.post(base,headers=teacher,json={
        "email":" FUTURE@EXAMPLE.TEST ", "role":"viewer"
    })
    assert first.status_code == 200, first.text
    assert first.json()["kind"] == "invite"
    listed = (await client.get(root+"/access",headers=teacher)).json()["invites"]
    assert len(listed) == 1
    assert listed[0]["email"] == "future@example.test"
    assert listed[0]["role"] == "viewer"
    invite_id = listed[0]["id"]

    # Reinviting one email changes role without duplicate pending rows.
    second = await client.post(base,headers=teacher,json={
        "email":"future@example.test","role":"editor"
    })
    assert second.json()["kind"] == "invite"
    listed = (await client.get(root+"/access",headers=teacher)).json()["invites"]
    assert len(listed) == 1 and listed[0]["id"] == invite_id
    assert listed[0]["role"] == "editor"
    assert (await client.delete(base+f"/{invite_id}",headers=teacher)).status_code == 204
    assert (await client.get(root+"/access",headers=teacher)).json()["invites"] == []
    assert (await client.post(base,headers=teacher,json={
        "email":"future@example.test","role":"viewer"
    })).json()["kind"] == "invite"

    future_id = uuid4()
    async with app.state.pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO account_users(id,email,password_hash,display_name,
                       account_role,teacher_status,email_confirmed_at)
               VALUES ($1,$2,$3,$4,'student','none',NULL)""",
            future_id,"future@example.test",
            bcrypt.hashpw(PASSWORD.encode(),bcrypt.gensalt(rounds=4)).decode(),
            "Будущий ученик",
        )
    # Unconfirmed accounts cannot read or claim invitations.
    assert (await client.post("/api/v1/auth/login", json={
        "email":"future@example.test","password":PASSWORD
    })).status_code == 401
    assert (await client.post(base,headers=teacher,json={
        "email":"future@example.test","role":"editor"
    })).json()["kind"] == "invite"

    async with app.state.pool.acquire() as conn:
        await conn.execute(
            "UPDATE account_users SET email_confirmed_at=now() WHERE id=$1",
            future_id,
        )
    _, future = await sign_in(client,"future@example.test")
    assert (await client.get(root,headers=future)).status_code == 404
    claim = await client.post("/api/v1/invitations/claim",headers=future)
    assert claim.status_code == 200,claim.text
    assert claim.json()["claimed"] == 1
    assert (await client.get(root,headers=future)).json()["role"] == "editor"
    assert (await client.post("/api/v1/invitations/claim",headers=future)).json()["claimed"] == 0
    assert (await client.get(root+"/access",headers=teacher)).json()["invites"] == []


@pytest.mark.asyncio
async def test_invitation_cannot_be_claimed_by_different_email(client):
    _, teacher = await sign_in(client, "teacher@example.test")
    _, stranger = await sign_in(client, "outsider@example.test")
    board = (await client.post(
        "/api/v1/boards",headers=teacher,json={"title":"Биология"}
    )).json()["id"]
    invitation = await client.post(
        f"/api/v1/boards/{board}/invitations",headers=teacher,
        json={"email":"not-outsider@example.test","role":"editor"},
    )
    assert invitation.status_code == 200
    assert invitation.json()["kind"] == "invite"
    assert (await client.post("/api/v1/invitations/claim",
                              headers=stranger)).json()["claimed"] == 0
    assert (await client.get(f"/api/v1/boards/{board}",
                             headers=stranger)).status_code == 404
