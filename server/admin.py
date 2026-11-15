"""Server-authoritative administration and feedback for the native Lektrus backend."""
from __future__ import annotations

from datetime import datetime, timezone
import asyncio
import json
import logging
from typing import Literal
from uuid import UUID, uuid4

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from assets import assets_root, file_path
from materials import material_path


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
    plan: Literal["free", "teacher", "pro"]
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
    plan = row["subscription_plan"] or "free"
    until = row["subscription_until"]
    if plan != "free" and until is not None and until < datetime.now(timezone.utc):
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

    @router.get("/api/v1/admin/users")
    async def admin_list_users(request: Request, user=Depends(current_user)):
        require_admin(user)
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id,display_name,email,account_role,teacher_status,is_admin,
                          subscription_plan,subscription_until,created_at
                     FROM account_users ORDER BY created_at DESC LIMIT 5000"""
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
        email = data.email.strip().lower()
        if not name or len(message) < 8:
            raise HTTPException(422, "Заполните имя и сообщение не короче 8 символов.")
        if email and ("@" not in email or len(email) > 254):
            raise HTTPException(422, "Проверьте email.")
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow(
                """INSERT INTO product_feedback
                   (id,name,email,topic,message,source,status)
                   VALUES($1,$2,$3,$4,$5,$6,'new')
                   RETURNING id,user_id,name,email,topic,message,source,status,created_at""",
                uuid4(), name, email, data.topic, message, data.source,
            )
        return dict(row)

    @router.get("/api/v1/admin/feedback")
    async def admin_list_feedback(request: Request, user=Depends(current_user)):
        require_admin(user)
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id,user_id,name,email,topic,message,source,status,created_at
                     FROM product_feedback ORDER BY created_at DESC LIMIT 200"""
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

    return router
