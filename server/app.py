"""Lektrus self-hosted core API. Not a Supabase drop-in until migration gates pass.

Run one Uvicorn worker in the pilot: WebSocket listeners are in-process.
PostgreSQL sessions/permissions remain authoritative for every HTTP operation.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
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
from document_delta import (
    DeltaHistory, MAX_DELTA_BYTES, apply_delta, item_map, encode as encode_delta,
    encoded_bytes, document_bytes_from_parts,
)
from schema import apply_schema
from billing import MESSAGES, limit_detail, make_billing_router
from finance import make_finance_router
from fastapi.responses import JSONResponse
from board_history import ensure_baseline, record_revision, make_history_router
from board_visits import make_visit_router
from feedback_mail import run_feedback_mail
from telegram_editor import telegram_enabled, run_telegram_editor, make_telegram_router
from android_updates import router as android_updates_router, run_android_release_mirror

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
    # Capacitor bundles are served from exact local origins. The API and
    # WebSocket handlers still require valid bearer/session credentials.
    configured = (x.strip().rstrip("/") for setting_name in (
        "LEKTRUS_ALLOWED_ORIGINS", "LEKTRUS_DEPLOYMENT_ORIGINS"
    ) for x in os.getenv(setting_name, "").split(",") if x.strip())
    return list(dict.fromkeys([*configured, "https://localhost", "capacitor://localhost"]))

@asynccontextmanager
async def lifespan(app: FastAPI):
    jwt_secret()
    setting("DATABASE_URL")
    app.state.pool = await asyncpg.create_pool(
        dsn=setting("DATABASE_URL"), min_size=1, max_size=5, command_timeout=20
    )
    app.state.document_deltas = DeltaHistory()
    app.state.feedback_mail_wakeup = asyncio.Event()
    mail_task = None
    telegram_task = None
    android_mirror_task = None
    try:
        async with app.state.pool.acquire() as conn:
            if os.getenv("LEKTRUS_APPLY_SCHEMA") == "true":
                await apply_schema(conn)
            else:
                await conn.fetchval("SELECT 1")
        if os.getenv("LEKTRUS_SMTP_HOST", "").strip():
            mail_task = asyncio.create_task(run_feedback_mail(app.state.pool, app.state.feedback_mail_wakeup))
        if telegram_enabled():
            telegram_task = asyncio.create_task(run_telegram_editor(app.state.pool))
        # Only the dedicated persistent release cache is proactively populated.
        # Ordinary local/test API instances do not poll the public release host.
        if os.getenv("LEKTRUS_ANDROID_RELEASE_DIR", "").strip():
            android_mirror_task = asyncio.create_task(run_android_release_mirror())
        yield
    finally:
        if android_mirror_task:
            android_mirror_task.cancel()
            await asyncio.gather(android_mirror_task, return_exceptions=True)
        if telegram_task:
            telegram_task.cancel()
            await asyncio.gather(telegram_task, return_exceptions=True)
        if mail_task:
            mail_task.cancel()
            await asyncio.gather(mail_task, return_exceptions=True)
        await app.state.pool.close()

app = FastAPI(
    title="Lektrus API (migration pilot)",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan
)
app.include_router(android_updates_router)

@app.exception_handler(asyncpg.PostgresError)
async def handle_database_error(request: Request, exc: asyncpg.PostgresError):
    resource = exc.message.removeprefix('LEKTRUS_PLAN:')
    if exc.sqlstate == 'PT409' and resource in MESSAGES:
        return JSONResponse(status_code=409, content={'detail': limit_detail(resource)})
    raise exc




class SlowRequestLogger:
    """Measure completed HTTP requests using route patterns, never request URLs.

    ASGI wrapping does not read request bodies, alter responses, or wrap the
    long-lived WebSocket connections. Non-HTTP traffic is passed through.
    """

    def __init__(self, app, threshold_ms: int = 1000):
        self.app = app
        self.threshold_ms = threshold_ms

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started = time.perf_counter()
        status = 500

        async def capture_status(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = int(message["status"])
            await send(message)

        try:
            await self.app(scope, receive, capture_status)
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000)
            if duration_ms >= self.threshold_ms:
                # FastAPI/Starlette populate "route" with the template; never
                # log scope["path"], query strings, headers or response bodies.
                route = scope.get("route")
                pattern = getattr(route, "path", "unmatched")
                logging.getLogger("lektrus.slow_http").warning(
                    "Slow HTTP %s %s status=%d duration_ms=%d",
                    scope.get("method", "?"), pattern, status, duration_ms
                )


app.add_middleware(SlowRequestLogger)

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
    guest_board = row.get("guest_board_id")
    return {
        "id": str(row["id"]),
        "email": "" if guest_board else row["email"],
        "guest_board_id": str(guest_board) if guest_board else None,
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
        "subscription_plan": "pro" if row["subscription_plan"] == "pro" and row["subscription_until"] and row["subscription_until"] > datetime.now(timezone.utc) else "free",
        "subscription_until": row["subscription_until"].isoformat() if row["subscription_until"] else None,
    }

async def lookup_session(pool: asyncpg.Pool, token: str) -> asyncpg.Record:
    claims = jwt_claims(token)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT u.id,u.email,u.password_hash,u.display_name,u.first_name,
                      u.last_name,u.account_role,u.teacher_status,u.is_admin,
                      u.teacher_requested_at,u.teacher_reviewed_at,
                      u.subscription_plan,u.subscription_until,u.guest_board_id,u.guest_expires_at
                 FROM account_users u JOIN account_sessions s ON s.user_id=u.id
                WHERE u.id=$1 AND s.id=$2
                  AND s.revoked_at IS NULL AND s.expires_at>now()
                  AND (u.email_confirmed_at IS NOT NULL OR u.guest_expires_at>now())
                  AND (u.guest_board_id IS NULL OR u.guest_expires_at>now())""",
            UUID(claims["sub"]), UUID(claims["sid"]),
        )
    if row is None:
        error(401, "Сессия завершена. Войдите снова.")
    return row

async def current_user(request: Request, authorization: str | None = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        error(401, "Требуется авторизация.")
    user = await lookup_session(request.app.state.pool, authorization[7:])
    if user["guest_board_id"] is not None:
        # Default deny: guest tokens cannot reach account, education, other
        # board, share-link, admin or private-chat endpoints.
        path = request.scope["route"].path
        board_paths = {
            "/api/v1/boards/{board_id}", "/api/v1/boards/{board_id}/document",
            "/api/v1/boards/{board_id}/assets", "/api/v1/boards/{board_id}/assets/{asset_id}",
            "/api/v1/boards/{board_id}/comments", "/api/v1/boards/{board_id}/comment-participants",
            "/api/v1/boards/{board_id}/visits",
        }
        if path in board_paths:
            if str(request.path_params.get("board_id")) != str(user["guest_board_id"]):
                error(404, "Доска не найдена.")
        elif path not in {"/api/v1/auth/me", "/api/v1/comments/{comment_id}"}:
            error(403, "Гостевой доступ ограничен приглашённой доской.")
    return user

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
           VALUES($1,$2,$3,LEAST(now()+interval '30 days',COALESCE($4::timestamptz,now()+interval '30 days')))""",
        session_id, user["id"], refresh_sha(refresh), user.get("guest_expires_at")
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

class PatchDocumentInput(BaseModel):
    expected_version: int = Field(ge=1)
    delta: dict[str, Any]

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
                WHERE email=$1 AND email_confirmed_at IS NOT NULL AND guest_board_id IS NULL""", email
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
                          teacher_reviewed_at,subscription_plan,subscription_until,guest_board_id,guest_expires_at
                   FROM account_users
                   WHERE id=$1 AND (email_confirmed_at IS NOT NULL OR guest_expires_at>now())
                   AND (guest_board_id IS NULL OR guest_expires_at>now())""",
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
        await conn.execute("""UPDATE board_visits SET left_at=LEAST(now(),last_seen+interval '120 seconds')
            WHERE user_id=$1 AND left_at IS NULL AND EXISTS
            (SELECT 1 FROM account_users WHERE id=$1 AND guest_board_id IS NOT NULL)""", UUID(claims["sub"]))
    return {"ok": True}

@app.get("/api/v1/auth/me")
async def me(user=Depends(current_user)):
    return account_view(user)

from maintenance import install_maintenance
install_maintenance(app, lookup_session, current_user)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-File-Name", "X-Material-Title", "X-Material-Folder"],
)


def billing_seat_available(board_id: UUID, owner: UUID, actor: UUID) -> bool:
    if actor == owner:
        return True
    peers = []
    for peer_token in _subscribers.get(board_id, {}).values():
        try:
            peer = jwt_claims(peer_token)["sub"]
        except HTTPException:
            continue
        if peer != str(owner) and peer not in peers:
            peers.append(peer)
    return str(actor) in peers[:5] if len(peers)>=5 else True


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
    account = await conn.fetchrow(
        "SELECT is_admin,guest_board_id,guest_expires_at>now() AS guest_active FROM account_users WHERE id=$1", user_id
    )
    if account and account["guest_board_id"] is not None and (
        account["guest_board_id"] != board_id or not account["guest_active"]):
        error(404, "Доска не найдена.")
    if account and account["is_admin"]:
        return board, "viewer"
    role = await conn.fetchval(
        "SELECT role FROM board_members WHERE board_id=$1 AND user_id=$2",
        board_id, user_id,
    )
    if role not in ("editor", "viewer"):
        # Do not reveal whether the board ID exists to outsiders.
        error(404, "Доска не найдена.")
    if lock and not billing_seat_available(board_id, board["owner_id"], user_id) and not await conn.fetchval("SELECT billing_unlimited($1)",board["owner_id"]):
        raise HTTPException(409, limit_detail("participants"))
    return board, role

async def board_participant(conn, board_id, user, role):
    if role == "owner":
        return "owner"
    if role == "viewer":
        return "observer"
    participant = await conn.fetchval(
        "SELECT participant_role FROM board_members WHERE board_id=$1 AND user_id=$2", board_id, user["id"]
    )
    if participant == "co_teacher" and (user["account_role"] != "teacher" or user["teacher_status"] != "approved"):
        return "student"
    return participant


def board_view(row, role: str, participant: str | None = None, plan_read_only: bool = False) -> dict[str, Any]:
    return {
        "id": str(row["id"]), "owner_id": str(row["owner_id"]),
        "title": row["title"], "role": role, "plan_read_only": bool(row.get("plan_read_only", plan_read_only)),
        "participant_role": participant or ("owner" if role == "owner" else "observer" if role == "viewer" else "student"),
        "created_at": row["created_at"].isoformat(),
        "updated_at": row["updated_at"].isoformat(),
        "deleted_at": row["deleted_at"].isoformat() if row["deleted_at"] else None,
    }

@app.get("/api/v1/boards")
async def list_boards(request: Request, user=Depends(current_user)):
    async with request.app.state.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT b.id,b.owner_id,b.title,b.created_at,b.updated_at,b.deleted_at,
                      billing_readonly(b.id) AND NOT $3::boolean AS plan_read_only,
                      CASE WHEN b.owner_id=$1 THEN 'owner' ELSE m.role END AS role,
                      CASE WHEN b.owner_id=$1 THEN 'owner'
                           WHEN m.role='viewer' THEN 'observer'
                           WHEN m.participant_role='co_teacher' AND $2::boolean THEN 'co_teacher'
                           ELSE 'student' END AS participant_role
                 FROM boards b LEFT JOIN board_members m
                   ON m.board_id=b.id AND m.user_id=$1
                WHERE b.deleted_at IS NULL
                  AND (b.owner_id=$1 OR m.user_id IS NOT NULL)
                ORDER BY b.updated_at DESC LIMIT 500""", user["id"],
            user["account_role"] == "teacher" and user["teacher_status"] == "approved", user["is_admin"],
        )
    return [board_view(row, row["role"], row["participant_role"]) for row in rows]

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

@app.get("/api/v1/boards/trash")
async def list_trashed_boards(request: Request, user=Depends(current_user)):
    async with request.app.state.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id,owner_id,title,created_at,updated_at,deleted_at
                 FROM boards WHERE owner_id=$1 AND deleted_at IS NOT NULL
                ORDER BY deleted_at DESC LIMIT 500""", user["id"],
        )
    return [board_view(row, "owner") for row in rows]

@app.post("/api/v1/boards/{board_id}/restore")
async def restore_trashed_board(board_id: UUID, request: Request, user=Depends(current_user)):
    async with request.app.state.pool.acquire() as conn:
        row = await conn.fetchrow(
            """UPDATE boards SET deleted_at=NULL,updated_at=now()
                WHERE id=$1 AND owner_id=$2 AND deleted_at IS NOT NULL
                RETURNING id,owner_id,title,created_at,updated_at,deleted_at""",
            board_id, user["id"],
        )
        if row is None:
            error(404, "Доска в корзине не найдена.")
    return board_view(row, "owner")

class PermanentBoardDeleteInput(BaseModel):
    confirmation: str = Field(min_length=1, max_length=160)

@app.post("/api/v1/boards/{board_id}/permanent-delete")
async def permanently_delete_board(board_id: UUID, data: PermanentBoardDeleteInput,
                                   request: Request, user=Depends(current_user)):
    from assets import assets_root, file_path
    async with request.app.state.pool.acquire() as conn:
        async with conn.transaction():
            board = await conn.fetchrow(
                "SELECT title FROM boards WHERE id=$1 AND owner_id=$2 AND deleted_at IS NOT NULL FOR UPDATE",
                board_id, user["id"],
            )
            if board is None:
                error(404, "Доска в корзине не найдена.")
            if data.confirmation != board["title"]:
                error(400, "Название доски не совпадает.")
            files = await conn.fetch("SELECT storage_name FROM board_assets WHERE board_id=$1", board_id)
            await conn.execute("DELETE FROM boards WHERE id=$1", board_id)
    # Remove only server-generated paths after the SQL transaction commits.
    # Personal templates own independent snapshots and are not affected.
    deleted, pending = 0, 0
    for row in files:
        try:
            await asyncio.to_thread(file_path(assets_root(), board_id, row["storage_name"]).unlink, missing_ok=True)
            deleted += 1
        except (OSError, RuntimeError):
            pending += 1
            logging.getLogger("lektrus.assets").warning("Private board asset cleanup pending for %s", board_id)
    return {"deleted_assets": deleted, "files_pending": pending}

@app.get("/api/v1/boards/{board_id}")
async def get_board(board_id: UUID, request: Request, user=Depends(current_user)):
    async with request.app.state.pool.acquire() as conn:
        board, role = await board_access(conn, board_id, user["id"])
        participant = await board_participant(conn, board_id, user, role)
        return board_view(board, role, participant, not user["is_admin"] and await conn.fetchval("SELECT billing_readonly($1)", board_id))


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
        "updated_by": str(row["updated_by"]) if row["updated_by"] is not None else None,
    }

@app.get("/api/v1/boards/{board_id}/document")
async def get_document(board_id: UUID, request: Request, version_only: bool = False,
                       since_version: int | None = None,
                       user=Depends(current_user)):
    async with request.app.state.pool.acquire() as conn:
        await board_access(conn, board_id, user["id"])
        if version_only:
            return {"version": await conn.fetchval(
                "SELECT version FROM board_documents WHERE board_id=$1", board_id
            ) or 0}
        if since_version is not None and since_version >= 1:
            revision = await conn.fetchrow(
                "SELECT version,updated_at,updated_by FROM board_documents WHERE board_id=$1", board_id,
            )
            if revision:
                patches = request.app.state.document_deltas.chain(board_id, since_version, revision["version"])
                if patches is not None:
                    return {"board_id": str(board_id), "document": None,
                            "version": revision["version"], "base_version": since_version,
                            "updated_at": revision["updated_at"].isoformat(),
                            "updated_by": str(revision["updated_by"]) if revision["updated_by"] is not None else None,
                            "patches": patches}
        row = await conn.fetchrow(
            "SELECT lektrus_board_document(d) AS document,version,updated_at,updated_by FROM board_documents d WHERE board_id=$1",
            board_id,
        )
        return document_view(row, board_id)

_subscribers: dict[UUID, dict[WebSocket, str]] = defaultdict(dict)
_subscriber_users: dict[UUID, dict[WebSocket, dict[str, str]]] = defaultdict(dict)
_presence_watchers: dict[UUID, set[WebSocket]] = defaultdict(set)
_compact_ink_subscribers: set[WebSocket] = set()


async def lookup_board_sessions(pool: asyncpg.Pool, board_id: UUID, tokens,
                                include_version: bool = False) -> dict[str, asyncpg.Record]:
    """Fresh authorization for a whole fan-out, using one database round trip.

    No TTL/permission cache: session revocation, board deletion, admin changes
    and membership updates are still checked on every event.
    """
    identities = {}
    for token in set(tokens):
        try:
            claims = jwt_claims(token)
            identities[token] = (UUID(claims["sub"]), UUID(claims["sid"]))
        except HTTPException:
            continue
    if not identities:
        return {}
    pairs = list(set(identities.values()))
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT u.id, s.id AS session_id, u.display_name,
                      b.is_pilot, b.owner_id, billing_unlimited(b.owner_id) AS unlimited, COALESCE(d.version, 0) AS version,
                      CASE WHEN b.id IS NULL THEN NULL
                           WHEN billing_readonly(b.id) AND NOT u.is_admin AND (b.owner_id=u.id OR m.user_id IS NOT NULL) THEN 'viewer'
                           WHEN b.owner_id = u.id THEN 'owner'
                           WHEN u.is_admin THEN 'viewer'
                           ELSE m.role END AS role,
                      CASE WHEN billing_readonly(b.id) AND NOT u.is_admin THEN 'observer'
                           WHEN b.owner_id=u.id THEN 'owner'
                           WHEN u.is_admin OR m.role='viewer' THEN 'observer'
                           WHEN m.participant_role='co_teacher' AND u.account_role='teacher' AND u.teacher_status='approved' THEN 'co_teacher'
                           WHEN m.participant_role IS NOT NULL THEN 'student'
                           ELSE NULL END AS participant_role
                 FROM unnest($2::uuid[], $3::uuid[]) AS requested(user_id, session_id)
                 JOIN account_users u ON u.id = requested.user_id
                 JOIN account_sessions s ON s.id = requested.session_id AND s.user_id = u.id
                 LEFT JOIN boards b ON b.id = $1 AND b.deleted_at IS NULL
                 LEFT JOIN board_members m ON m.board_id = b.id AND m.user_id = u.id
                 LEFT JOIN board_documents d ON $4::boolean AND d.board_id = b.id
                WHERE s.revoked_at IS NULL AND s.expires_at > now()
                  AND (u.email_confirmed_at IS NOT NULL OR u.guest_expires_at>now())
                  AND (u.guest_board_id IS NULL OR (u.guest_board_id=$1 AND u.guest_expires_at>now()))
                  AND NOT EXISTS (
                    SELECT 1 FROM service_maintenance sm
                    WHERE sm.starts_at<=now() AND (sm.ends_at IS NULL OR sm.ends_at>now())
                      AND NOT (u.guest_board_id IS NULL AND (u.is_admin OR u.id=ANY(sm.allowed_accounts)))
                  )""",
            board_id, [pair[0] for pair in pairs], [pair[1] for pair in pairs], include_version,
        )
    by_identity = {(row["id"], row["session_id"]): row for row in rows}
    return {token: by_identity[pair] for token, pair in identities.items() if pair in by_identity}


async def lookup_board_session(pool: asyncpg.Pool, board_id: UUID, token: str,
                               include_version: bool = False) -> asyncpg.Record:
    return require_board_session(await lookup_board_sessions(pool, board_id, [token], include_version), token)


def require_board_session(rows: dict[str, asyncpg.Record], token: str) -> asyncpg.Record:
    row = rows.get(token)
    if row is None:
        error(401, "Сессия завершена. Войдите снова.")
    if row["role"] not in ("owner", "editor", "viewer"):
        error(404, "Доска не найдена.")
    return row


async def broadcast_checked(board_id: UUID, event: dict[str, Any], pool: asyncpg.Pool,
                            peers: dict[WebSocket, str], *, notify: bool = True,
                            authorized: dict[str, asyncpg.Record] | None = None):
    if not peers:
        return
    try:
        if authorized is None:
            authorized = await lookup_board_sessions(pool, board_id, peers.values())
    except Exception:
        # Fail closed if the database is temporarily unavailable. Durable saves
        # have already committed; reconnect/version polling recovers the notice.
        logging.getLogger("lektrus.realtime").warning("Board fan-out authorization unavailable")
        return
    target = event.get("target_user_id") if event["type"] in ("focus_view", "attachment_result") else None
    # Modern ink-only classrooms need only the compact representation. Use a
    # fixed encoding choice for each socket throughout this fan-out.
    compact_peers = ({peer for peer in peers if peer in _compact_ink_subscribers}
                     if event["type"] in ("live_ink", "live_erase") else set())
    payload = (json.dumps(event, ensure_ascii=False, separators=(",", ":"))
               if len(compact_peers) != len(peers) else "")
    compact_payload = (json.dumps({**event, "points": [[p["x"], p["y"]] for p in event["points"]]},
                                  ensure_ascii=False, separators=(",", ":"))
                       if compact_peers else payload)

    async def send(client, token):
        row = authorized.get(token)
        if row is None or row["role"] not in ("owner", "editor", "viewer"):
            return client, 4403
        if target is not None and str(row["id"]) != target:
            return None
        if _subscribers.get(board_id, {}).get(client) != token:
            return None
        try:
            await asyncio.wait_for(client.send_text(compact_payload if client in compact_peers else payload), timeout=1)
            return None
        except Exception:
            return client, 1011

    # Serialize once and deliver concurrently. One stalled browser can no longer
    # delay all of the other participants in the loop.
    results = await asyncio.gather(*(send(client, token) for client, token in peers.items()))
    failed = [(client, code) for result in results if result is not None
              for client, code in (result,)
              if _subscribers.get(board_id, {}).get(client) == peers[client]]
    if not failed:
        return
    # Remove all failed peers before awaiting anything. A classroom reconnect
    # must not do one presence fan-out and one 1s close timeout per old socket.
    leaves = _detach_subscribers(board_id, [client for client, _ in failed])

    async def close_failed(client, code):
        try:
            await asyncio.wait_for(client.close(code=code), timeout=1)
        except Exception:
            pass

    closing = [close_failed(client, code) for client, code in failed]
    if notify and leaves:
        closing.append(announce_presence(board_id, leaves=leaves, pool=pool))
    await asyncio.gather(*closing)


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
    watchers = _presence_watchers.get(board_id, set())
    await broadcast_checked(board_id, message, pool, {
        client: token for client, token in _subscribers.get(board_id, {}).items()
        if client is not exclude and client in watchers
    }, notify=False)


def _detach_subscribers(board_id: UUID, clients) -> list[dict[str, str]]:
    departed = {}
    for client in clients:
        _subscribers.get(board_id, {}).pop(client, None)
        _compact_ink_subscribers.discard(client)
        _presence_watchers.get(board_id, set()).discard(client)
        meta = _subscriber_users.get(board_id, {}).pop(client, None)
        if meta:
            departed[meta["user_id"]] = meta
    remaining = {meta["user_id"] for meta in _subscriber_users.get(board_id, {}).values()}
    if not _subscribers.get(board_id):
        _subscribers.pop(board_id, None)
        _subscriber_users.pop(board_id, None)
        _presence_watchers.pop(board_id, None)
    if not _presence_watchers.get(board_id):
        _presence_watchers.pop(board_id, None)
    if not _subscriber_users.get(board_id):
        _subscriber_users.pop(board_id, None)
    return [meta for user_id, meta in departed.items() if user_id not in remaining]


async def announce(board_id: UUID, version: int, pool: asyncpg.Pool):
    await announce_board_event(board_id, {"type": "document_changed", "version": version}, pool)


async def announce_comments(board_id: UUID, pool: asyncpg.Pool):
    await announce_board_event(board_id, {"type": "comments_changed"}, pool)


async def announce_board_event(board_id: UUID, event: dict[str, Any], pool: asyncpg.Pool):
    # Permission and session membership are checked at SEND TIME. A user who
    # was removed from a board or logged out must not receive future notices.
    await broadcast_checked(board_id, event, pool, dict(_subscribers.get(board_id, {})))


async def relay_live_event(board_id: UUID, sender: WebSocket,
                           event: dict[str, Any], pool: asyncpg.Pool):
    # Transient events never contain durable document or file bytes. Every
    # recipient's current session and board membership are rechecked.
    await broadcast_checked(board_id, event, pool, {
        peer: token for peer, token in _subscribers.get(board_id, {}).items() if peer is not sender
    })


# These frames need no additional asynchronous validation between checking
# permissions and starting peer delivery. Target/pilot events still perform
# their separate database checks and use a fresh recipient lookup afterwards.
INLINE_RELAY_TYPES = ("cursor", "live_ink", "live_erase", "work_state", "editor_mutation",
                      "object_transform", "teacher_view", "guided_follow", "attachment_request")


async def authorize_live_frame(pool, board_id, sender, token, kind):
    if kind in INLINE_RELAY_TYPES:
        peers = {peer: peer_token for peer, peer_token in _subscribers.get(board_id, {}).items()
                 if peer is not sender}
        rows = await lookup_board_sessions(pool, board_id, [token, *peers.values()])
        return require_board_session(rows, token), peers, rows
    return await lookup_board_session(pool, board_id, token, include_version=kind == "ping"), None, None


def validate_document_shape(document: dict):
    items = document.get("items")
    ink = document.get("ink", [])
    if not isinstance(items, list) or not isinstance(ink, list):
        error(422, "Документ должен содержать массивы items и ink.")
    if len(items) + len(ink) > MAX_DOCUMENT_ITEMS:
        error(413, "Слишком много объектов на доске.")


def serialize_document(document: dict) -> str:
    validate_document_shape(document)
    try:
        serialized = encode_delta(document)
    except (ValueError, OverflowError):
        error(422, "Недопустимые данные документа.")
    if len(serialized.encode("utf-8")) > MAX_DOCUMENT_BYTES:
        error(413, "Документ превышает ограничение 24 МБ.")
    return serialized


def decode_document(value):
    return json.loads(value) if isinstance(value, str) else value


def patched_document(base, delta):
    try:
        return apply_delta(base, delta)
    except ValueError:
        error(422, "Некорректные изменения документа.")


async def persist_normalized_items(conn, board_id, previous, base, document, delta, user_id, fast):
    """Read only changed item sizes, not their previous JSON bodies.

    The caller holds the board lock throughout validation and writing.
    """
    next_items = item_map(document["items"])
    old_items = item_map(base["items"]) if previous["normalized"] else {}
    deleted = list(old_items.keys() - next_items.keys())
    prior_bytes = previous["item_bytes"]
    # An older normalized board has no summary yet. Bootstrap it once from
    # the full document, not from the placeholder IDs used by fast saves.
    changed = [(item["id"], encode_delta(item)) for item in
               (next_items.values() if prior_bytes is None else delta.get("items", {}).get("upsert", []))]
    if prior_bytes is not None:
        replaced = list((set(deleted) | {key for key, _ in changed}) & old_items.keys())
        rows = await conn.fetch(
            "SELECT item_id,byte_size FROM board_document_items WHERE board_id=$1 AND item_id=ANY($2::text[])",
            board_id, replaced,
        ) if replaced else []
        if len(rows) != len(replaced) or any(row["byte_size"] is None for row in rows):
            raise RuntimeError("Incomplete board document size summary")
        remaining_bytes = prior_bytes - sum(row["byte_size"] for row in rows)
    else:
        remaining_bytes = 0
    metadata = {key: value for key, value in document.items() if key != "items"}
    if fast:
        validate_document_shape(document)
        try:
            size = document_bytes_from_parts(
                metadata, remaining_bytes + sum(len(value.encode("utf-8")) for _, value in changed), len(next_items),
            )
        except (ValueError, OverflowError):
            error(422, "Недопустимые данные документа.")
        if size > MAX_DOCUMENT_BYTES:
            error(413, "Документ превышает ограничение 24 МБ.")
    if deleted:
        await conn.execute(
            "DELETE FROM board_document_items WHERE board_id=$1 AND item_id=ANY($2::text[])", board_id, deleted,
        )
    if changed:
        ids = [key for key, _ in changed]
        encoded = [value for _, value in changed]
        # JSONB can normalize numeric spellings (e.g. 1e20). Measure the
        # persisted representation exactly as a later full read would.
        canonical = await conn.fetch(
            """SELECT entry.item_id,entry.item::jsonb AS item
               FROM unnest($1::text[],$2::text[]) AS entry(item_id,item)""",
            ids, encoded,
        )
        sizes = {row["item_id"]: encoded_bytes(decode_document(row["item"])) for row in canonical}
        await conn.execute(
            """INSERT INTO board_document_items(board_id,item_id,item,byte_size)
               SELECT $1,entry.item_id,entry.item::jsonb,entry.byte_size
               FROM unnest($2::text[],$3::text[],$4::integer[]) AS entry(item_id,item,byte_size)
               ON CONFLICT(board_id,item_id) DO UPDATE SET item=EXCLUDED.item,byte_size=EXCLUDED.byte_size""",
            board_id, ids, encoded, [sizes[key] for key in ids],
        )
        remaining_bytes += sum(sizes.values())
    return await conn.fetchrow(
        """UPDATE board_documents SET
              document_metadata=CASE WHEN document_metadata IS DISTINCT FROM $2::jsonb THEN $2::jsonb ELSE document_metadata END,
              item_order=CASE WHEN item_order IS DISTINCT FROM $3::text[] THEN $3::text[] ELSE item_order END,
              item_bytes=$5,version=version+1,updated_by=$4,updated_at=now()
            WHERE board_id=$1 RETURNING version,updated_at""",
        board_id, encode_delta(metadata), list(next_items), user_id, remaining_bytes,
    )


async def persist_document(board_id: UUID, expected_version: int, request: Request,
                           user, version_only: bool, document: dict | None = None,
                           delta: dict | None = None):
    # Full saves remain supported for older clients and initial/recovery saves.
    serialized = serialize_document(document) if document is not None else None
    if delta is not None:
        try:
            if len(encode_delta(delta).encode("utf-8")) > MAX_DELTA_BYTES:
                error(413, "Изменения превышают ограничение 1 МБ.")
        except (ValueError, OverflowError):
            error(422, "Недопустимые данные изменений.")
    async with request.app.state.pool.acquire() as conn:
        async with conn.transaction():
            board, role = await board_access(conn, board_id, user["id"], lock=True)
            if role not in ("owner", "editor") and not user["is_admin"]:
                error(403, "Недостаточно прав для изменения доски.")
            participant = await board_participant(conn, board_id, user, role)
            restricted = participant == "student" and not user["is_admin"]
            if delta is not None:
                # An obsolete autosave needs only the current revision, not
                # reconstruction/transfer of a potentially 24 MB board.
                previous = await conn.fetchrow(
                    """SELECT CASE WHEN version=$2 AND NOT ($3 AND item_bytes IS NOT NULL
                                  AND document_metadata IS NOT NULL) THEN lektrus_board_document(d) END AS document,
                              CASE WHEN version=$2 AND $3 AND item_bytes IS NOT NULL THEN document_metadata END AS metadata,
                              CASE WHEN version=$2 AND $3 AND item_bytes IS NOT NULL THEN item_order END AS item_order,
                              version,item_bytes,document_metadata IS NOT NULL AS normalized
                         FROM board_documents d WHERE board_id=$1""", board_id,
                    expected_version if expected_version <= 2**63-1 else -1,
                    version_only and not board["is_pilot"] and not restricted,
                )
            else:
                previous = await conn.fetchrow("SELECT version FROM board_documents WHERE board_id=$1", board_id)
            current_version = previous["version"] if previous else 0
            if current_version != expected_version:
                error(409, f"Версия доски изменилась: {current_version}.")
            await ensure_baseline(conn, board_id, current_version)
            fast = False
            base = None
            if delta is not None:
                if previous is None:
                    error(409, "Документ не найден.")
                fast = previous["metadata"] is not None
                if fast:
                    base = {**decode_document(previous["metadata"]),
                            "items": [{"id": key} for key in previous["item_order"]]}
                else:
                    base = decode_document(previous["document"])
                document = patched_document(base, delta)
            elif previous:
                base = decode_document(await conn.fetchval(
                    "SELECT lektrus_board_document(d) FROM board_documents d WHERE board_id=$1", board_id))
            if restricted:
                # Check the actual complete candidate before any document/asset/history mutation.
                # An empty new board permits student ink and own objects, not teacher metadata.
                student_base = base
                if student_base is None:
                    if document.get("title", board["title"]) != board["title"] or document.get("subject", "") != "" or document.get("backgroundShared", True) is not True or document.get("background", {"mode":"dots","color":"#f7f7f8","opacity":100}) != {"mode":"dots","color":"#f7f7f8","opacity":100}:
                        error(403, "Ученик не может менять настройки новой доски.")
                    student_base = {key: value for key, value in document.items() if key in ("version", "title", "subject", "view", "preview", "background", "backgroundShared")}
                    student_base["items"] = []
                    if "ink" in document:
                        student_base["ink"] = []
                if not await conn.fetchval(
                    "SELECT lektrus_private.student_document_delta_allowed($1::jsonb,$2::jsonb,$3)",
                    json.dumps(student_base), json.dumps(document), user["id"]
                ):
                    error(403, "Роль ученика не разрешает это изменение доски.")
            normalized_delta = False
            if delta is not None and not board["is_pilot"]:
                try:
                    next_items = item_map(document["items"])
                    if any(len(key.encode("utf-8")) > 1024 for key in next_items):
                        raise ValueError("Item ID too large for indexed storage")
                    normalized_delta = True
                except ValueError:
                    # Preserve compatibility with legacy documents whose item
                    # arrays have no stable unique IDs (metadata-only patches).
                    pass
            if fast and not normalized_delta:
                # Some legacy clients use arbitrarily long object IDs. Keep
                # their full-save fallback without writing placeholder items.
                base = decode_document(await conn.fetchval(
                    "SELECT lektrus_board_document(d) FROM board_documents d WHERE board_id=$1", board_id,
                ))
                document = patched_document(base, delta)
                fast = False
            if delta is not None and not fast:
                serialized = serialize_document(document)
            if normalized_delta:
                revision = await persist_normalized_items(
                    conn, board_id, previous, base, document, delta, user["id"], fast,
                )
            elif previous:
                revision = await conn.fetchrow(
                    """UPDATE board_documents
                          SET document=$2::jsonb,document_metadata=NULL,item_order=NULL,item_bytes=NULL,version=version+1,
                              updated_by=$3,updated_at=now()
                        WHERE board_id=$1
                        RETURNING version,updated_at""",
                    board_id, serialized, user["id"],
                )
                await conn.execute("DELETE FROM board_document_items WHERE board_id=$1", board_id)
            else:
                revision = await conn.fetchrow(
                    """INSERT INTO board_documents(board_id,document,version,updated_by)
                       VALUES($1,$2::jsonb,1,$3)
                       RETURNING version,updated_at""",
                    board_id, serialized, user["id"],
                )
            await conn.execute(
                "UPDATE boards SET updated_at=now() WHERE id=$1", board_id,
            )
            await record_revision(conn,board_id,revision,user,base,document,delta)
    version = revision["version"]
    if delta is not None:
        request.app.state.document_deltas.remember(board_id, version, delta)
    await announce(board_id, version, request.app.state.pool)
    if version_only:
        return {"version": version}
    return {"board_id": str(board_id), "document": document, "version": version,
            "updated_at": revision["updated_at"].isoformat(), "updated_by": str(user["id"])}


@app.put("/api/v1/boards/{board_id}/document")
async def save_document(board_id: UUID, data: SaveDocumentInput, request: Request,
                        version_only: bool = False, user=Depends(current_user)):
    return await persist_document(board_id, data.expected_version, request, user, version_only,
                                  document=data.document)


@app.patch("/api/v1/boards/{board_id}/document")
async def patch_document(board_id: UUID, data: PatchDocumentInput, request: Request,
                         version_only: bool = False, user=Depends(current_user)):
    return await persist_document(board_id, data.expected_version, request, user, version_only,
                                  delta=data.delta)

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
        compact_ink = initial.get("compact_ink", False)
        if type(presence_enabled) is not bool or type(presence_visible) is not bool or type(compact_ink) is not bool:
            await websocket.close(code=4401)
            return
        claims = jwt_claims(token)
        user = await lookup_board_session(websocket.app.state.pool, board_id, token, include_version=True)
        current_role = user["role"]
        current_version = user["version"]
        if len(_subscribers[board_id]) >= 100:
            await websocket.close(code=4429)
            return
        # Reserve one seat for the owner; multiple tabs count once.
        if not user["unlimited"] and not billing_seat_available(board_id,user["owner_id"],user["id"]):
            await websocket.send_json({"type": "plan_limit", **limit_detail("participants")})
            await websocket.close(code=4409)
            return
        user_meta = {
            "user_id": str(user["id"]),
            "name": str(user["display_name"] or "Участник")[:100],
            "role": current_role,
            "participant_role": user["participant_role"] or ("owner" if current_role == "owner" else "observer" if current_role == "viewer" else "student"),
            "online_at": str(int(time.time() * 1000)),
        }
        already_present = any(
            meta.get("user_id") == user_meta["user_id"]
            for meta in _subscriber_users.get(board_id, {}).values()
        )
        _subscribers[board_id][websocket] = token
        if compact_ink:
            _compact_ink_subscribers.add(websocket)
        if presence_enabled:
            _presence_watchers[board_id].add(websocket)
            if presence_visible:
                _subscriber_users[board_id][websocket] = user_meta
        await websocket.send_json({"type": "ready", "version": current_version,
                                   **({"compact_ink": True} if compact_ink else {})})
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
                refreshed_user, checked_peers, checked_rows = await authorize_live_frame(
                    websocket.app.state.pool, board_id, websocket, token, message.get("type")
                )
                if not refreshed_user["unlimited"] and not billing_seat_available(board_id,refreshed_user["owner_id"],refreshed_user["id"]):
                    await websocket.send_json({"type":"plan_limit", **limit_detail("participants")})
                    await websocket.close(code=4409)
                    return
                current_role = refreshed_user["role"]
                participant_role = refreshed_user["participant_role"] or ("owner" if current_role == "owner" else "observer" if current_role == "viewer" else "student")
                updated_presence = []
                for meta in _subscriber_users.get(board_id, {}).values():
                    if meta["user_id"] == str(refreshed_user["id"]) and (meta["role"] != current_role or meta.get("participant_role") != participant_role):
                        meta.update(role=current_role, participant_role=participant_role)
                        updated_presence.append(meta)
                if updated_presence:
                    await announce_presence(board_id, joins=[updated_presence[0]], pool=websocket.app.state.pool)
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong", "version": refreshed_user["version"]})
                    continue
                if refreshed_user["participant_role"] == "student" and message.get("type") in ("focus_view", "teacher_view", "guided_follow", "attachment_result"):
                    await websocket.send_json({"type": "event_error", "reason": "teacher_participant_required"})
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
                    if not refreshed_user["is_pilot"]:
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
                if checked_peers is not None:
                    await broadcast_checked(board_id, event, websocket.app.state.pool,
                                            checked_peers, authorized=checked_rows)
                else:
                    await relay_live_event(board_id, websocket, event, websocket.app.state.pool)
                if event["type"] in ("live_ink", "live_erase"):
                    # An ack confirms delivery to the server's relay, not that
                    # the stroke is saved in the durable board document.
                    await websocket.send_json({
                        "type": "ink_ack", "client_id": event["client_id"],
                        "stroke_id": event["stroke_id"],
                        "offset": event["offset"], "finished": event["finished"],
                    })
            except asyncio.TimeoutError:
                # Avoid stale sockets after logout/revocation, even without pings.
                await lookup_board_session(websocket.app.state.pool, board_id, token)
    except (WebSocketDisconnect, HTTPException, ValueError, TypeError, asyncio.TimeoutError):
        try:
            await websocket.close(code=4401)
        except Exception:
            pass
    finally:
        leaves = _detach_subscribers(board_id, [websocket])
        if leaves:
            await announce_presence(board_id, leaves=leaves, pool=websocket.app.state.pool)

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
app.include_router(make_billing_router(current_user))
app.include_router(make_finance_router(current_user))
from site_news import make_news_router
app.include_router(make_news_router(current_user))
app.include_router(make_telegram_router(current_user))
from comments import make_comments_router
app.include_router(make_comments_router(current_user, board_access, announce_comments))
from materials import make_material_router
app.include_router(make_material_router(current_user))
from board_templates import make_template_router
app.include_router(make_template_router(current_user, board_access, serialize_document))
from notifications import make_router as make_notifications_router
app.include_router(make_notifications_router(current_user))
from organization import make_router as make_organization_router
app.include_router(make_organization_router(current_user,board_access))
from direct_chats import make_router as make_direct_chats_router
app.include_router(make_direct_chats_router(current_user))

from share_links import make_share_router

app.include_router(make_share_router(current_user, board_access, board_view))
app.include_router(make_history_router(current_user, board_access))
app.include_router(make_visit_router(current_user, board_access))

from profiles import make_profile_router

app.include_router(make_profile_router(current_user))
