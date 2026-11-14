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

ISSUER = "lektrus-selfhost"
AUDIENCE = "lektrus"
ACCESS_SECONDS = 900
REFRESH_DAYS = 30
MAX_DOCUMENT_BYTES = 2_000_000
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
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
    }

async def lookup_session(pool: asyncpg.Pool, token: str) -> asyncpg.Record:
    claims = jwt_claims(token)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT u.id,u.email,u.password_hash,u.display_name,u.first_name,
                      u.last_name,u.account_role,u.teacher_status,u.is_admin
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
                      account_role,teacher_status,is_admin
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
                          account_role,teacher_status,is_admin
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
        """SELECT id,owner_id,title,created_at,updated_at,deleted_at
             FROM boards WHERE id=$1""" + suffix, board_id,
    )
    if board is None or board["deleted_at"] is not None:
        error(404, "Доска не найдена.")
    if board["owner_id"] == user_id:
        return board, "owner"
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
            """INSERT INTO boards(id,owner_id,title) VALUES($1,$2,$3)
               RETURNING id,owner_id,title,created_at,updated_at,deleted_at""",
            uuid4(), user["id"], data.title.strip(),
        )
    return board_view(row, "owner")

@app.get("/api/v1/boards/{board_id}")
async def get_board(board_id: UUID, request: Request, user=Depends(current_user)):
    async with request.app.state.pool.acquire() as conn:
        board, role = await board_access(conn, board_id, user["id"])
        return board_view(board, role)

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

_subscribers: dict[UUID, set[WebSocket]] = defaultdict(set)

async def announce(board_id: UUID, version: int):
    # No document payloads on WS: small revision notices minimize egress.
    for client in list(_subscribers.get(board_id, ())):
        try:
            await client.send_json({"type": "document_changed", "version": version})
        except Exception:
            _subscribers[board_id].discard(client)

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
        error(413, "Документ превышает ограничение 2 МБ.")
    async with request.app.state.pool.acquire() as conn:
        async with conn.transaction():
            _, role = await board_access(conn, board_id, user["id"], lock=True)
            if role not in ("owner", "editor"):
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
    await announce(board_id, row["version"])
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
        claims = jwt_claims(token)
        user = await lookup_session(websocket.app.state.pool, token)
        async with websocket.app.state.pool.acquire() as conn:
            await board_access(conn, board_id, user["id"])
            current_version = await conn.fetchval(
                "SELECT version FROM board_documents WHERE board_id=$1", board_id
            ) or 0
        _subscribers[board_id].add(websocket)
        await websocket.send_json({"type": "ready", "version": current_version})
        while True:
            remaining = float(claims["exp"]) - time.time()
            if remaining <= 0:
                await websocket.close(code=4401)
                return
            try:
                message = await asyncio.wait_for(
                    websocket.receive_json(), timeout=min(30, remaining)
                )
                if isinstance(message, dict) and message.get("type") == "ping":
                    # Re-check the session so revoked permissions take effect.
                    await lookup_session(websocket.app.state.pool, token)
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                # Avoid stale sockets after logout/revocation, even without pings.
                await lookup_session(websocket.app.state.pool, token)
    except (WebSocketDisconnect, HTTPException, ValueError, TypeError, asyncio.TimeoutError):
        try:
            await websocket.close(code=4401)
        except Exception:
            pass
    finally:
        _subscribers[board_id].discard(websocket)
        if not _subscribers[board_id]:
            _subscribers.pop(board_id, None)

# Asset endpoints reuse the same server-authoritative session and board access
# checks; nothing under the private upload directory is served by Caddy.
from assets import make_asset_router
app.include_router(make_asset_router(current_user, board_access))
from invitations import make_invitation_router
app.include_router(make_invitation_router(current_user, board_access))
