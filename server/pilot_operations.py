"""Atomic, idempotent, pilot-only stroke persistence.

This is deliberately NOT an editor for the imported full Lektrus JSON schema.
Each stroke is applied against the authoritative PostgreSQL document under a
per-board row lock; a second writer never overwrites an earlier stroke.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any, Literal
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from realtime_events import InvalidLiveEvent, validate_live_event

MAX_PILOT_STROKES = 500
MAX_PILOT_DOCUMENT_BYTES = 2_000_000


class AppendStroke(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation_id: UUID
    client_id: str = Field(min_length=1, max_length=96)
    stroke_id: str = Field(min_length=1, max_length=128)
    kind: Literal["pen", "marker"]
    color: str
    weight: float
    points: list[dict[str, Any]] = Field(min_length=1, max_length=200)


class UndoStroke(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation_id: UUID


def encode(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value: Any) -> str:
    return hashlib.sha256(encode(value).encode("utf-8")).hexdigest()


def pilot_doc(row: asyncpg.Record | None) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if row is None:
        raise HTTPException(409, "Сначала создайте тестовый документ доски.")
    doc = row["document"]
    if isinstance(doc, str):
        doc = json.loads(doc)
    if (not isinstance(doc, dict) or doc.get("pilot_schema") != 1 or
        not isinstance(doc.get("ink"), list) or
        not isinstance(doc.get("items"), list) or
        not isinstance(doc.get("note"), str)):
        raise HTTPException(409, "Обычные доски Lektrus нельзя изменять через пилотный API.")
    return doc, doc["ink"]


async def previous_operation(conn: asyncpg.Connection, board_id: UUID,
                             operation_id: UUID, actor_id: UUID,
                             request_hash: str, kind: str) -> dict[str, Any] | None:
    row = await conn.fetchrow(
        """SELECT actor_id,request_sha256,operation_type,stroke_id,
                  resulting_version FROM board_pilot_operations
           WHERE board_id=$1 AND operation_id=$2""",
        board_id, operation_id,
    )
    if row is None:
        return None
    if (row["actor_id"] != actor_id or row["request_sha256"] != request_hash or
        row["operation_type"] != kind):
        raise HTTPException(409, "Идентификатор операции уже используется с другими данными.")
    return {
        "operation_id": str(operation_id),
        "stroke_id": row["stroke_id"],
        "version": row["resulting_version"],
        "duplicate": True,
    }


def make_pilot_operations_router(current_user, board_access,
                                 announce) -> APIRouter:
    router = APIRouter()

    @router.post("/api/v1/boards/{board_id}/pilot/ink", status_code=201)
    async def append_pilot_ink(
        board_id: UUID, payload: AppendStroke, request: Request,
        user=Depends(current_user),
    ):
        frame = {
            "type": "live_ink", "client_id": payload.client_id,
            "stroke_id": payload.stroke_id, "kind": payload.kind,
            "color": payload.color, "weight": payload.weight,
            "offset": 0, "points": payload.points, "finished": True,
        }
        try:
            # Same validation as the real-time channel, including coordinates.
            checked = validate_live_event(
                frame, role="editor", user_id=str(user["id"]),
                name=str(user["display_name"]),
            )
        except InvalidLiveEvent as exc:
            raise HTTPException(422, str(exc)) from None
        stroke = {
            "id": checked["stroke_id"], "client_id": checked["client_id"],
            "created_by": str(user["id"]), "kind": checked["kind"],
            "color": checked["color"], "weight": checked["weight"],
            "points": checked["points"],
        }
        request_hash = digest({"kind": "ink_append", "stroke": stroke})
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                _, role = await board_access(conn, board_id, user["id"], lock=True)
                if role not in ("owner", "editor"):
                    raise HTTPException(403, "Недостаточно прав для рисования.")
                previous = await previous_operation(
                    conn, board_id, payload.operation_id, user["id"],
                    request_hash, "ink_append",
                )
                if previous is not None:
                    return previous
                row = await conn.fetchrow(
                    "SELECT document,version FROM board_documents WHERE board_id=$1 FOR UPDATE",
                    board_id,
                )
                doc, strokes = pilot_doc(row)
                if len(strokes) >= MAX_PILOT_STROKES:
                    raise HTTPException(413, "На тестовой доске слишком много штрихов.")
                if any(not isinstance(item, dict) or
                       item.get("id") == stroke["id"] for item in strokes):
                    raise HTTPException(409, "Такой штрих уже есть на доске.")
                # A document is assembled server-side, never replaced from a
                # potentially stale client-side JSON snapshot.
                doc["ink"] = [*strokes, stroke]
                encoded = encode(doc)
                if len(encoded.encode("utf-8")) > MAX_PILOT_DOCUMENT_BYTES:
                    raise HTTPException(413, "Документ доски превышает ограничение 2 МБ.")
                version = row["version"] + 1
                await conn.execute(
                    """UPDATE board_documents
                       SET document=$2::jsonb,version=$3,
                           updated_by=$4,updated_at=now()
                       WHERE board_id=$1""",
                    board_id, encoded, version, user["id"],
                )
                await conn.execute(
                    "UPDATE boards SET updated_at=now() WHERE id=$1",
                    board_id,
                )
                await conn.execute(
                    """INSERT INTO board_pilot_operations
                       (board_id,operation_id,actor_id,operation_type,stroke_id,
                        request_sha256,resulting_version,payload)
                       VALUES($1,$2,$3,'ink_append',$4,$5,$6,$7::jsonb)""",
                    board_id, payload.operation_id, user["id"],
                    stroke["id"], request_hash, version, encode(stroke),
                )
        await announce(board_id, version, request.app.state.pool)
        return {
            "operation_id": str(payload.operation_id),
            "stroke_id": stroke["id"], "version": version,
            "duplicate": False,
        }

    @router.post("/api/v1/boards/{board_id}/pilot/ink/undo")
    async def undo_pilot_ink(
        board_id: UUID, payload: UndoStroke, request: Request,
        user=Depends(current_user),
    ):
        request_hash = digest({"kind": "ink_undo", "actor": str(user["id"])})
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                _, role = await board_access(conn, board_id, user["id"], lock=True)
                if role not in ("owner", "editor"):
                    raise HTTPException(403, "Недостаточно прав для отмены.")
                previous = await previous_operation(
                    conn, board_id, payload.operation_id, user["id"],
                    request_hash, "ink_undo",
                )
                if previous is not None:
                    return previous
                row = await conn.fetchrow(
                    "SELECT document,version FROM board_documents WHERE board_id=$1 FOR UPDATE",
                    board_id,
                )
                doc, strokes = pilot_doc(row)
                # Undo only the caller's last stroke. Editing another person's
                # history is never allowed, including for an owner in this pilot.
                index = next(
                    (i for i in range(len(strokes)-1, -1, -1)
                     if isinstance(strokes[i], dict) and
                     strokes[i].get("created_by") == str(user["id"])), None,
                )
                if index is None:
                    raise HTTPException(409, "Нет своих штрихов для отмены.")
                removed = strokes[index]
                doc["ink"] = strokes[:index] + strokes[index+1:]
                version = row["version"] + 1
                await conn.execute(
                    """UPDATE board_documents
                       SET document=$2::jsonb,version=$3,
                           updated_by=$4,updated_at=now() WHERE board_id=$1""",
                    board_id, encode(doc), version, user["id"],
                )
                await conn.execute(
                    "UPDATE boards SET updated_at=now() WHERE id=$1", board_id,
                )
                await conn.execute(
                    """INSERT INTO board_pilot_operations
                       (board_id,operation_id,actor_id,operation_type,stroke_id,
                        request_sha256,resulting_version,payload)
                       VALUES($1,$2,$3,'ink_undo',$4,$5,$6,$7::jsonb)""",
                    board_id, payload.operation_id, user["id"],
                    removed["id"], request_hash, version,
                    encode({"removed": removed}),
                )
        await announce(board_id, version, request.app.state.pool)
        return {
            "operation_id": str(payload.operation_id),
            "stroke_id": removed["id"], "version": version,
            "duplicate": False,
        }

    @router.get("/api/v1/boards/{board_id}/pilot/history")
    async def pilot_history(
        board_id: UUID, request: Request, user=Depends(current_user)
    ):
        async with request.app.state.pool.acquire() as conn:
            await board_access(conn, board_id, user["id"])
            row = await conn.fetchrow(
                "SELECT document FROM board_documents WHERE board_id=$1", board_id,
            )
            pilot_doc(row)
            rows = await conn.fetch(
                """SELECT operation_id,actor_id,operation_type,stroke_id,
                          resulting_version,created_at
                   FROM board_pilot_operations WHERE board_id=$1
                   ORDER BY resulting_version DESC LIMIT 100""",
                board_id,
            )
        return [
            {
                "operation_id": str(event["operation_id"]),
                "actor_id": str(event["actor_id"]),
                "type": event["operation_type"],
                "stroke_id": event["stroke_id"],
                "version": event["resulting_version"],
                "created_at": event["created_at"].isoformat(),
            }
            for event in rows
        ]

    return router
