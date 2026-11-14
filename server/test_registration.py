"""Synthetic email-confirmation tests: no real emails or user data."""
from urllib.parse import parse_qs, urlsplit

import asyncpg
import pytest

import registration
from app import app
from test_api import client, sign_in


def enable_staging_mail(monkeypatch, sent):
    registration._attempts.clear()
    for key,value in {
        "LEKTRUS_ENABLE_REGISTRATION":"true",
        "LEKTRUS_SMTP_HOST":"smtp.example.test",
        "LEKTRUS_SMTP_PORT":"465",
        "LEKTRUS_SMTP_USERNAME":"pilot",
        "LEKTRUS_SMTP_PASSWORD":"ci-only",
        "LEKTRUS_SMTP_FROM":"noreply@example.test",
        "LEKTRUS_PUBLIC_ORIGIN":"https://lektrus.example",
    }.items():
        monkeypatch.setenv(key,value)

    async def fake_mail(to, link):
        sent.append((to,link))
    monkeypatch.setattr(registration,"send_confirmation_email",fake_mail)


def signup_data(email="newteacher@example.test", role="teacher", password="password-safe-123"):
    return {
        "email":email,"password":password,
        "name":"Учитель Lektrus","first_name":"Имя","last_name":"Фамилия",
        "role":role,
    }


@pytest.mark.asyncio
async def test_verified_teacher_signup_without_admin_privileges(client,monkeypatch):
    sent=[]
    enable_staging_mail(monkeypatch,sent)
    data=signup_data(email="NEWTEACHER@EXAMPLE.TEST ")
    sign=await client.post("/api/v1/auth/signup",json=data)
    assert sign.status_code==202,sign.text
    assert "token" not in sign.text.lower()
    assert len(sent)==1
    email,link=sent[0]
    assert email=="newteacher@example.test"
    assert link.startswith("https://lektrus.example/confirm-email?token=")
    token=parse_qs(urlsplit(link).query)["token"][0]

    # A record exists but cannot be used before mailbox verification.
    blocked=await client.post("/api/v1/auth/login",json={
        "email":email,"password":data["password"]
    })
    assert blocked.status_code==401
    async with app.state.pool.acquire() as conn:
        row=await conn.fetchrow(
            """SELECT account_role,teacher_status,is_admin,
                      email_confirmed_at,password_hash
               FROM account_users WHERE email=$1""", email
        )
        secret=await conn.fetchrow(
            """SELECT token_sha256 FROM account_email_verifications
               WHERE user_id=(SELECT id FROM account_users WHERE email=$1)""",email
        )
    assert row["account_role"]=="teacher"
    assert row["teacher_status"]=="approved"
    assert not row["is_admin"]
    assert row["email_confirmed_at"] is None
    assert row["password_hash"] != data["password"]
    assert secret and secret["token_sha256"]!=token

    invalid=await client.post("/api/v1/auth/verify-email",json={"token":"x"*64})
    assert invalid.status_code==400
    verified=await client.post("/api/v1/auth/verify-email",json={"token":token})
    assert verified.status_code==200,verified.text
    assert (await client.post("/api/v1/auth/verify-email",
                              json={"token":token})).status_code==400
    logged=await client.post("/api/v1/auth/login",json={
        "email":email,"password":data["password"]
    })
    assert logged.status_code==200,logged.text
    session=logged.json()
    assert session["user"]["account_role"]=="teacher"
    assert session["user"]["teacher_status"]=="approved"
    assert session["user"]["is_admin"] is False

    # Existing confirmed account may not be silently re-created as pupil.
    duplicate=await client.post(
        "/api/v1/auth/signup",
        json=signup_data(email=email,role="student",password="other-pass-9876")
    )
    assert duplicate.status_code==202
    assert len(sent)==1
    async with app.state.pool.acquire() as conn:
        role=await conn.fetchval(
            "SELECT account_role FROM account_users WHERE email=$1",email
        )
    assert role=="teacher"


@pytest.mark.asyncio
async def test_student_verification_then_claims_invitation(client,monkeypatch):
    sent=[]
    enable_staging_mail(monkeypatch,sent)
    _,teacher=await sign_in(client,"teacher@example.test")
    board=(await client.post("/api/v1/boards",headers=teacher,
                             json={"title":"Урок"})).json()["id"]
    invited=await client.post(
        f"/api/v1/boards/{board}/invitations",headers=teacher,
        json={"email":"newstudent@example.test","role":"viewer"}
    )
    assert invited.json()["kind"]=="invite"

    data=signup_data(email="newstudent@example.test",role="student")
    created=await client.post("/api/v1/auth/signup",json=data)
    assert created.status_code==202
    token=parse_qs(urlsplit(sent[0][1]).query)["token"][0]
    confirmed=await client.post("/api/v1/auth/verify-email",json={"token":token})
    assert confirmed.status_code==200
    logged=await client.post("/api/v1/auth/login",json={
        "email":data["email"],"password":data["password"]
    })
    assert logged.status_code==200,logged.text
    session=logged.json()
    student={"Authorization":"Bearer "+session["access_token"]}
    assert session["user"]["account_role"]=="student"
    assert session["user"]["teacher_status"]=="none"
    assert session["user"]["is_admin"] is False
    assert (await client.get(f"/api/v1/boards/{board}",headers=student)).status_code==404
    claim=await client.post("/api/v1/invitations/claim",headers=student)
    assert claim.status_code==200 and claim.json()["claimed"]==1
    assert (await client.get(f"/api/v1/boards/{board}",
                             headers=student)).json()["role"]=="viewer"


@pytest.mark.asyncio
async def test_pending_signup_retry_and_expired_link(client,monkeypatch):
    sent=[]
    enable_staging_mail(monkeypatch,sent)
    data=signup_data(email="pending@example.test")
    first=await client.post("/api/v1/auth/signup",json=data)
    assert first.status_code==202
    old_token=parse_qs(urlsplit(sent[0][1]).query)["token"][0]
    # Wrong password cannot rotate another person's pending email token.
    bad=await client.post(
        "/api/v1/auth/signup",
        json={**data,"password":"not-original-password"}
    )
    assert bad.status_code==202
    assert len(sent)==1
    retry=await client.post("/api/v1/auth/signup",json=data)
    assert retry.status_code==202
    assert len(sent)==2
    new_token=parse_qs(urlsplit(sent[1][1]).query)["token"][0]
    assert new_token!=old_token
    assert (await client.post("/api/v1/auth/verify-email",
                              json={"token":old_token})).status_code==400
    async with app.state.pool.acquire() as conn:
        await conn.execute(
            """UPDATE account_email_verifications
                  SET expires_at=now()-interval '1 second'
                WHERE user_id=(SELECT id FROM account_users WHERE email=$1)""",
            data["email"],
        )
    assert (await client.post("/api/v1/auth/verify-email",
                              json={"token":new_token})).status_code==400
    assert (await client.post("/api/v1/auth/login",json={
        "email":data["email"],"password":data["password"]
    })).status_code==401


@pytest.mark.asyncio
async def test_registration_disabled_or_no_mail_fails_closed(client,monkeypatch):
    registration._attempts.clear()
    data=signup_data(email="offline@example.test")
    monkeypatch.delenv("LEKTRUS_ENABLE_REGISTRATION",raising=False)
    disabled=await client.post("/api/v1/auth/signup",json=data)
    assert disabled.status_code==503
    monkeypatch.setenv("LEKTRUS_ENABLE_REGISTRATION","true")
    monkeypatch.delenv("LEKTRUS_SMTP_HOST",raising=False)
    missing=await client.post("/api/v1/auth/signup",json=data)
    assert missing.status_code==503
    assert (await client.post("/api/v1/auth/signup",json={
        **data,"role":"admin"
    })).status_code==422
    async with app.state.pool.acquire() as conn:
        assert await conn.fetchval(
            "SELECT count(*) FROM account_users WHERE email=$1",data["email"]
        )==0
