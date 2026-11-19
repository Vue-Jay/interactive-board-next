"""Durable revision history: full checkpoints every ten revisions, deltas between."""
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from document_delta import apply_delta, encode, item_map

HISTORY_LIMIT = 100
CHECKPOINT_INTERVAL = 10


def decode(value):
    return json.loads(value) if isinstance(value, str) else value


async def ensure_baseline(conn, board_id, version):
    if version and not await conn.fetchval(
        "SELECT EXISTS(SELECT 1 FROM board_history WHERE board_id=$1 AND version=$2)", board_id, version
    ):
        # Existing boards start with their current durable revision, without
        # a migration that copies every existing document at once.
        await conn.execute("""INSERT INTO board_history(board_id,version,checkpoint,saved_at,saved_by,
                    saved_by_name,title,item_count,ink_count)
            SELECT d.board_id,d.version,doc.value,d.updated_at,d.updated_by,
                   COALESCE(u.display_name,'Участник'),COALESCE(doc.value->>'title','Доска'),
                   COALESCE(jsonb_array_length(doc.value->'items'),0),COALESCE(jsonb_array_length(doc.value->'ink'),0)
            FROM board_documents d LEFT JOIN account_users u ON u.id=d.updated_by
            CROSS JOIN LATERAL (SELECT lektrus_board_document(d) AS value) doc
            WHERE d.board_id=$1 AND d.version=$2 ON CONFLICT DO NOTHING""", board_id, version)


def counts(base, document, delta):
    try:
        old = item_map(base.get("items", [])) if base else {}
        new = item_map(document["items"])
    except ValueError:
        return 0, 0, 0
    changed_ids = ({i["id"] for i in delta.get("items", {}).get("upsert", [])}
                   if delta is not None else {key for key in old.keys() & new.keys() if old[key] != new[key]})
    return len(new.keys()-old.keys()), len(changed_ids & old.keys() & new.keys()), len(old.keys()-new.keys())


async def record_revision(conn, board_id, revision, user, base, document, delta):
    version = revision["version"]
    added, changed, removed = counts(base, document, delta)
    checkpoint = delta is None or version % CHECKPOINT_INTERVAL == 0
    # A periodic checkpoint is reconstructed from the already persisted
    # history, rather than rereading every unchanged live item from PostgreSQL.
    value = (document if delta is None else apply_delta(await load_history_document(conn,board_id,version-1),delta)) if checkpoint else None
    await conn.execute("""INSERT INTO board_history(board_id,version,checkpoint,delta,saved_at,saved_by,
        saved_by_name,title,item_count,ink_count,added_count,changed_count,removed_count)
        VALUES($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13)""",
        board_id, version, encode(value) if value is not None else None,
        None if checkpoint else encode(delta), revision["updated_at"], user["id"], user["display_name"],
        str(document.get("title") or "Доска")[:160], len(document["items"]), len(document.get("ink", [])),
        added, changed, removed)
    if version > HISTORY_LIMIT:
        await conn.execute("""DELETE FROM board_history WHERE board_id=$1 AND version < (
            SELECT max(version) FROM board_history WHERE board_id=$1 AND checkpoint IS NOT NULL AND version<=$2
        )""", board_id, version-HISTORY_LIMIT+1)


async def load_history_document(conn, board_id, version):
    rows = await conn.fetch("""SELECT version,checkpoint,delta FROM board_history
        WHERE board_id=$1 AND version BETWEEN (SELECT max(version) FROM board_history
             WHERE board_id=$1 AND version<=$2 AND checkpoint IS NOT NULL) AND $2 ORDER BY version""", board_id, version)
    if not rows or rows[-1]["version"] != version or rows[0]["checkpoint"] is None or len(rows)>CHECKPOINT_INTERVAL:
        raise HTTPException(404, "Версия не найдена.")
    document = decode(rows[0]["checkpoint"])
    for index, row in enumerate(rows[1:],1):
        if row["version"] != rows[0]["version"]+index or row["delta"] is None:
            raise HTTPException(404, "Версия не найдена.")
        document = apply_delta(document, decode(row["delta"]))
    return document


def make_history_router(current_user, board_access):
    router = APIRouter(prefix="/api/v1")

    @router.get("/boards/{board_id}/history")
    async def list_history(board_id: UUID, request: Request, limit: int = Query(30, ge=1, le=100),
                           user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn:
            await board_access(conn, board_id, user["id"])
            # A board which has not been edited since migration still shows
            # the current revision, without creating a history row on reads.
            rows = await conn.fetch("""WITH current AS (
                SELECT d.version,d.updated_at,d.updated_by,d.document_metadata,d.document,d.item_order
                FROM board_documents d WHERE board_id=$1
            ), revisions AS (
                SELECT version,saved_at,saved_by,saved_by_name,title,item_count,ink_count,
                       added_count,changed_count,removed_count FROM board_history WHERE board_id=$1
                UNION ALL
                SELECT d.version,d.updated_at,d.updated_by,COALESCE(u.display_name,'Участник'),
                    COALESCE(d.document_metadata->>'title',d.document->>'title','Доска'),
                    COALESCE(cardinality(d.item_order),jsonb_array_length(d.document->'items'),0),
                    COALESCE(jsonb_array_length(COALESCE(d.document_metadata,d.document)->'ink'),0),0,0,0
                FROM current d LEFT JOIN account_users u ON u.id=d.updated_by
                WHERE NOT EXISTS(SELECT 1 FROM board_history h WHERE h.board_id=$1 AND h.version=d.version)
            ) SELECT * FROM revisions WHERE version >= COALESCE((SELECT version FROM current),0)-99
              ORDER BY version DESC LIMIT $2""", board_id, limit)
        return [{**dict(row), "id": row["version"]} for row in rows]

    @router.get("/boards/{board_id}/history/{version}")
    async def get_version(board_id: UUID, version: int, request: Request, user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn, conn.transaction(isolation="repeatable_read", readonly=True):
            _, role = await board_access(conn, board_id, user["id"])
            if role != "owner" and not user["is_admin"] and not (
                role == "editor" and user["account_role"] == "teacher" and user["teacher_status"] == "approved"
                and await conn.fetchval("SELECT participant_role FROM board_members WHERE board_id=$1 AND user_id=$2",board_id,user["id"]) == "co_teacher"
            ):
                raise HTTPException(403, "Восстановление версии доступно преподавателю.")
            current = await conn.fetchval("SELECT version FROM board_documents WHERE board_id=$1", board_id)
            if current is None or not max(1,current-99) <= version <= current:
                raise HTTPException(404, "Версия не найдена.")
            if version == current:
                return decode(await conn.fetchval("SELECT lektrus_board_document(d) FROM board_documents d WHERE board_id=$1", board_id))
            return await load_history_document(conn,board_id,version)

    return router
