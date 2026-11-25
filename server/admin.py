"""Server-authoritative administration and feedback for the native Lektrus backend."""
from __future__ import annotations

from datetime import datetime, timezone
import asyncio
import json
import logging
import time
from collections import deque
from typing import Literal
from uuid import UUID, uuid4

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from assets import assets_root, file_path
from billing import STORAGE_BY_OWNER, storage_view
from share_links import GUEST_HOURS, GUEST_DISPOSABLE, guest_storage_stats, cleanup_expired_guests
from materials import material_path
from board_templates import template_path
from feedback_mail import feedback_email_address, send_test_emails


def require_admin(user):
    if not bool(user["is_admin"]):
        raise HTTPException(403, "Недостаточно прав администратора.")


class TeacherApplicationInput(BaseModel):
    phone: str = Field(default="", max_length=40)
    city: str = Field(default="", max_length=100)
    organization: str = Field(min_length=2, max_length=160)
    focusArea: str = Field(min_length=2, max_length=120)
    experience: str = Field(default="", max_length=1000)
    motivation: str = Field(default="", max_length=1000)


class TeacherReviewInput(BaseModel):
    approve: bool


class SubscriptionInput(BaseModel):
    plan: Literal["free", "pro"]
    until: datetime | None = None


class DeleteUserInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class FeedbackInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(default="", max_length=254)
    topic: Literal["Предложение", "Отзыв о сервисе", "Сообщить о проблеме", "Другое"]
    message: str = Field(min_length=8, max_length=4000)
    source: Literal["site", "app"] = "app"


class FeedbackStatusInput(BaseModel):
    status: Literal["new", "reviewed", "closed"]


class FeedbackReplyInput(BaseModel):
    request_id: UUID
    message: str = Field(min_length=1, max_length=8000)


class TestMailInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    kinds: list[Literal["confirmation", "password_reset", "notification", "reply"]] = Field(min_length=1, max_length=4)


class InterfaceLayoutInput(BaseModel):
    layout: dict


# Bound test traffic without preventing administrators from checking templates
# individually. One batch at a time, at most twelve messages per minute.
_test_mail_attempts: deque[float] = deque()
_test_mail_active = False


_feedback_attempts: dict[str, deque[float]] = {}


def throttle_feedback(request: Request):
    now = time.monotonic()
    key = request.client.host if request.client else "unknown"
    for old in list(_feedback_attempts):
        if _feedback_attempts[old][-1] < now-600:
            del _feedback_attempts[old]
    if key not in _feedback_attempts and len(_feedback_attempts) >= 4096:
        raise HTTPException(429, "Слишком много обращений. Повторите позже.")
    attempts = _feedback_attempts.setdefault(key, deque())
    while attempts and attempts[0] < now-600:
        attempts.popleft()
    if len(attempts) >= 8:
        raise HTTPException(429, "Слишком много обращений. Повторите позже.")
    attempts.append(now)


def json_object(value):
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError):
            return {}
    return value if isinstance(value, dict) else {}


def access_view(row):
    role = "teacher" if (
        bool(row["is_admin"]) or
        (row["account_role"] == "teacher" and row["teacher_status"] == "approved")
    ) else "student"
    plan = "pro" if row["subscription_plan"] == "pro" else "free"
    until = row["subscription_until"]
    if plan != "pro" or until is None or until <= datetime.now(timezone.utc):
        plan, until = "free", None
    return {
        "role": role,
        "teacher_status": "approved" if row["is_admin"] else row["teacher_status"],
        "is_admin": bool(row["is_admin"]),
        "requested_at": row["teacher_requested_at"].isoformat() if row["teacher_requested_at"] else None,
        "reviewed_at": row["teacher_reviewed_at"].isoformat() if row["teacher_reviewed_at"] else None,
        "subscription_plan": plan,
        "subscription_until": until.isoformat() if until else None,
    }


def make_admin_router(current_user) -> APIRouter:
    router = APIRouter()

    @router.get("/api/v1/admin/storage")
    async def storage_report(request: Request, offset: int=Query(0,ge=0,le=1000000),
                             user=Depends(current_user)):
        require_admin(user)
        # Catalog and file-size metadata only; do not scan or decompress
        # the actual board JSON, run VACUUM, or delete any data.
        async with request.app.state.pool.acquire() as conn:
            database_bytes = await conn.fetchval("SELECT pg_database_size(current_database())")
            tables = await conn.fetch("""
                SELECT schemaname AS schema, relname AS name,
                    pg_table_size(relid) AS data_bytes,
                    pg_indexes_size(relid) AS index_bytes,
                    pg_total_relation_size(relid) AS total_bytes,
                    n_live_tup AS live_rows, n_dead_tup AS dead_rows,
                    last_vacuum, last_autovacuum
                FROM pg_stat_user_tables
                ORDER BY total_bytes DESC, schemaname, relname
            """)
            # Managed PostgreSQL may restrict access to the WAL directory.
            # Missing access must not appear as a fabricated zero.
            try:
                wal_bytes = await conn.fetchval("SELECT coalesce(sum(size),0)::bigint FROM pg_ls_waldir()")
            except (asyncpg.InsufficientPrivilegeError, asyncpg.UndefinedFunctionError, asyncpg.FeatureNotSupportedError):
                wal_bytes = None
            databases = await conn.fetch("""
                SELECT datname AS name, datname=current_database() AS current,
                    CASE WHEN has_database_privilege(oid,'CONNECT') OR pg_has_role('pg_read_all_stats','USAGE')
                         THEN pg_database_size(oid) ELSE NULL END AS bytes
                FROM pg_database ORDER BY (datname=current_database()) DESC,datname
            """)
            guests = await guest_storage_stats(conn)
            accounts = await conn.fetch(STORAGE_BY_OWNER+"""
                SELECT * FROM usage WHERE guest_board_id IS NULL ORDER BY used_bytes DESC, id LIMIT 51 OFFSET $2
            """, None, offset)
        return {"database_bytes":database_bytes, "wal_bytes":wal_bytes,
                "tables":[dict(t) for t in tables],
                "databases":[dict(d) for d in databases], "guests":guests,
                "measured_at":datetime.now(timezone.utc),
                "users":[{"id":a["id"],"name":a["display_name"],"email":a["email"],
                           "plan":"admin" if a["is_admin"] else "pro" if a["pro"] else "free",
                           **storage_view(a)} for a in accounts[:50]],
                "offset":offset, "has_more":len(accounts)>50}

    @router.post("/api/v1/admin/storage/cleanup-guests")
    async def cleanup_guests(request: Request, user=Depends(current_user)):
        require_admin(user)
        return await cleanup_expired_guests(request.app.state.pool)

    @router.get("/api/v1/interface-layout")
    async def read_interface_layout(request: Request):
        # Shared UI settings contain no account or board data, including for guests.
        async with request.app.state.pool.acquire() as conn:
            value = await conn.fetchval("select layout from global_interface_layout where singleton")
        return {"layout": json_object(value) if value is not None else None}

    @router.put("/api/v1/admin/interface-layout")
    async def publish_interface_layout(data: InterfaceLayoutInput, request: Request,
                                       user=Depends(current_user)):
        require_admin(user)
        try:
            serialized = json.dumps(data.layout, ensure_ascii=False, allow_nan=False)
        except (ValueError, TypeError):
            raise HTTPException(422, "Некорректный формат интерфейса.")
        if (data.layout.get("version") != 1 or
            any(not isinstance(data.layout.get(key), dict) for key in ("profiles", "controls", "extras")) or
            len(serialized.encode("utf-8")) > 1_000_000):
            raise HTTPException(422, "Некорректный формат интерфейса.")
        async with request.app.state.pool.acquire() as conn:
            await conn.execute("""
                insert into global_interface_layout (singleton, layout) values (true, $1::jsonb)
                on conflict (singleton) do update set layout=excluded.layout, updated_at=now()
            """, serialized)
        return {"ok": True}

    @router.post("/api/v1/account/teacher-request")
    async def request_teacher_access(data: TeacherApplicationInput, request: Request,
                                     user=Depends(current_user)):
        if user["is_admin"]:
            return access_view(user)
        phone = data.phone.strip()
        if phone and (len(phone) < 7 or any(ch not in "+0123456789 ()-" for ch in phone)):
            raise HTTPException(422, "Проверьте номер телефона.")
        application = data.model_dump()
        application.update({
            "phone": phone,
            "city": data.city.strip(),
            "organization": data.organization.strip(),
            "focusArea": data.focusArea.strip(),
            "experience": data.experience.strip(),
            "motivation": data.motivation.strip(),
        })
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow(
                """UPDATE account_users
                      SET account_role='student',teacher_status='pending',
                          teacher_requested_at=now(),teacher_reviewed_at=NULL,
                          teacher_reviewed_by=NULL,teacher_application=$2::jsonb,
                          profile_details=profile_details || jsonb_build_object(
                            'phone',$3::text,'city',$4::text,
                            'organization',$5::text,'focus_area',$6::text
                          )
                    WHERE id=$1
                    RETURNING id,email,account_role,teacher_status,is_admin,
                              teacher_requested_at,teacher_reviewed_at,
                              subscription_plan,subscription_until""",
                user["id"], json.dumps(application, ensure_ascii=False),
                phone, application["city"], application["organization"],
                application["focusArea"],
            )
        return access_view(row)

    @router.post("/api/v1/account/role/teacher")
    async def enable_teacher_role(request: Request, user=Depends(current_user)):
        # Same eligibility as registering directly as a teacher: verified,
        # non-guest account. Never touches board_members or administrator rights.
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow(
                """UPDATE account_users SET account_role='teacher',teacher_status='approved',
                           teacher_requested_at=COALESCE(teacher_requested_at,now()),
                           teacher_reviewed_at=COALESCE(teacher_reviewed_at,now())
                     WHERE id=$1 AND email_confirmed_at IS NOT NULL
                       AND guest_board_id IS NULL AND teacher_status<>'rejected'
                    RETURNING id,email,account_role,teacher_status,is_admin,
                              teacher_requested_at,teacher_reviewed_at,subscription_plan,subscription_until""",
                user["id"],
            )
        if row is None:
            raise HTTPException(403, "Не удалось подключить преподавательские функции. Обратитесь в поддержку.")
        return access_view(row)

    @router.post("/api/v1/account/role/student")
    async def set_student_role(request: Request, user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow(
                """UPDATE account_users
                      SET account_role='student',
                          teacher_status=CASE WHEN teacher_status='approved' THEN 'none'
                                              ELSE teacher_status END
                    WHERE id=$1
                    RETURNING id,email,account_role,teacher_status,is_admin,
                              teacher_requested_at,teacher_reviewed_at,
                              subscription_plan,subscription_until""",
                user["id"],
            )
        return access_view(row)

    @router.get("/api/v1/admin/guests")
    async def admin_list_guests(request: Request, offset: int=Query(0,ge=0,le=1000000),
                                q: str=Query("",max_length=120), user=Depends(current_user)):
        require_admin(user)
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction(readonly=True, isolation="repeatable_read"):
                measured_at = await conn.fetchval("SELECT now()")
                rows = await conn.fetch(f"""
                    SELECT u.id,u.display_name,u.created_at,u.guest_expires_at,
                           b.title AS board_title,
                           ({GUEST_DISPOSABLE}) AS disposable,
                           u.guest_expires_at+interval '5 minutes' AS cleanup_eligible_at
                    FROM account_users u LEFT JOIN boards b ON b.id=u.guest_board_id
                    WHERE u.guest_board_id IS NOT NULL
                      AND ($2='' OR strpos(lower(coalesce(u.display_name,'') || ' ' || coalesce(b.title,'')),lower($2))>0)
                    ORDER BY u.created_at DESC,u.id DESC LIMIT 51 OFFSET $1
                """, offset, q.strip())
        return {"server_time":measured_at,"access_hours":GUEST_HOURS,
                "offset":offset,"has_more":len(rows)>50,
                "guests":[{"id":str(row["id"]),"name":row["display_name"] or "Гость",
                           "board_title":row["board_title"],
                           "joined_at":row["created_at"],"expires_at":row["guest_expires_at"],
                           "cleanup_eligible_at":row["cleanup_eligible_at"],
                           "protected":not row["disposable"]}
                          for row in rows[:50]]}

    @router.get("/api/v1/admin/users")
    async def admin_list_users(request: Request, user=Depends(current_user)):
        require_admin(user)
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id,display_name,email,account_role,teacher_status,is_admin,
                          subscription_plan,subscription_until,created_at
                     FROM account_users WHERE guest_board_id IS NULL ORDER BY created_at DESC LIMIT 5000"""
            )
        now = datetime.now(timezone.utc)
        return [{
            "user_id": str(row["id"]),
            "name": row["display_name"] or "Пользователь",
            "email": row["email"],
            "role": "teacher" if row["is_admin"] or (
                row["account_role"] == "teacher" and row["teacher_status"] == "approved"
            ) else "student",
            "teacher_status": row["teacher_status"],
            "is_admin": bool(row["is_admin"]),
            "subscription_plan": (
                "free" if row["subscription_plan"] != "free" and
                row["subscription_until"] is not None and row["subscription_until"] < now
                else row["subscription_plan"]
            ),
            "subscription_until": (
                None if row["subscription_plan"] == "free" or (
                    row["subscription_until"] is not None and row["subscription_until"] < now
                ) else row["subscription_until"].isoformat() if row["subscription_until"] else None
            ),
            "created_at": row["created_at"].isoformat(),
        } for row in rows]

    @router.delete("/api/v1/admin/users/{user_id}")
    async def admin_delete_user(user_id: UUID, data: DeleteUserInput,
                                request: Request, user=Depends(current_user)):
        require_admin(user)
        if user_id == user["id"]:
            raise HTTPException(409, "Нельзя удалить собственный аккаунт.")
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                target = await conn.fetchrow(
                    "SELECT email,is_admin FROM account_users WHERE id=$1 FOR UPDATE",
                    user_id,
                )
                if target is None:
                    raise HTTPException(404, "Пользователь не найден.")
                if target["is_admin"]:
                    raise HTTPException(409, "Нельзя удалить администратора.")
                if data.email.strip().lower() != target["email"]:
                    raise HTTPException(409, "Адрес электронной почты не совпадает.")
                # Lock owned boards before recording their physical files. Shared
                # boards are not deleted; historical attribution becomes NULL.
                await conn.fetch("SELECT id FROM boards WHERE owner_id=$1 FOR UPDATE", user_id)
                assets = await conn.fetch(
                    """SELECT a.board_id,a.storage_name FROM board_assets a
                       JOIN boards b ON b.id=a.board_id WHERE b.owner_id=$1""", user_id,
                )
                materials = await conn.fetch(
                    "SELECT storage_name FROM learning_materials WHERE owner_id=$1", user_id,
                )
                templates = await conn.fetch(
                    "SELECT id,assets FROM board_templates WHERE owner_id=$1 FOR UPDATE", user_id,
                )
                # Keep other members' replies on a shared board rather than
                # cascading them through the deleted author's comment.
                await conn.execute(
                    """UPDATE board_comments reply SET parent_id=NULL
                       FROM board_comments parent
                       WHERE reply.parent_id=parent.id AND parent.author_id=$1
                         AND reply.author_id<>$1""", user_id,
                )
                # An existing private chat requires both participants. Remove
                # the deleted user's chats and any remaining authored messages.
                await conn.execute(
                    """DELETE FROM direct_conversations WHERE id IN
                       (SELECT conversation_id FROM direct_conversation_members WHERE user_id=$1)""",
                    user_id,
                )
                await conn.execute("DELETE FROM direct_messages WHERE sender_id=$1", user_id)
                await conn.execute("DELETE FROM board_invites WHERE email=$1", target["email"])
                await conn.execute("DELETE FROM product_feedback WHERE user_id=$1", user_id)
                # Foreign keys cascade personal records, owned boards and all
                # sessions. Shared board documents/assets use ON DELETE SET NULL.
                await conn.execute("DELETE FROM account_users WHERE id=$1", user_id)
        # A rollback must never remove files. Only unlink explicitly recorded
        # server-generated names after the transaction has committed.
        failed_files = 0
        for row in assets:
            try:
                path = file_path(assets_root(), row["board_id"], row["storage_name"])
                await asyncio.to_thread(path.unlink, missing_ok=True)
            except (OSError, RuntimeError):
                failed_files += 1
        for row in materials:
            try:
                await asyncio.to_thread(material_path(row["storage_name"]).unlink, missing_ok=True)
            except (OSError, RuntimeError):
                failed_files += 1
        for row in templates:
            manifest = json.loads(row["assets"]) if isinstance(row["assets"], str) else row["assets"]
            for asset in manifest:
                try:
                    path = template_path(assets_root(), row["id"], UUID(asset["storage"]))
                    await asyncio.to_thread(path.unlink, missing_ok=True)
                except (OSError, RuntimeError):
                    failed_files += 1
        if failed_files:
            logging.getLogger("lektrus.admin").warning(
                "Account deleted; %d private files need cleanup", failed_files
            )
        return {"ok": True, "files_pending": failed_files}

    @router.get("/api/v1/admin/teacher-requests")
    async def admin_list_teacher_requests(request: Request, user=Depends(current_user)):
        require_admin(user)
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id,display_name,email,teacher_status,teacher_requested_at,
                          teacher_reviewed_at,teacher_application
                     FROM account_users
                    WHERE teacher_status IN ('pending','approved','rejected')
                    ORDER BY CASE teacher_status WHEN 'pending' THEN 0 ELSE 1 END,
                             teacher_requested_at DESC NULLS LAST"""
            )
        return [{
            "user_id": str(row["id"]),
            "name": row["display_name"] or "Пользователь",
            "email": row["email"],
            "status": row["teacher_status"],
            "requested_at": row["teacher_requested_at"].isoformat() if row["teacher_requested_at"] else None,
            "reviewed_at": row["teacher_reviewed_at"].isoformat() if row["teacher_reviewed_at"] else None,
            "application": json_object(row["teacher_application"]),
        } for row in rows]

    @router.post("/api/v1/admin/teacher-requests/{user_id}/review")
    async def admin_review_teacher_request(user_id: UUID, data: TeacherReviewInput,
                                           request: Request, user=Depends(current_user)):
        require_admin(user)
        if user_id == user["id"]:
            raise HTTPException(400, "Нельзя изменять собственные права преподавателя.")
        async with request.app.state.pool.acquire() as conn:
            changed = await conn.fetchval(
                """UPDATE account_users
                      SET account_role=$2,teacher_status=$3,
                          teacher_reviewed_at=now(),teacher_reviewed_by=$4
                    WHERE id=$1 AND is_admin=false RETURNING id""",
                user_id, "teacher" if data.approve else "student",
                "approved" if data.approve else "rejected", user["id"],
            )
        if changed is None:
            raise HTTPException(404, "Пользователь не найден.")
        return {"ok": True, "status": "approved" if data.approve else "rejected"}

    @router.patch("/api/v1/admin/users/{user_id}/subscription")
    async def admin_set_subscription(user_id: UUID, data: SubscriptionInput,
                                     request: Request, user=Depends(current_user)):
        require_admin(user)
        until = data.until
        if data.plan == "free":
            until = None
        elif until is None:
            raise HTTPException(422, "Укажите будущую дату окончания подписки.")
        elif until.tzinfo is None:
            until = until.replace(tzinfo=timezone.utc)
        if data.plan != "free" and until <= datetime.now(timezone.utc):
            raise HTTPException(422, "Укажите будущую дату окончания подписки.")
        async with request.app.state.pool.acquire() as conn:
            changed = await conn.fetchval(
                """UPDATE account_users
                      SET subscription_plan=$2,subscription_until=$3,
                          subscription_granted_by=$4,subscription_updated_at=now()
                    WHERE id=$1 RETURNING id""",
                user_id, data.plan, until, user["id"],
            )
        if changed is None:
            raise HTTPException(404, "Пользователь не найден.")
        return {"ok": True, "plan": data.plan,
                "until": until.isoformat() if until else None}

    @router.get("/api/v1/admin/boards")
    async def admin_list_boards(request: Request, user=Depends(current_user)):
        require_admin(user)
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT b.id,b.owner_id,b.title,b.created_at,b.updated_at,b.deleted_at,
                          coalesce(u.display_name,'Пользователь') AS owner_name,
                          coalesce(u.email,'') AS owner_email,
                          (SELECT count(*) FROM board_members m WHERE m.board_id=b.id) AS member_count
                     FROM boards b LEFT JOIN account_users u ON u.id=b.owner_id
                    WHERE b.deleted_at IS NULL ORDER BY b.updated_at DESC LIMIT 5000"""
            )
        return [{
            "id": str(row["id"]), "owner_id": str(row["owner_id"]),
            "title": row["title"], "owner_name": row["owner_name"],
            "owner_email": row["owner_email"], "member_count": row["member_count"],
            "created_at": row["created_at"].isoformat(),
            "updated_at": row["updated_at"].isoformat(),
            "deleted_at": row["deleted_at"].isoformat() if row["deleted_at"] else None,
        } for row in rows]

    @router.get("/api/v1/admin/users/{user_id}/boards")
    async def admin_list_user_workspace(user_id: UUID, request: Request,
                                        user=Depends(current_user)):
        require_admin(user)
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT DISTINCT b.id,b.owner_id,b.title,b.created_at,b.updated_at,b.deleted_at,
                          coalesce(u.display_name,'Пользователь') AS owner_name,
                          coalesce(u.email,'') AS owner_email,
                          (SELECT count(*) FROM board_members m WHERE m.board_id=b.id) AS member_count
                     FROM boards b LEFT JOIN account_users u ON u.id=b.owner_id
                     LEFT JOIN board_members mine ON mine.board_id=b.id AND mine.user_id=$1
                    WHERE b.deleted_at IS NULL AND (b.owner_id=$1 OR mine.user_id=$1)
                    ORDER BY b.updated_at DESC""",
                user_id,
            )
        return [{
            "id": str(row["id"]), "owner_id": str(row["owner_id"]),
            "title": row["title"], "owner_name": row["owner_name"],
            "owner_email": row["owner_email"], "member_count": row["member_count"],
            "created_at": row["created_at"].isoformat(),
            "updated_at": row["updated_at"].isoformat(),
            "deleted_at": row["deleted_at"].isoformat() if row["deleted_at"] else None,
        } for row in rows]

    @router.post("/api/v1/feedback", status_code=201)
    async def submit_feedback(data: FeedbackInput, request: Request):
        name, message = data.name.strip(), data.message.strip()
        email = feedback_email_address(data.email) if data.email.strip() else ""
        if not name or len(message) < 8:
            raise HTTPException(422, "Заполните имя и сообщение не короче 8 символов.")
        throttle_feedback(request)
        async with request.app.state.pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """INSERT INTO product_feedback
                   (id,name,email,topic,message,source,status)
                   VALUES($1,$2,$3,$4,$5,$6,'new')
                   RETURNING id,user_id,name,email,topic,message,source,status,created_at""",
                uuid4(), name, email, data.topic, message, data.source,
            )
            await conn.execute("""INSERT INTO feedback_mail(id,feedback_id,kind,subject,body)
                VALUES($1,$2,'notification',$3,$4)""", uuid4(),row["id"],
                f"Новое обращение: {data.topic}",
                f"Имя: {name}\nEmail: {email or 'Не указан'}\nИсточник: {'сайт' if data.source=='site' else 'приложение'}\n\n{message}")
        request.app.state.feedback_mail_wakeup.set()
        return dict(row)

    @router.get("/api/v1/admin/feedback")
    async def admin_list_feedback(request: Request, user=Depends(current_user)):
        require_admin(user)
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT f.id,f.user_id,f.name,f.email,f.topic,f.message,f.source,f.status,f.created_at,
                    m.id AS notification_id,m.status AS notification_status,m.last_error AS notification_error,
                    m.sent_at AS notification_sent_at
                    FROM product_feedback f LEFT JOIN feedback_mail m ON m.feedback_id=f.id AND m.kind='notification'
                    ORDER BY f.created_at DESC LIMIT 200"""
            )
        return [dict(row) for row in rows]

    @router.patch("/api/v1/admin/feedback/{feedback_id}")
    async def admin_update_feedback(feedback_id: UUID, data: FeedbackStatusInput,
                                    request: Request, user=Depends(current_user)):
        require_admin(user)
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow(
                """UPDATE product_feedback SET status=$2
                    WHERE id=$1
                    RETURNING id,user_id,name,email,topic,message,source,status,created_at""",
                feedback_id, data.status,
            )
        if row is None:
            raise HTTPException(404, "Сообщение не найдено.")
        return dict(row)

    @router.get("/api/v1/admin/feedback-mail")
    async def list_feedback_mail(request: Request, user=Depends(current_user)):
        require_admin(user)
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch("""SELECT m.id,m.feedback_id,m.recipient,m.subject,m.body,m.status,
                m.attempts,m.last_error,m.created_at,m.sent_at,f.name AS recipient_name
                FROM feedback_mail m JOIN product_feedback f ON f.id=m.feedback_id
                WHERE m.kind='reply' ORDER BY m.created_at DESC LIMIT 200""")
        return [dict(row) for row in rows]

    @router.post("/api/v1/admin/feedback-mail/test")
    async def test_mail(data: TestMailInput, user=Depends(current_user)):
        require_admin(user)
        email = feedback_email_address(data.email)
        global _test_mail_active
        now = time.monotonic()
        kinds = list(dict.fromkeys(data.kinds))
        if _test_mail_active:
            raise HTTPException(429, "Дождитесь завершения предыдущей отправки.")
        while _test_mail_attempts and _test_mail_attempts[0] <= now - 60:
            _test_mail_attempts.popleft()
        if len(_test_mail_attempts) + len(kinds) > 12:
            raise HTTPException(429, "Достигнут лимит тестовых писем. Повторите через минуту.")
        _test_mail_attempts.extend([now] * len(kinds))
        _test_mail_active = True
        try:
            return {"email": email, "results": await send_test_emails(email, kinds)}
        finally:
            _test_mail_active = False

    @router.post("/api/v1/admin/feedback/{feedback_id}/reply", status_code=202)
    async def reply_feedback(feedback_id: UUID,data: FeedbackReplyInput,request: Request,user=Depends(current_user)):
        require_admin(user)
        body = data.message.strip()
        if not body:
            raise HTTPException(422,"Введите текст ответа.")
        async with request.app.state.pool.acquire() as conn, conn.transaction():
            feedback = await conn.fetchrow("SELECT email,topic FROM product_feedback WHERE id=$1",feedback_id)
            if not feedback:
                raise HTTPException(404,"Обращение не найдено.")
            if not feedback["email"]:
                raise HTTPException(422,"Пользователь не указал email для ответа.")
            recipient = feedback_email_address(feedback["email"])
            row = await conn.fetchrow("""INSERT INTO feedback_mail(id,feedback_id,kind,recipient,subject,body)
                VALUES($1,$2,'reply',$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id""",
                data.request_id,feedback_id,recipient,f"Ответ Lektrus: {feedback['topic']}",body)
            if not row:
                existing = await conn.fetchval("SELECT id FROM feedback_mail WHERE id=$1 AND feedback_id=$2 AND kind='reply' AND body=$3",data.request_id,feedback_id,body)
                if not existing:
                    raise HTTPException(409,"Запрос уже использован.")
            await conn.execute("UPDATE product_feedback SET status='reviewed' WHERE id=$1 AND status='new'",feedback_id)
        request.app.state.feedback_mail_wakeup.set()
        return {"id":data.request_id,"ok":True}

    @router.post("/api/v1/admin/feedback-mail/{mail_id}/retry", status_code=202)
    async def retry_feedback_mail(mail_id: UUID,request: Request,user=Depends(current_user)):
        require_admin(user)
        async with request.app.state.pool.acquire() as conn:
            result = await conn.fetchval("""UPDATE feedback_mail SET status='pending',attempts=0,last_error=NULL,
                send_after=now() WHERE id=$1 AND status='failed' RETURNING id""",mail_id)
        if not result:
            raise HTTPException(409,"Повторить можно только неотправленное письмо.")
        request.app.state.feedback_mail_wakeup.set()
        return {"ok":True}

    return router
