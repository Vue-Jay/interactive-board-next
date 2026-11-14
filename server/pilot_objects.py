"""Atomic pilot-only object creation and smooth-drag commit endpoints.

The browser may preview a drag over WebSocket, but only this transactional
PostgreSQL endpoint determines a committed object position. Per-object
revision CAS prevents concurrent drags of the *same* object from silently
overwriting one another. Other objects move without global-version conflicts.
"""
from __future__ import annotations

import math
import re
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from pilot_operations import (
    MAX_PILOT_DOCUMENT_BYTES, digest, encode, pilot_doc,
)

MAX_PILOT_OBJECTS = 80
PILOT_BOUNDS = 1000
VALID_OBJECT_ID = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
VALID_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


class CreateObject(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation_id: UUID
    object_id: str = Field(min_length=1, max_length=128)
    kind: Literal["pilot_rect"]
    x: float
    y: float
    width: float
    height: float
    color: str


class MoveObject(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation_id: UUID
    expected_revision: int = Field(ge=1)
    x: float
    y: float


def bounded_number(value: float, *, low: float = 0, high: float = PILOT_BOUNDS) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and low <= value <= high


def valid_position(x: float, y: float, width: float, height: float) -> bool:
    return (bounded_number(x) and bounded_number(y) and
            bounded_number(width, low=30, high=450) and
            bounded_number(height, low=30, high=450) and
            x + width <= PILOT_BOUNDS and y + height <= PILOT_BOUNDS)


async def earlier_operation(conn, board_id: UUID, operation_id: UUID,
                            actor_id: UUID, kind: str, request_hash: str):
    row = await conn.fetchrow(
        """SELECT actor_id, operation_type, object_id, request_sha256,
                  object_revision, resulting_version
             FROM board_pilot_object_operations
            WHERE board_id=$1 AND operation_id=$2""", board_id, operation_id,
    )
    if row is None:
        return None
    if (row["actor_id"] != actor_id or row["operation_type"] != kind or
        row["request_sha256"] != request_hash):
        raise HTTPException(409, "Этот идентификатор операции уже занят.")
    return {
        "operation_id": str(operation_id), "object_id": row["object_id"],
        "object_revision": row["object_revision"],
        "version": row["resulting_version"], "duplicate": True,
    }


async def commit_object(conn, board_id: UUID, actor_id: UUID, doc: dict,
                        object_id: str, kind: str, request_hash: str,
                        operation_id: UUID, object_revision: int, delta: dict):
    serialized = encode(doc)
    if len(serialized.encode("utf-8")) > MAX_PILOT_DOCUMENT_BYTES:
        raise HTTPException(413, "Тестовый документ превышает 2 МБ.")
    row = await conn.fetchrow(
        """UPDATE board_documents
              SET document=$2::jsonb,version=version+1,
                  updated_by=$3,updated_at=now()
            WHERE board_id=$1
        RETURNING version""", board_id, serialized, actor_id,
    )
    version = row["version"]
    await conn.execute("UPDATE boards SET updated_at=now() WHERE id=$1", board_id)
    await conn.execute(
        """INSERT INTO board_pilot_object_operations
           (board_id,operation_id,actor_id,operation_type,object_id,
            request_sha256,object_revision,resulting_version,payload)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)""",
        board_id, operation_id, actor_id, kind, object_id,
        request_hash, object_revision, version, encode(delta),
    )
    return {
        "operation_id": str(operation_id), "object_id": object_id,
        "object_revision": object_revision, "version": version,
        "duplicate": False,
    }


def object_items(doc: dict) -> list[dict]:
    items = doc["items"]
    if len(items) > MAX_PILOT_OBJECTS:
        raise HTTPException(413, "Слишком много объектов на тестовой доске.")
    if any(not isinstance(item, dict) for item in items):
        raise HTTPException(409, "Документ содержит неизвестный формат объектов.")
    return items


def make_pilot_objects_router(current_user, board_access, announce) -> APIRouter:
    router = APIRouter()

    @router.post("/api/v1/boards/{board_id}/pilot/objects", status_code=201)
    async def create_pilot_object(
        board_id: UUID, data: CreateObject, request: Request,
        user=Depends(current_user),
    ):
        if (not VALID_OBJECT_ID.fullmatch(data.object_id) or
            not VALID_COLOR.fullmatch(data.color) or
            not valid_position(data.x, data.y, data.width, data.height)):
            raise HTTPException(422, "Неправильные размеры, цвет или координаты.")
        obj = {
            "id": data.object_id, "kind": data.kind, "x": data.x, "y": data.y,
            "width": data.width, "height": data.height, "color": data.color,
            "revision": 1, "created_by": str(user["id"]),
        }
        request_hash = digest({"type": "object_create", "object": obj})
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                board, role = await board_access(conn, board_id, user["id"], lock=True)
                if role not in ("owner", "editor"):
                    raise HTTPException(403, "Нет права добавлять объекты.")
                if not board["is_pilot"]:
                    raise HTTPException(409, "Обычную доску нельзя изменять через пилот.")
                old = await earlier_operation(
                    conn, board_id, data.operation_id, user["id"],
                    "object_create", request_hash,
                )
                if old:
                    return old
                row = await conn.fetchrow(
                    "SELECT document FROM board_documents WHERE board_id=$1 FOR UPDATE",
                    board_id,
                )
                doc, _ = pilot_doc(row)
                items = object_items(doc)
                if len(items) >= MAX_PILOT_OBJECTS:
                    raise HTTPException(413, "Достигнут лимит тестовых объектов.")
                if any(item.get("id") == data.object_id for item in items):
                    raise HTTPException(409, "Объект с таким ID уже существует.")
                doc["items"] = [*items, obj]
                result = await commit_object(
                    conn, board_id, user["id"], doc, data.object_id,
                    "object_create", request_hash, data.operation_id, 1, obj,
                )
        await announce(board_id, result["version"], request.app.state.pool)
        return result

    @router.post("/api/v1/boards/{board_id}/pilot/objects/{object_id}/move")
    async def move_pilot_object(
        board_id: UUID, object_id: str, data: MoveObject,
        request: Request, user=Depends(current_user),
    ):
        if not VALID_OBJECT_ID.fullmatch(object_id):
            raise HTTPException(422, "Неправильный ID объекта.")
        if not bounded_number(data.x) or not bounded_number(data.y):
            raise HTTPException(422, "Неправильные координаты.")
        request_hash = digest({
            "type": "object_move", "object_id": object_id,
            "expected_revision": data.expected_revision,
            "x": data.x, "y": data.y,
        })
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                board, role = await board_access(conn, board_id, user["id"], lock=True)
                if role not in ("owner", "editor"):
                    raise HTTPException(403, "Нет права перемещать объекты.")
                if not board["is_pilot"]:
                    raise HTTPException(409, "Обычную доску нельзя изменять через пилот.")
                old = await earlier_operation(
                    conn, board_id, data.operation_id, user["id"],
                    "object_move", request_hash,
                )
                if old:
                    return old
                row = await conn.fetchrow(
                    "SELECT document FROM board_documents WHERE board_id=$1 FOR UPDATE",
                    board_id,
                )
                doc, _ = pilot_doc(row)
                items = object_items(doc)
                found = next(
                    (item for item in items if item.get("id") == object_id), None,
                )
                if found is None or found.get("kind") != "pilot_rect":
                    raise HTTPException(404, "Объект не найден.")
                if (not isinstance(found.get("revision"), int) or
                    isinstance(found.get("revision"), bool) or
                    found["revision"] != data.expected_revision):
                    raise HTTPException(409, "Объект уже переместил другой участник.")
                if not valid_position(
                    data.x, data.y, found.get("width"), found.get("height"),
                ):
                    raise HTTPException(422, "Объект выходит за границы доски.")
                revision = found["revision"] + 1
                doc["items"] = [
                    {**item, "x": data.x, "y": data.y, "revision": revision}
                    if item is found else item for item in items
                ]
                result = await commit_object(
                    conn, board_id, user["id"], doc, object_id,
                    "object_move", request_hash, data.operation_id, revision,
                    {"object_id": object_id, "x": data.x, "y": data.y,
                     "expected_revision": data.expected_revision},
                )
        await announce(board_id, result["version"], request.app.state.pool)
        return result

    @router.get("/api/v1/boards/{board_id}/pilot/objects/history")
    async def pilot_object_history(
        board_id: UUID, request: Request, user=Depends(current_user),
    ):
        async with request.app.state.pool.acquire() as conn:
            board, _ = await board_access(conn, board_id, user["id"])
            if not board["is_pilot"]:
                raise HTTPException(409, "На обычной доске пилотный журнал недоступен.")
            rows = await conn.fetch(
                """SELECT operation_id, actor_id, operation_type, object_id,
                          object_revision, resulting_version, created_at
                   FROM board_pilot_object_operations WHERE board_id=$1
                   ORDER BY resulting_version DESC LIMIT 100""",
                board_id,
            )
        return [{
            "operation_id": str(row["operation_id"]),
            "actor_id": str(row["actor_id"]),
            "type": row["operation_type"], "object_id": row["object_id"],
            "object_revision": row["object_revision"],
            "version": row["resulting_version"],
            "created_at": row["created_at"].isoformat(),
        } for row in rows]

    return router
