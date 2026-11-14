"""Board discussion threads for the native Lektrus API."""
from __future__ import annotations

from uuid import UUID, uuid4

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field


class CreateCommentInput(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    parent_id: UUID | None = None


class ResolveCommentInput(BaseModel):
    resolved: bool


def iso(value):
    return value.isoformat() if value is not None else None


def make_comments_router(current_user, board_access) -> APIRouter:
    router = APIRouter()

    @router.get("/api/v1/boards/{board_id}/comments")
    async def list_comments(board_id: UUID, request: Request,
                            user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn:
            await board_access(conn, board_id, user["id"])
            rows = await conn.fetch(
                """SELECT id,board_id,author_id,author_name,parent_id,body,
                          resolved,created_at,updated_at
                     FROM board_comments WHERE board_id=$1
                    ORDER BY created_at,id LIMIT 2000""",
                board_id,
            )
        return [{
            "id": str(row["id"]), "board_id": str(row["board_id"]),
            "author_id": str(row["author_id"]), "author_name": row["author_name"],
            "parent_id": str(row["parent_id"]) if row["parent_id"] else None,
            "body": row["body"], "resolved": row["resolved"],
            "created_at": iso(row["created_at"]), "updated_at": iso(row["updated_at"]),
        } for row in rows]

    @router.get("/api/v1/boards/{board_id}/comment-participants")
    async def list_comment_participants(board_id: UUID, request: Request,
                                       user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn:
            await board_access(conn, board_id, user["id"])
            rows = await conn.fetch(
                """SELECT u.id,u.display_name
                     FROM account_users u
                     JOIN (
                       SELECT owner_id AS user_id FROM boards WHERE id=$1
                       UNION SELECT user_id FROM board_members WHERE board_id=$1
                     ) members ON members.user_id=u.id
                    ORDER BY lower(coalesce(nullif(trim(u.display_name),''),'Участник')),u.id""",
                board_id,
            )
        return [{"user_id": str(row["id"]),
                 "display_name": (row["display_name"] or "Участник").strip() or "Участник"}
                for row in rows]

    @router.post("/api/v1/boards/{board_id}/comments", status_code=201)
    async def create_comment(board_id: UUID, data: CreateCommentInput,
                             request: Request, user=Depends(current_user)):
        body = data.body.strip()
        if not body:
            raise HTTPException(422, "Комментарий пуст.")
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                await board_access(conn, board_id, user["id"])
                if data.parent_id is not None:
                    parent_exists = await conn.fetchval(
                        "SELECT EXISTS(SELECT 1 FROM board_comments WHERE id=$1 AND board_id=$2)",
                        data.parent_id, board_id,
                    )
                    if not parent_exists:
                        raise HTTPException(404, "Родительский комментарий не найден на этой доске.")
                author_name = (user["display_name"] or "Участник").strip() or "Участник"
                row = await conn.fetchrow(
                    """INSERT INTO board_comments(id,board_id,author_id,author_name,parent_id,body)
                       VALUES($1,$2,$3,$4,$5,$6)
                       RETURNING id,board_id,author_id,author_name,parent_id,body,
                                 resolved,created_at,updated_at""",
                    uuid4(), board_id, user["id"], author_name, data.parent_id, body,
                )
        return {
            "id": str(row["id"]), "board_id": str(row["board_id"]),
            "author_id": str(row["author_id"]), "author_name": row["author_name"],
            "parent_id": str(row["parent_id"]) if row["parent_id"] else None,
            "body": row["body"], "resolved": row["resolved"],
            "created_at": iso(row["created_at"]), "updated_at": iso(row["updated_at"]),
        }

    @router.patch("/api/v1/comments/{comment_id}")
    async def resolve_comment(comment_id: UUID, data: ResolveCommentInput,
                              request: Request, user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    "SELECT id,board_id,author_id FROM board_comments WHERE id=$1 FOR UPDATE",
                    comment_id,
                )
                if row is None:
                    raise HTTPException(404, "Комментарий не найден.")
                _, role = await board_access(conn, row["board_id"], user["id"])
                if row["author_id"] != user["id"] and role not in ("owner", "editor"):
                    raise HTTPException(403, "Недостаточно прав для изменения обсуждения.")
                updated = await conn.fetchrow(
                    """UPDATE board_comments SET resolved=$2,updated_at=now()
                       WHERE id=$1 RETURNING id,board_id,author_id,author_name,parent_id,
                                         body,resolved,created_at,updated_at""",
                    comment_id, data.resolved,
                )
        return {
            "id": str(updated["id"]), "board_id": str(updated["board_id"]),
            "author_id": str(updated["author_id"]), "author_name": updated["author_name"],
            "parent_id": str(updated["parent_id"]) if updated["parent_id"] else None,
            "body": updated["body"], "resolved": updated["resolved"],
            "created_at": iso(updated["created_at"]), "updated_at": iso(updated["updated_at"]),
        }

    return router
