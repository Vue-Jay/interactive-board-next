"""Server-authoritative, persisted service maintenance policy."""
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

PUBLIC_READS = {"/api/v1/health", "/api/v1/maintenance", "/api/v1/news",
                "/api/v1/mobile/android-update", "/api/v1/interface-layout"}
AUTH_ROUTES = {"/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/logout",
               "/api/v1/auth/password-reset/request", "/api/v1/auth/password-reset/complete",
               "/api/v1/auth/verify-email"}

class MaintenanceInput(BaseModel):
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    notice: str = Field(default="", max_length=500)
    allowed_accounts: list[UUID] = Field(default_factory=list, max_length=5000)

async def read_policy(pool):
    async with pool.acquire() as conn:
        return await conn.fetchrow("SELECT starts_at,ends_at,notice,allowed_accounts FROM service_maintenance WHERE singleton")

def phase(policy, now=None):
    now = now or datetime.now(timezone.utc)
    if not policy or not policy["starts_at"] or (policy["ends_at"] and policy["ends_at"] <= now):
        return "off"
    return "scheduled" if policy["starts_at"] > now else "active"

def permitted(policy, user):
    return bool(user and user["guest_board_id"] is None and
                (user["is_admin"] or user["id"] in policy["allowed_accounts"]))

def view(policy, user=None, admin=False):
    now = datetime.now(timezone.utc)
    state = phase(policy, now)
    result = {"state": state, "starts_at": policy["starts_at"], "ends_at": policy["ends_at"],
              "notice": policy["notice"] if state != "off" or admin else "",
              "access_allowed": state != "active" or permitted(policy, user),
              "server_time": now}
    if admin:
        result["allowed_accounts"] = policy["allowed_accounts"]
    elif state == "off":
        result.update(starts_at=None, ends_at=None)
    return result

async def optional_user(request, lookup_session):
    token = request.headers.get("authorization", "")
    if not token.startswith("Bearer "):
        return None
    try:
        return await lookup_session(request.app.state.pool, token[7:])
    except HTTPException as exc:
        if exc.status_code in (401, 403):
            return None
        raise

def install_maintenance(app, lookup_session, current_user):
    @app.middleware("http")
    async def maintenance_middleware(request: Request, call_next):
        path = request.url.path.rstrip("/")
        if (request.method == "OPTIONS" or not path.startswith("/api/v1/") or
                (request.method in ("GET", "HEAD") and path in PUBLIC_READS) or
                (request.method == "POST" and path in AUTH_ROUTES) or
                (request.method == "GET" and path == "/api/v1/auth/me")):
            return await call_next(request)
        policy = await read_policy(request.app.state.pool)
        if phase(policy) == "active":
            user = await optional_user(request, lookup_session)
            if not permitted(policy, user):
                return JSONResponse(status_code=503, content={
                    "detail": "В Lektrus ведутся технические работы.",
                    "code": "maintenance",
                }, headers={"Cache-Control": "no-store"})
        return await call_next(request)

    router = APIRouter()

    @router.get("/api/v1/maintenance")
    async def status(request: Request):
        from fastapi.encoders import jsonable_encoder
        policy = await read_policy(request.app.state.pool)
        user = await optional_user(request, lookup_session) if phase(policy) == "active" else None
        return JSONResponse(jsonable_encoder(view(policy, user)), headers={"Cache-Control": "no-store"})

    @router.get("/api/v1/admin/maintenance")
    async def admin_status(request: Request, user=Depends(current_user)):
        if not user["is_admin"]:
            raise HTTPException(403, "Требуются права администратора.")
        return view(await read_policy(request.app.state.pool), user, admin=True)

    @router.put("/api/v1/admin/maintenance")
    async def update(data: MaintenanceInput, request: Request, user=Depends(current_user)):
        if not user["is_admin"]:
            raise HTTPException(403, "Требуются права администратора.")
        start, end = data.starts_at, data.ends_at
        if any(value is not None and value.utcoffset() is None for value in (start, end)):
            raise HTTPException(422, "Укажите часовой пояс для дат.")
        if end and (not start or end <= start or end <= datetime.now(timezone.utc)):
            raise HTTPException(422, "Окончание должно быть в будущем и позже начала.")
        ids = list(dict.fromkeys(data.allowed_accounts))
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                valid = await conn.fetchval(
                    "SELECT count(*) FROM account_users WHERE id=ANY($1::uuid[]) AND guest_board_id IS NULL", ids)
                if valid != len(ids):
                    raise HTTPException(422, "В списке доступа есть недоступные аккаунты.")
                policy = await conn.fetchrow(
                    """UPDATE service_maintenance SET starts_at=$1, ends_at=$2, notice=$3, allowed_accounts=$4
                       WHERE singleton RETURNING starts_at,ends_at,notice,allowed_accounts""",
                    start, end, data.notice.strip(), ids)
        return view(policy, user, admin=True)

    app.include_router(router)
