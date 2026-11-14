"""Optional verified teacher/student registration for isolated Lektrus backend.

Registration is OFF unless explicitly enabled and HTTPS SMTP settings exist.
No endpoint returns a verification token or automatically activates an account.
Only a SHA-256 digest of each one-time link token is stored.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import secrets
import smtplib
import ssl
import time
from collections import defaultdict, deque
from email.message import EmailMessage
from typing import Literal
from urllib.parse import quote, urlsplit
from uuid import uuid4

import asyncpg
import bcrypt
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from invitations import normalize_email


class SignupInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=6, max_length=72)
    name: str = Field(min_length=2, max_length=100)
    first_name: str = Field(default="", max_length=100)
    last_name: str = Field(default="", max_length=100)
    role: Literal["teacher", "student"]


class VerifyEmailInput(BaseModel):
    token: str = Field(min_length=32, max_length=200)


_attempts: dict[str, deque[float]] = defaultdict(deque)


def throttle(email: str):
    now = time.monotonic()
    key = hashlib.sha256(email.encode()).hexdigest()
    if len(_attempts) > 1024:
        for k in list(_attempts):
            if not _attempts[k] or now - _attempts[k][-1] > 3600:
                _attempts.pop(k, None)
    attempts = _attempts[key]
    while attempts and now - attempts[0] >= 3600:
        attempts.popleft()
    if len(attempts) >= 3 or len(_attempts) > 2048:
        raise HTTPException(429, "Слишком много запросов. Повторите позже.")
    attempts.append(now)


def server_mail_config() -> tuple[str, int, str, str, str, str]:
    if os.environ.get("LEKTRUS_ENABLE_REGISTRATION", "").lower() != "true":
        raise HTTPException(503, "Регистрация на новом сервере ещё не включена.")
    host = os.environ.get("LEKTRUS_SMTP_HOST", "").strip()
    user = os.environ.get("LEKTRUS_SMTP_USERNAME", "").strip()
    password = os.environ.get("LEKTRUS_SMTP_PASSWORD", "").strip()
    sender = os.environ.get("LEKTRUS_SMTP_FROM", "").strip()
    origin = os.environ.get("LEKTRUS_PUBLIC_ORIGIN", "").strip().rstrip("/")
    try:
        port = int(os.environ.get("LEKTRUS_SMTP_PORT", "465"))
    except ValueError:
        port = -1
    parsed = urlsplit(origin)
    if (not host or not user or not password or not sender or
        port not in (465, 587) or parsed.scheme != "https" or
        not parsed.hostname or parsed.username or parsed.password or
        parsed.path not in ("", "/") or parsed.query or parsed.fragment):
        raise HTTPException(503, "Почта или HTTPS-домен регистрации не настроены.")
    return host, port, user, password, sender, origin


async def send_confirmation_email(email: str, link: str) -> None:
    host, port, username, password, sender, _ = server_mail_config()

    def send() -> None:
        msg = EmailMessage()
        msg["From"] = sender
        msg["To"] = email
        msg["Subject"] = "Подтверждение регистрации Lektrus"
        msg.set_content(
            "Для подтверждения адреса электронной почты Lektrus откройте ссылку:\n"
            + link + "\n\nСсылка действует 24 часа. Если вы не регистрировались, "
            "не открывайте её.\n"
        )
        context = ssl.create_default_context()
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=10, context=context) as smtp:
                smtp.login(username, password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=10) as smtp:
                smtp.ehlo()
                smtp.starttls(context=context)
                smtp.ehlo()
                smtp.login(username, password)
                smtp.send_message(msg)

    await asyncio.to_thread(send)


def make_registration_router() -> APIRouter:
    router = APIRouter()

    @router.post("/api/v1/auth/signup", status_code=202)
    async def signup(data: SignupInput, request: Request):
        _, _, _, _, _, origin = server_mail_config()
        email = normalize_email(data.email)
        if len(data.password.encode("utf-8")) > 72:
            raise HTTPException(422, "Пароль слишком длинный.")
        name = data.name.strip()
        if len(name) < 2:
            raise HTTPException(422, "Укажите имя.")
        throttle(email)
        # Password hashing is intentionally off the event loop.
        new_hash = await asyncio.to_thread(
            bcrypt.hashpw, data.password.encode("utf-8"), bcrypt.gensalt()
        )
        token = secrets.token_urlsafe(48)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        should_send = False

        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                user = await conn.fetchrow(
                    """SELECT id,password_hash,email_confirmed_at
                         FROM account_users WHERE email=$1 FOR UPDATE""", email
                )
                if user is None:
                    user_id = uuid4()
                    # An email raced with another signup: never modify the
                    # credentials or self-selected role of the winner.
                    inserted = await conn.fetchval(
                        """INSERT INTO account_users
                           (id,email,password_hash,display_name,first_name,
                            last_name,account_role,teacher_status,is_admin)
                           VALUES($1,$2,$3,$4,$5,$6,$7,$8,false)
                           ON CONFLICT(email) DO NOTHING RETURNING id""",
                        user_id, email, new_hash.decode(), name,
                        data.first_name.strip(), data.last_name.strip(),
                        data.role, "approved" if data.role == "teacher" else "none",
                    )
                    if inserted is not None:
                        should_send = True
                elif user["email_confirmed_at"] is None:
                    # Retry only with the ORIGINAL pending password. An
                    # unauthenticated caller cannot change role or password.
                    should_send = await asyncio.to_thread(
                        bcrypt.checkpw, data.password.encode("utf-8"),
                        user["password_hash"].encode()
                    )
                    user_id = user["id"]
                if should_send:
                    await conn.execute(
                        """INSERT INTO account_email_verifications
                           (user_id,token_sha256,expires_at)
                           VALUES($1,$2,now()+interval '24 hours')
                           ON CONFLICT(user_id) DO UPDATE
                           SET token_sha256=excluded.token_sha256,
                               expires_at=excluded.expires_at""",
                        user_id, token_hash,
                    )

        if should_send:
            link = origin + "/confirm-email?token=" + quote(token, safe="")
            try:
                await send_confirmation_email(email, link)
            except Exception:
                # No verification token is leaked in an error or response.
                # Pending account can retry with its ORIGINAL password.
                raise HTTPException(503, "Не удалось отправить письмо. Повторите позже.") from None

        # Never disclose whether the email already has an account.
        return {"ok": True, "message": "Если регистрация возможна, письмо отправлено."}

    @router.post("/api/v1/auth/verify-email")
    async def verify_email(data: VerifyEmailInput, request: Request):
        token_hash = hashlib.sha256(data.token.encode()).hexdigest()
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    """SELECT user_id FROM account_email_verifications
                       WHERE token_sha256=$1 AND expires_at>now() FOR UPDATE""",
                    token_hash,
                )
                if row is None:
                    raise HTTPException(400, "Ссылка подтверждения недействительна или истекла.")
                changed = await conn.fetchval(
                    """UPDATE account_users SET email_confirmed_at=now()
                       WHERE id=$1 AND email_confirmed_at IS NULL RETURNING id""",
                    row["user_id"],
                )
                await conn.execute(
                    "DELETE FROM account_email_verifications WHERE user_id=$1",
                    row["user_id"],
                )
                if changed is None:
                    raise HTTPException(400, "Адрес уже подтверждён.")
        return {"ok": True, "message": "Почта подтверждена. Теперь можно войти."}

    return router
