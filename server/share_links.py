"""Access links for confirmed accounts and board-scoped guest sessions."""
import asyncio
import hashlib
import secrets
import time
from collections import deque
from datetime import datetime, timezone
from uuid import UUID, uuid4

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import AwareDatetime, BaseModel, Field

from invitations import RoleInput, owner_only


class CreateLink(RoleInput):
    expires_at: AwareDatetime | None = None
    max_uses: int | None = Field(None, ge=1, le=10000)
    password: str | None = Field(None, max_length=72)


class RedeemLink(BaseModel):
    token: str = Field(pattern=r"^[a-f0-9]{64}$")
    password: str | None = Field(None, max_length=72)


class GuestLink(RedeemLink):
    name: str = Field(min_length=2, max_length=60)


_guest_attempts: deque[float] = deque()


async def consume_link(conn, data: RedeemLink):
    digest = token_hash(data.token)
    invalid = HTTPException(404, "Ссылка недействительна, истекла или исчерпала лимит входов.")
    link = await conn.fetchrow(
        f"SELECT board_id,password_hash FROM board_share_links WHERE token_hash=$1 AND {ACTIVE}", digest)
    if link is None:
        raise invalid
    password = (data.password or "").encode()
    if link["password_hash"] and (not password or len(password) > 72 or not await asyncio.to_thread(
        bcrypt.checkpw, password, link["password_hash"].encode()
    )):
        raise HTTPException(403, "Неверный пароль ссылки.")
    board = await conn.fetchrow(
        "SELECT * FROM boards WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", link["board_id"])
    if board is None:
        raise invalid
    link_role = await conn.fetchrow(
        f"UPDATE board_share_links SET use_count=use_count+1 WHERE token_hash=$1 AND {ACTIVE} RETURNING role,participant_role", digest)
    if link_role is None:
        raise invalid
    role = link_role["role"]
    return board, role, link_role["participant_role"] or ("observer" if role == "viewer" else "student")


LINK_COLUMNS = """id, board_id, role, participant_role, created_at, expires_at, revoked_at,
                  max_uses, use_count, password_hash IS NOT NULL AS protected"""
ACTIVE = """revoked_at IS NULL AND (expires_at IS NULL OR expires_at > clock_timestamp())
            AND (max_uses IS NULL OR use_count < max_uses)"""


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def make_share_router(current_user, board_access, board_view) -> APIRouter:
    router = APIRouter(prefix="/api/v1")

    @router.post("/boards/{board_id}/share-links", status_code=201)
    async def create(board_id: UUID, data: CreateLink, request: Request, user=Depends(current_user)):
        if data.expires_at and data.expires_at <= datetime.now(timezone.utc):
            raise HTTPException(422, "Срок действия должен быть в будущем.")
        password = (data.password or "").strip()
        if password and (len(password) < 4 or len(password.encode()) > 72):
            raise HTTPException(422, "Пароль ссылки должен содержать от 4 символов и занимать до 72 байт.")
        token = secrets.token_hex(32)
        async with request.app.state.pool.acquire() as conn, conn.transaction():
            board, role = await board_access(conn, board_id, user["id"], lock=True)
            owner_only(board, role)
            password_hash = None
            if password:
                password_hash = (await asyncio.to_thread(
                    bcrypt.hashpw, password.encode(), bcrypt.gensalt()
                )).decode()
            row = await conn.fetchrow(
                f"""INSERT INTO board_share_links(id, board_id, token_hash, role, participant_role, expires_at, max_uses, password_hash)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING {LINK_COLUMNS}""",
                uuid4(), board_id, token_hash(token), data.role, data.participant, data.expires_at, data.max_uses, password_hash,
            )
        return {**dict(row), "token": token}

    @router.get("/boards/{board_id}/share-links")
    async def list_links(board_id: UUID, request: Request, user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn:
            board, role = await board_access(conn, board_id, user["id"])
            owner_only(board, role)
            rows = await conn.fetch(
                f"""SELECT {LINK_COLUMNS} FROM board_share_links
                     WHERE board_id=$1 AND {ACTIVE} ORDER BY created_at DESC, id""",
                board_id,
            )
        return [dict(row) for row in rows]

    @router.delete("/share-links/{link_id}", status_code=204)
    async def revoke(link_id: UUID, request: Request, user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn, conn.transaction():
            board_id = await conn.fetchval("SELECT board_id FROM board_share_links WHERE id=$1", link_id)
            if board_id is not None:
                board, role = await board_access(conn, board_id, user["id"], lock=True)
                owner_only(board, role)
                await conn.execute(
                    "UPDATE board_share_links SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL",
                    link_id,
                )
        return Response(status_code=204)

    @router.post("/share-links/redeem")
    async def redeem(data: RedeemLink, request: Request, user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn, conn.transaction():
            board, role, participant = await consume_link(conn, data)
            if board["owner_id"] == user["id"]:
                role, participant = "owner", "owner"
            else:
                if participant == "co_teacher" and (user["account_role"] != "teacher" or user["teacher_status"] != "approved"):
                    raise HTTPException(403, "Ссылка сопреподавателя требует подтверждённого аккаунта преподавателя.")
                membership = await conn.fetchrow(
                    """INSERT INTO board_members(board_id, user_id, role, participant_role) VALUES ($1, $2, $3, $4)
                       ON CONFLICT (board_id, user_id) DO UPDATE
                       SET role=CASE WHEN board_members.role='editor' THEN 'editor' ELSE EXCLUDED.role END,
                           participant_role=CASE
                             WHEN board_members.role='editor' AND EXCLUDED.role='viewer' THEN COALESCE(board_members.participant_role,'student')
                             WHEN board_members.participant_role='co_teacher' THEN 'co_teacher'
                             ELSE EXCLUDED.participant_role END
                       RETURNING role,participant_role""",
                    board["id"], user["id"], role, participant,
                )
                role, participant = membership["role"], membership["participant_role"]
        return {**board_view(board, role, participant), "board_id": str(board["id"])}

    @router.post("/auth/guest")
    async def guest(data: GuestLink, request: Request):
        from app import issue_tokens
        name = data.name.strip()
        if len(name) < 2 or any(ord(c) < 32 for c in name):
            raise HTTPException(422, "Укажите имя гостя.")
        now = time.monotonic()
        while _guest_attempts and now - _guest_attempts[0] >= 60:
            _guest_attempts.popleft()
        if len(_guest_attempts) >= 120:
            raise HTTPException(429, "Слишком много попыток входа. Попробуйте через минуту.")
        _guest_attempts.append(now)
        async with request.app.state.pool.acquire() as conn, conn.transaction():
            board, role, participant = await consume_link(conn, data)
            if participant == "co_teacher":
                raise HTTPException(403, "Для ссылки сопреподавателя войдите в подтверждённый аккаунт.")
            user_id = uuid4()
            await conn.execute("""DELETE FROM board_members m USING account_users u
                WHERE m.board_id=$1 AND m.user_id=u.id AND u.guest_board_id=$1 AND u.guest_expires_at<=now()""", board["id"])
            # A guest is not an email account; the placeholder can never sign in.
            user = await conn.fetchrow(
                """INSERT INTO account_users(id,email,password_hash,display_name,guest_board_id,guest_expires_at)
                   VALUES($1,$2,'!guest',$3,$4,now()+interval '24 hours') RETURNING *""",
                user_id, f"{user_id}@guest.invalid", name, board["id"])
            await conn.execute("INSERT INTO board_members(board_id,user_id,role,participant_role) VALUES($1,$2,$3,$4)",
                               board["id"], user_id, role, participant)
            return await issue_tokens(conn, user)

    return router
