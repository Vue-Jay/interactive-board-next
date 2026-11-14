"""Server-authoritative Lektrus board invitations and membership management.

Mirrors existing owner/editor/viewer and email-invitation semantics without
relying on Supabase RPC or trusting the client-supplied user identity.
"""
from __future__ import annotations

import re
from typing import Literal
from uuid import UUID, uuid4

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MAX_INVITES_PER_BOARD = 200


class InviteInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    role: Literal["editor", "viewer"]


class RoleInput(BaseModel):
    role: Literal["editor", "viewer"]


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if not EMAIL_PATTERN.fullmatch(email) or len(email) > 254:
        raise HTTPException(422, "Введите корректный email.")
    return email


def owner_only(board, role: str) -> None:
    if role != "owner":
        # Existing board_access hides boards from outsiders; members receive 403.
        raise HTTPException(403, "Только владелец может управлять доступом к доске.")


def date(value):
    return value.isoformat() if value is not None else None


def make_invitation_router(current_user, board_access) -> APIRouter:
    router = APIRouter()

    @router.get("/api/v1/boards/{board_id}/access")
    async def board_access_list(
        board_id: UUID, request: Request, user=Depends(current_user)
    ):
        async with request.app.state.pool.acquire() as conn:
            board, role = await board_access(conn, board_id, user["id"])
            owner_only(board, role)
            members = await conn.fetch(
                """SELECT m.user_id,m.role,m.added_at,
                          a.display_name,a.email,a.created_at
                     FROM board_members m
                     JOIN account_users a ON a.id=m.user_id
                    WHERE m.board_id=$1 ORDER BY m.added_at,m.user_id""",
                board_id,
            )
            invites = await conn.fetch(
                """SELECT id,email,role,created_at FROM board_invites
                    WHERE board_id=$1 ORDER BY created_at,id""",
                board_id,
            )
        return {
            "members": [
                {
                    "user_id": str(row["user_id"]),
                    "role": row["role"],
                    "added_at": date(row["added_at"]),
                    "name": row["display_name"],
                    "email": row["email"],
                    "created_at": date(row["created_at"]),
                } for row in members
            ],
            "invites": [
                {
                    "id": str(row["id"]),
                    "board_id": str(board_id),
                    "email": row["email"],
                    "role": row["role"],
                    "created_at": date(row["created_at"]),
                } for row in invites
            ],
        }

    @router.post("/api/v1/boards/{board_id}/invitations")
    async def invite_member(
        board_id: UUID, data: InviteInput, request: Request,
        user=Depends(current_user),
    ):
        email = normalize_email(data.email)
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                board, role = await board_access(conn, board_id, user["id"], lock=True)
                owner_only(board, role)
                if email == user["email"]:
                    raise HTTPException(422, "Вы уже владелец этой доски.")
                target = await conn.fetchrow(
                    """SELECT id,email_confirmed_at FROM account_users
                        WHERE email=$1""", email
                )
                if target and target["id"] == user["id"]:
                    raise HTTPException(422, "Вы уже владелец этой доски.")
                # Confirmed existing accounts are directly added, as in Lektrus.
                # An unconfirmed account cannot access boards until it verifies
                # its mailbox, so keep the invite for later claiming.
                if target and target["email_confirmed_at"] is not None:
                    await conn.execute(
                        """INSERT INTO board_members(board_id,user_id,role)
                           VALUES($1,$2,$3)
                           ON CONFLICT(board_id,user_id) DO UPDATE SET role=excluded.role""",
                        board_id, target["id"], data.role,
                    )
                    await conn.execute(
                        "DELETE FROM board_invites WHERE board_id=$1 AND email=$2",
                        board_id, email,
                    )
                    kind = "member"
                else:
                    # Rate/size cap applies only to new invitations. Replacing a
                    # pending invitation for the same email remains possible.
                    count = await conn.fetchval(
                        "SELECT count(*) FROM board_invites WHERE board_id=$1",
                        board_id,
                    )
                    existing = await conn.fetchval(
                        """SELECT id FROM board_invites
                            WHERE board_id=$1 AND email=$2""",
                        board_id, email
                    )
                    if existing is None and count >= MAX_INVITES_PER_BOARD:
                        raise HTTPException(429, "Слишком много ожидающих приглашений.")
                    await conn.execute(
                        """INSERT INTO board_invites(id,board_id,email,role)
                           VALUES($1,$2,$3,$4)
                           ON CONFLICT(board_id,email) DO UPDATE SET role=excluded.role""",
                        uuid4(), board_id, email, data.role,
                    )
                    kind = "invite"
        return {"kind": kind}

    @router.patch("/api/v1/boards/{board_id}/members/{member_id}")
    async def change_member_role(
        board_id: UUID, member_id: UUID, data: RoleInput,
        request: Request, user=Depends(current_user),
    ):
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                board, role = await board_access(conn, board_id, user["id"], lock=True)
                owner_only(board, role)
                updated = await conn.fetchval(
                    """UPDATE board_members SET role=$3
                        WHERE board_id=$1 AND user_id=$2 RETURNING user_id""",
                    board_id, member_id, data.role,
                )
                if updated is None:
                    raise HTTPException(404, "Участник не найден.")
        return {"ok": True, "role": data.role}

    @router.delete("/api/v1/boards/{board_id}/members/{member_id}", status_code=204)
    async def remove_member(
        board_id: UUID, member_id: UUID, request: Request,
        user=Depends(current_user),
    ):
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                board, role = await board_access(conn, board_id, user["id"], lock=True)
                owner_only(board, role)
                await conn.execute(
                    "DELETE FROM board_members WHERE board_id=$1 AND user_id=$2",
                    board_id, member_id,
                )
        return Response(status_code=204)

    @router.delete("/api/v1/boards/{board_id}/invitations/{invite_id}",
                   status_code=204)
    async def revoke_invitation(
        board_id: UUID, invite_id: UUID, request: Request,
        user=Depends(current_user),
    ):
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                board, role = await board_access(conn, board_id, user["id"], lock=True)
                owner_only(board, role)
                await conn.execute(
                    "DELETE FROM board_invites WHERE board_id=$1 AND id=$2",
                    board_id, invite_id,
                )
        return Response(status_code=204)

    @router.post("/api/v1/invitations/claim")
    async def claim_invitations(request: Request, user=Depends(current_user)):
        # Account email is verified by current_user's active DB session.
        # Identity is read from the DB, never from a request payload or JWT
        # user_metadata. Claiming does not promote anyone to board owner.
        user_id = user["id"]
        email = user["email"].lower()
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                # Always lock the board before its invite row. Owners change
                # invitations under the same lock order, avoiding deadlocks.
                invited = await conn.fetch(
                    """SELECT id,board_id FROM board_invites WHERE email=$1
                        ORDER BY board_id,id""",
                    email,
                )
                claimed = 0
                for invite in invited:
                    board = await conn.fetchrow(
                        """SELECT id FROM boards
                            WHERE id=$1 AND deleted_at IS NULL FOR UPDATE""",
                        invite["board_id"],
                    )
                    current = await conn.fetchrow(
                        """SELECT id,role FROM board_invites WHERE id=$1 AND email=$2
                            FOR UPDATE""",
                        invite["id"], email,
                    )
                    if current is None:
                        continue
                    if board:
                        await conn.execute(
                            """INSERT INTO board_members(board_id,user_id,role)
                               VALUES($1,$2,$3)
                               ON CONFLICT(board_id,user_id) DO UPDATE
                               SET role=excluded.role""",
                            invite["board_id"], user_id, current["role"],
                        )
                        claimed += 1
                    await conn.execute(
                        "DELETE FROM board_invites WHERE id=$1", current["id"]
                    )
        return {"claimed": claimed}

    return router
