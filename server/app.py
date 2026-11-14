"""Lektrus self-hosted core API. Not a Supabase drop-in until migration gates pass.

Run one Uvicorn worker in the pilot: WebSocket listeners are in-process.
PostgreSQL sessions/permissions remain authoritative for every HTTP operation.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import secrets
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

import asyncpg
import bcrypt
import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from realtime_events import EventRateLimit, InvalidLiveEvent, MAX_EVENT_BYTES, validate_live_event
from schema import apply_schema

ISSUER = "lektrus-selfhost"
AUDIENCE = "lektrus"
ACCESS_SECONDS = 900
REFRESH_DAYS = 30
MAX_DOCUMENT_BYTES = 24 * 1024 * 1024
MAX_DOCUMENT_ITEMS = 10_000

def setting(name: str) -> str:
    value = os.getenv(name, "")
    if not value:
        raise RuntimeError(f"Required server setting {name} is missing")
    return value

def jwt_secret() -> str:
    value = setting("LEKTRUS_JWT_SECRET")
    if len(value.encode()) < 32:
        raise RuntimeError("LEKTRUS_JWT_SECRET must contain at least 32 bytes")
    return value

def allowed_origins() -> list[str]:
    return [x.strip().rstrip("/") for x in os.getenv("LEKTRUS_ALLOWED_ORIGINS", "").split(",") if x.strip()]

@asynccontextmanager
async def lifespan(app: FastAPI):
    jwt_secret()
    setting("DATABASE_URL")
    app.state.pool = await asyncpg.create_pool(
        dsn=setting("DATABASE_URL"), min_size=1, max_size=5, command_timeout=20
    )
    try:
        async with app.state.pool.acquire() as conn:
            if os.getenv("LEKTRUS_APPLY_SCHEMA") == "true":
                await apply_schema(conn)
            else:
                await conn.fetchval("SELECT 1")
        yield
    finally:
        await app.state.pool.close()

app = FastAPI(
    title="Lektrus API (migration pilot)",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

def error(status: int, message: str):
    raise HTTPException(status_code=status, detail=message)

def jwt_claims(token: str) -> dict[str, Any]:
    try:
        data = jwt.decode(
            token, jwt_secret(), algorithms=["HS256"], audience=AUDIENCE,
            issuer=ISSUER, options={"require": ["sub", "sid", "exp", "iat"]},
        )
        UUID(data["sub"])
        UUID(data["sid"])
        return data
    except (jwt.PyJWTError, ValueError, KeyError, TypeError):
        error(401, "Сессия недействительна. Войдите снова.")

def account_view(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "user_metadata": {
            "display_name": row["display_name"],
            "first_name": row["first_name"],
            "last_name": row["last_name"],
        },
        "account_role": row["account_role"],
        "teacher_status": row["teacher_status"],
        "is_admin": row["is_admin"],
        "requested_at": row["teacher_requested_at"].isoformat() if row.get("teacher_requested_at") else None,
        "reviewed_at": row["teacher_reviewed_at"].isoformat() if row.get("teacher_reviewed_at") else None,
        "subscription_plan": row["subscription_plan"],
        "subscription_until": row["subscription_until"].isoformat() if row["subscription_until"] else None,
    }

async def lookup_session(pool: asyncpg.Pool, token: str) -> asyncpg.Record:
    claims = jwt_claims(token)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT u.id,u.email,u.password_hash,u.display_name,u.first_name,
                      u.last_name,u.account_role,u.teacher_status,u.is_admin,
                      u.teacher_requested_at,u.teacher_reviewed_at,
                      u.subscription_plan,u.subscription_until
                 FROM account_users u JOIN account_sessions s ON s.user_id=u.id
                WHERE u.id=$1 AND s.id=$2
                  AND s.revoked_at IS NULL AND s.expires_at>now()
                  AND u.email_confirmed_at IS NOT NULL""",
            UUID(claims["sub"]), UUID(claims["sid"]),
        )
    if row is None:
        error(401, "Сессия завершена. Войдите снова.")
    return row

async def current_user(request: Request, authorization: str | None = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        error(401, "Требуется авторизация.")
    return await lookup_session(request.app.state.pool, authorization[7:])

def access_token(user_id: UUID, session_id: UUID) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": str(user_id), "sid": str(session_id), "iss": ISSUER,
         "aud": AUDIENCE, "iat": now, "exp": now + timedelta(seconds=ACCESS_SECONDS)},
        jwt_secret(), algorithm="HS256",
    )

def refresh_sha(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

async def issue_tokens(conn: asyncpg.Connection, user: asyncpg.Record) -> dict[str, Any]:
    session_id = uuid4()
    refresh = secrets.token_urlsafe(48)
    await conn.execute(
        """INSERT INTO account_sessions(id,user_id,refresh_sha256,expires_at)
           VALUES($1,$2,$3,now()+interval '30 days')""",
        session_id, user["id"], refresh_sha(refresh)
    )
    return {
        "access_token": access_token(user["id"], session_id),
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": ACCESS_SECONDS,
        "user": account_view(user),
    }

class LoginInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=200)

class RefreshInput(BaseModel):
    refresh_token: str = Field(min_length=32, max_length=256)

class NewBoardInput(BaseModel):
    title: str = Field(default="Новая доска", min_length=1, max_length=160)
    is_pilot: bool = False

class UpdateBoardInput(BaseModel):
    title: str = Field(min_length=1, max_length=160)

class SaveDocumentInput(BaseModel):
    expected_version: int = Field(ge=0)
    document: dict[str, Any]

_login_attempts: dict[str, deque[float]] = defaultdict(deque)

def login_rate_limit(email: str):
    # Single-process pilot limit; put persistent rate limiting at the reverse
    # proxy before enabling public registration or high-volume access.
    attempts = _login_attempts[email]
    now = time.monotonic()
    while attempts and now - attempts[0] > 600:
        attempts.popleft()
    if len(attempts) >= 8:
        error(429, "Слишком много попыток. Попробуйте позже.")
    attempts.append(now)

@app.get("/api/v1/health")
async def health(request: Request):
    try:
        async with request.app.state.pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
    except Exception:
        error(503, "База данных недоступна.")
    return {"ok": True, "service": "lektrus-selfhost"}

@app.post("/api/v1/auth/login")
async def login(data: LoginInput, request: Request):
    email = data.email.strip().lower()
    login_rate_limit(email)
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            """SELECT id,email,password_hash,display_name,first_name,last_name,
                      account_role,teacher_status,is_admin,teacher_requested_at,
                      teacher_reviewed_at,subscription_plan,subscription_until
                 FROM account_users
                WHERE email=$1 AND email_confirmed_at IS NOT NULL""", email
        )
        valid = bool(user) and await asyncio.to_thread(
            bcrypt.checkpw, data.password.encode(), user["password_hash"].encode()
        )
        if not valid:
            error(401, "Неверный email или пароль.")
        return await issue_tokens(conn, user)

@app.post("/api/v1/auth/refresh")
async def refresh(data: RefreshInput, request: Request):
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.transaction():
            session = await conn.fetchrow(
                """SELECT id,user_id FROM account_sessions
                   WHERE refresh_sha256=$1 AND revoked_at IS NULL
                     AND expires_at>now() FOR UPDATE""",
                refresh_sha(data.refresh_token),
            )
            if session is None:
                error(401, "Сессия истекла или уже обновлена.")
            user = await conn.fetchrow(
                """SELECT id,email,password_hash,display_name,first_name,last_name,
                          account_role,teacher_status,is_admin,teacher_requested_at,
                          teacher_reviewed_at,subscription_plan,subscription_until
                   FROM account_users
                   WHERE id=$1 AND email_confirmed_at IS NOT NULL""",
                session["user_id"],
            )
            if user is None:
                error(401, "Аккаунт недоступен.")
            await conn.execute(
                "UPDATE account_sessions SET revoked_at=now() WHERE id=$1",
                session["id"],
            )
            return await issue_tokens(conn, user)

@app.post("/api/v1/auth/logout")
async def logout(request: Request, authorization: str | None = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        error(401, "Требуется авторизация.")
    claims = jwt_claims(authorization[7:])
    # Idempotent logout for validly signed tokens.
    async with request.app.state.pool.acquire() as conn:
        await conn.execute(
            "UPDATE account_sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2",
            UUID(claims["sid"]), UUID(claims["sub"]),
        )
    return {"ok": True}

@app.get("/api/v1/auth/me")
async def me(user=Depends(current_user)):
    return account_view(user)

async def board_access(conn: asyncpg.Connection, board_id: UUID, user_id: UUID,
                       lock: bool = False):
    # Board row lock serializes the initial save against concurrent clients.
    suffix = " FOR UPDATE" if lock else ""
    board = await conn.fetchrow(
        """SELECT id,owner_id,title,created_at,updated_at,deleted_at,is_pilot
             FROM boards WHERE id=$1""" + suffix, board_id,
    )
    if board is None or board["deleted_at"] is not None:
        error(404, "Доска не найдена.")
    if board["owner_id"] == user_id:
        return board, "owner"
    is_admin = await conn.fetchval(
        "SELECT is_admin FROM account_users WHERE id=$1", user_id
    )
    if is_admin:
        return board, "viewer"
    role = await conn.fetchval(
        "SELECT role FROM board_members WHERE board_id=$1 AND user_id=$2",
        board_id, user_id,
    )
    if role not in ("editor", "viewer"):
        # Do not reveal whether the board ID exists to outsiders.
        error(404, "Доска не найдена.")
    return board, role

def board_view(row, role: str) -> dict[str, Any]:
    return {
        "id": str(row["id"]), "owner_id": str(row["owner_id"]),
        "title": row["title"], "role": role,
        "created_at": row["created_at"].isoformat(),
        "updated_at": row["updated_at"].isoformat(),
        "deleted_at": row["deleted_at"].isoformat() if row["deleted_at"] else None,
    }

@app.get("/api/v1/boards")
async def list_boards(request: Request, user=Depends(current_user)):
    async with request.app.state.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT b.id,b.owner_id,b.title,b.created_at,b.updated_at,b.deleted_at,
                      CASE WHEN b.owner_id=$1 THEN 'owner' ELSE m.role END AS role
                 FROM boards b LEFT JOIN board_members m
                   ON m.board_id=b.id AND m.user_id=$1
                WHERE b.deleted_at IS NULL
                  AND (b.owner_id=$1 OR m.user_id IS NOT NULL)
                ORDER BY b.updated_at DESC LIMIT 500""", user["id"],
        )
    return [board_view(row, row["role"]) for row in rows]

@app.post("/api/v1/boards", status_code=201)
async def create_board(data: NewBoardInput, request: Request,
                       user=Depends(current_user)):
    async with request.app.state.pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO boards(id,owner_id,title,is_pilot) VALUES($1,$2,$3,$4)
               RETURNING id,owner_id,title,created_at,updated_at,deleted_at""",
            uuid4(), user["id"], data.title.strip(), data.is_pilot,
        )
    return board_view(row, "owner")

@app.get("/api/v1/boards/{board_id}")
async def get_board(board_id: UUID, request: Request, user=Depends(current_user)):
    async with request.app.state.pool.acquire() as conn:
        board, role = await board_access(conn, board_id, user["id"])
        return board_view(board, role)


@app.patch("/api/v1/boards/{board_id}")
async def update_board(board_id: UUID, data: UpdateBoardInput,
                       request: Request, user=Depends(current_user)):
    title = data.title.strip()
    if not title:
        error(422, "Укажите название доски.")
    async with request.app.state.pool.acquire() as conn:
        async with conn.transaction():
            _, role = await board_access(conn, board_id, user["id"], lock=True)
            if role != "owner":
                error(403, "Только владелец может переименовать доску.")
            row = await conn.fetchrow(
                """UPDATE boards SET title=$2,updated_at=now()
                    WHERE id=$1
                    RETURNING id,owner_id,title,created_at,updated_at,deleted_at""",
                board_id, title,
            )
    return board_view(row, "owner")


@app.delete("/api/v1/boards/{board_id}")
async def trash_board(board_id: UUID, request: Request,
                      user=Depends(current_user)):
    async with request.app.state.pool.acquire() as conn:
        async with conn.transaction():
            _, role = await board_access(conn, board_id, user["id"], lock=True)
            if role != "owner":
                error(403, "Только владелец может переместить доску в корзину.")
            await conn.execute(
                "UPDATE boards SET deleted_at=now(),updated_at=now() WHERE id=$1",
                board_id,
            )
    return {"ok": True}


def document_view(row, board_id: UUID):
    if row is None:
        return {"board_id": str(board_id), "document": None,
                "version": 0, "updated_at": None, "updated_by": None}
    return {
        "board_id": str(board_id),
        "document": json.loads(row["document"]) if isinstance(row["document"], str) else row["document"],
        "version": row["version"],
        "updated_at": row["updated_at"].isoformat(),
        "updated_by": str(row["updated_by"]),
    }

@app.get("/api/v1/boards/{board_id}/document")
async def get_document(board_id: UUID, request: Request, user=Depends(current_user)):
    async with request.app.state.pool.acquire() as conn:
        await board_access(conn, board_id, user["id"])
        row = await conn.fetchrow(
            "SELECT document,version,updated_at,updated_by FROM board_documents WHERE board_id=$1",
            board_id,
        )
        return document_view(row, board_id)

_subscribers: dict[UUID, dict[WebSocket, str]] = defaultdict(dict)
_subscriber_users: dict[UUID, dict[WebSocket, dict[str, str]]] = defaultdict(dict)
_presence_watchers: dict[UUID, set[WebSocket]] = defaultdict(set)


def _unique_presence(board_id: UUID) -> list[dict[str, str]]:
    users: dict[str, dict[str, str]] = {}
    for meta in _subscriber_users.get(board_id, {}).values():
        user_id = meta.get("user_id", "")
        if user_id and user_id not in users:
            users[user_id] = dict(meta)
    return sorted(users.values(), key=lambda item: (item["role"] != "owner", item["name"].casefold()))


async def announce_presence(board_id: UUID, *, joins: list[dict[str, str]] | None = None,
                            leaves: list[dict[str, str]] | None = None,
                            pool: asyncpg.Pool, exclude: WebSocket | None = None):
    message = {
        "type": "presence_diff",
        "joins": joins or [],
        "leaves": leaves or [],
    }
    for client in list(_presence_watchers.get(board_id, set())):
        if client is exclude:
            continue
        token = _subscribers.get(board_id, {}).get(client)
        if not token:
            continue
        try:
            recipient = await lookup_session(pool, token)
            async with pool.acquire() as conn:
                await board_access(conn, board_id, recipient["id"])
            await asyncio.wait_for(client.send_json(message), timeout=1)
        except HTTPException:
            await _drop_subscriber(board_id, client, pool, notify=False)
            try:
                await client.close(code=4403)
            except Exception:
                pass
        except Exception:
            await _drop_subscriber(board_id, client, pool, notify=False)


async def _drop_subscriber(board_id: UUID, client: WebSocket,
                          pool: asyncpg.Pool, notify: bool = True):
    _subscribers.get(board_id, {}).pop(client, None)
    _presence_watchers.get(board_id, set()).discard(client)
    departed = _subscriber_users.get(board_id, {}).pop(client, None)
    if departed and notify and not any(
        meta.get("user_id") == departed.get("user_id")
        for meta in _subscriber_users.get(board_id, {}).values()
    ):
        await announce_presence(board_id, leaves=[departed], pool=pool)
    if not _subscribers.get(board_id):
        _subscribers.pop(board_id, None)
        _subscriber_users.pop(board_id, None)
        _presence_watchers.pop(board_id, None)


async def announce(board_id: UUID, version: int, pool: asyncpg.Pool):
    # Permission and session membership are checked at SEND TIME. A user who
    # was removed from a board or logged out must not receive future notices.
    for client, token in list(_subscribers.get(board_id, {}).items()):
        try:
            user = await lookup_session(pool, token)
            async with pool.acquire() as conn:
                await board_access(conn, board_id, user["id"])
            await client.send_json({"type": "document_changed", "version": version})
        except HTTPException:
            await _drop_subscriber(board_id, client, pool)
            try:
                await client.close(code=4403)
            except Exception:
                pass
        except Exception:
            await _drop_subscriber(board_id, client, pool)


async def relay_live_event(board_id: UUID, sender: WebSocket,
                           event: dict[str, Any], pool: asyncpg.Pool):
    # Transient events never contain durable document or file bytes. Every
    # recipient's current session and board membership are rechecked.
    for peer, token in list(_subscribers.get(board_id, {}).items()):
        if peer is sender:
            continue
        try:
            recipient = await lookup_session(pool, token)
            async with pool.acquire() as conn:
                await board_access(conn, board_id, recipient["id"])
            await asyncio.wait_for(peer.send_json(event), timeout=1)
        except HTTPException:
            await _drop_subscriber(board_id, peer, pool)
            try:
                await peer.close(code=4403)
            except Exception:
                pass
        except Exception:
            await _drop_subscriber(board_id, peer, pool)


@app.put("/api/v1/boards/{board_id}/document")
async def save_document(board_id: UUID, data: SaveDocumentInput, request: Request,
                        user=Depends(current_user)):
    items = data.document.get("items")
    ink = data.document.get("ink", [])
    if not isinstance(items, list) or not isinstance(ink, list):
        error(422, "Документ должен содержать массивы items и ink.")
    if len(items) + len(ink) > MAX_DOCUMENT_ITEMS:
        error(413, "Слишком много объектов на доске.")
    serialized = json.dumps(data.document, ensure_ascii=False, separators=(",", ":"))
    if len(serialized.encode("utf-8")) > MAX_DOCUMENT_BYTES:
        error(413, "Документ превышает ограничение 24 МБ.")
    async with request.app.state.pool.acquire() as conn:
        async with conn.transaction():
            _, role = await board_access(conn, board_id, user["id"], lock=True)
            if role not in ("owner", "editor") and not user["is_admin"]:
                error(403, "Недостаточно прав для изменения доски.")
            previous = await conn.fetchrow(
                "SELECT version FROM board_documents WHERE board_id=$1", board_id,
            )
            current_version = previous["version"] if previous else 0
            if current_version != data.expected_version:
                error(409, f"Версия доски изменилась: {current_version}.")
            if previous:
                row = await conn.fetchrow(
                    """UPDATE board_documents
                          SET document=$2::jsonb,version=version+1,
                              updated_by=$3,updated_at=now()
                        WHERE board_id=$1
                        RETURNING document,version,updated_at,updated_by""",
                    board_id, serialized, user["id"],
                )
            else:
                row = await conn.fetchrow(
                    """INSERT INTO board_documents(board_id,document,version,updated_by)
                       VALUES($1,$2::jsonb,1,$3)
                       RETURNING document,version,updated_at,updated_by""",
                    board_id, serialized, user["id"],
                )
            await conn.execute(
                "UPDATE boards SET updated_at=now() WHERE id=$1", board_id,
            )
    await announce(board_id, row["version"], request.app.state.pool)
    return document_view(row, board_id)

@app.websocket("/api/v1/boards/{board_id}/events")
async def board_events(websocket: WebSocket, board_id: UUID):
    origin = websocket.headers.get("origin")
    if not origin or origin.rstrip("/") not in allowed_origins():
        await websocket.close(code=4403)
        return
    await websocket.accept()
    try:
        initial = await asyncio.wait_for(websocket.receive_json(), timeout=5)
        if not isinstance(initial, dict) or initial.get("type") != "auth":
            await websocket.close(code=4401)
            return
        token = initial.get("token", "")
        presence_enabled = initial.get("presence", False)
        presence_visible = initial.get("visible", True)
        if type(presence_enabled) is not bool or type(presence_visible) is not bool:
            await websocket.close(code=4401)
            return
        claims = jwt_claims(token)
        user = await lookup_session(websocket.app.state.pool, token)
        async with websocket.app.state.pool.acquire() as conn:
            _, current_role = await board_access(conn, board_id, user["id"])
            current_version = await conn.fetchval(
                "SELECT version FROM board_documents WHERE board_id=$1", board_id
            ) or 0
        if len(_subscribers[board_id]) >= 100:
            await websocket.close(code=4429)
            return
        user_meta = {
            "user_id": str(user["id"]),
            "name": str(user["display_name"] or "Участник")[:100],
            "role": current_role,
            "online_at": str(int(time.time() * 1000)),
        }
        already_present = any(
            meta.get("user_id") == user_meta["user_id"]
            for meta in _subscriber_users.get(board_id, {}).values()
        )
        _subscribers[board_id][websocket] = token
        if presence_enabled:
            _presence_watchers[board_id].add(websocket)
            if presence_visible:
                _subscriber_users[board_id][websocket] = user_meta
        await websocket.send_json({"type": "ready", "version": current_version})
        if presence_enabled:
            await websocket.send_json({"type": "presence_state", "users": _unique_presence(board_id)})
            if presence_visible and not already_present:
                await announce_presence(board_id, joins=[user_meta],
                                        pool=websocket.app.state.pool, exclude=websocket)
        limiter = EventRateLimit()
        while True:
            remaining = float(claims["exp"]) - time.time()
            if remaining <= 0:
                await websocket.close(code=4401)
                return
            try:
                raw = await asyncio.wait_for(
                    websocket.receive_text(), timeout=min(30, remaining)
                )
                if len(raw.encode("utf-8")) > MAX_EVENT_BYTES:
                    await websocket.close(code=1009)
                    return
                try:
                    message = json.loads(raw)
                except (ValueError, TypeError):
                    await websocket.send_json({"type": "event_error", "reason": "invalid_json"})
                    continue
                if not isinstance(message, dict):
                    await websocket.send_json({"type": "event_error", "reason": "invalid_frame"})
                    continue
                refreshed_user = await lookup_session(websocket.app.state.pool, token)
                async with websocket.app.state.pool.acquire() as conn:
                    current_board, current_role = await board_access(
                        conn, board_id, refreshed_user["id"]
                    )
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue
                try:
                    event = validate_live_event(
                        message, role=current_role,
                        user_id=str(refreshed_user["id"]),
                        name=str(refreshed_user["display_name"] or "Участник"),
                    )
                except InvalidLiveEvent as exc:
                    await websocket.send_json({
                        "type": "event_error", "reason": str(exc)
                    })
                    continue
                if not limiter.check(event["type"]):
                    await websocket.send_json({
                        "type": "event_error", "reason": "rate_limited"
                    })
                    if limiter.violations >= 30:
                        await websocket.close(code=4429)
                        return
                    continue
                if event["type"] in ("focus_view", "attachment_result"):
                    target_id = event.get("target_user_id")
                    try:
                        target_uuid = UUID(str(target_id))
                        async with websocket.app.state.pool.acquire() as conn:
                            await board_access(conn, board_id, target_uuid)
                    except (ValueError, HTTPException):
                        await websocket.send_json({
                            "type": "event_error", "reason": "invalid_target"
                        })
                        continue
                    if target_uuid == refreshed_user["id"]:
                        await websocket.send_json({
                            "type": "event_error", "reason": "invalid_target"
                        })
                        continue
                if event["type"] == "object_preview":
                    if not current_board["is_pilot"]:
                        await websocket.send_json({
                            "type": "event_error", "reason": "pilot_only"
                        })
                        continue
                    # A client may only preview an existing pilot object at
                    # its current committed revision, never a fabricated ID.
                    async with websocket.app.state.pool.acquire() as conn:
                        exists = await conn.fetchval(
                            """SELECT EXISTS(
                                SELECT 1 FROM board_documents d
                                CROSS JOIN LATERAL jsonb_array_elements(
                                  d.document->'items'
                                ) AS obj
                                WHERE d.board_id=$1
                                AND obj->>'id'=$2
                                AND obj->>'kind'='pilot_rect'
                                AND obj->>'revision'=$3
                            )""",
                            board_id, event["object_id"],
                            str(event["object_revision"]),
                        )
                    if not exists:
                        await websocket.send_json({
                            "type": "event_error", "reason": "stale_object"
                        })
                        continue
                await relay_live_event(
                    board_id, websocket, event, websocket.app.state.pool
                )
                if event["type"] == "live_ink":
                    # An ack confirms delivery to the server's relay, not that
                    # the stroke is saved in the durable board document.
                    await websocket.send_json({
                        "type": "ink_ack", "client_id": event["client_id"],
                        "stroke_id": event["stroke_id"],
                        "offset": event["offset"], "finished": event["finished"],
                    })
            except asyncio.TimeoutError:
                # Avoid stale sockets after logout/revocation, even without pings.
                refreshed_user = await lookup_session(websocket.app.state.pool, token)
                async with websocket.app.state.pool.acquire() as conn:
                    await board_access(conn, board_id, refreshed_user["id"])
    except (WebSocketDisconnect, HTTPException, ValueError, TypeError, asyncio.TimeoutError):
        try:
            await websocket.close(code=4401)
        except Exception:
            pass
    finally:
        clients = _subscribers.get(board_id)
        users = _subscriber_users.get(board_id)
        departed = users.pop(websocket, None) if users is not None else None
        watchers = _presence_watchers.get(board_id)
        if watchers is not None:
            watchers.discard(websocket)
            if not watchers:
                _presence_watchers.pop(board_id, None)
        if clients is not None:
            clients.pop(websocket, None)
            if not clients:
                _subscribers.pop(board_id, None)
        if users is not None and not users:
            _subscriber_users.pop(board_id, None)
        if departed and not any(
            meta.get("user_id") == departed.get("user_id")
            for meta in _subscriber_users.get(board_id, {}).values()
        ):
            await announce_presence(board_id, leaves=[departed],
                                    pool=websocket.app.state.pool)
        if not _subscribers.get(board_id):
            _subscriber_users.pop(board_id, None)
            _presence_watchers.pop(board_id, None)

# Asset endpoints reuse the same server-authoritative session and board access
# checks; nothing under the private upload directory is served by Caddy.
from assets import make_asset_router
app.include_router(make_asset_router(current_user, board_access))
from invitations import make_invitation_router
app.include_router(make_invitation_router(current_user, board_access))
from registration import make_registration_router
app.include_router(make_registration_router())
from pilot_operations import make_pilot_operations_router
app.include_router(make_pilot_operations_router(current_user, board_access, announce))
from pilot_objects import make_pilot_objects_router
app.include_router(make_pilot_objects_router(current_user, board_access, announce))

from education import make_education_router
app.include_router(make_education_router(current_user, board_access))
from admin import make_admin_router
app.include_router(make_admin_router(current_user))
from comments import make_comments_router
app.include_router(make_comments_router(current_user, board_access))
from materials import make_material_router
app.include_router(make_material_router(current_user))
from notifications import make_router as make_notifications_router
app.include_router(make_notifications_router(current_user))
from organization import make_router as make_organization_router
app.include_router(make_organization_router(current_user,board_access))
from direct_chats import make_router as make_direct_chats_router
app.include_router(make_direct_chats_router(current_user))

from share_links import make_share_router

app.include_router(make_share_router(current_user, board_access, board_view))

from profiles import make_profile_router

app.include_router(make_profile_router(current_user))
