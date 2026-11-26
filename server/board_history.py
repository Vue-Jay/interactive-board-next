"""Durable revision history: full checkpoints every ten revisions, deltas between."""
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from document_delta import apply_delta, encode, item_map

HISTORY_LIMIT = 100
FREE_HISTORY_LIMIT = 25
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


async def ink_history_group(conn, board_id, user, base, document, delta, gesture):
    """Group validated incremental drawing and eraser updates as one gesture."""
    if not gesture or not 1 <= len(gesture) <= 128:
        return None
    if base is None:
        items = document.get("items", [])
        if len(items)==1 and items[0].get("id")==gesture and items[0].get("kind") in ("pen","marker") and items[0].get("createdBy")==str(user["id"]):
            return str(user["id"])+":"+gesture
        return None
    try:
        old = item_map(base["items"])
        new = item_map(document["items"])
        # A continuously swept eraser can remove several strokes or replace
        # them with fragments. Group only changes confined to ink, never
        # ordinary object properties or unrelated document metadata.
        if gesture.startswith("erase:"):
            UUID(gesture[6:])
            if delta is not None:
                if set(delta.get("set", {})) - {"view", "preview"} or delta.get("remove"):
                    return None
                changes = delta.get("items", {})
                upserts = changes.get("upsert", [])
                removed = set(changes.get("remove", []))
            else:
                if {k:v for k,v in base.items() if k not in ("items","view","preview")} != {k:v for k,v in document.items() if k not in ("items","view","preview")}:
                    return None
                upserts = [v for k,v in new.items() if old.get(k)!=v]
                removed = old.keys()-new.keys()
            if not removed and not upserts:
                return None
            affected = removed | {item["id"] for item in upserts}
            # Preserve the relative order of all unaffected ordinary objects.
            if [k for k in old if k not in affected] != [k for k in new if k not in affected]:
                return None
            async def prior(key):
                value = old.get(key)
                if value == {"id":key}:
                    value = decode(await conn.fetchval("SELECT item FROM board_document_items WHERE board_id=$1 AND item_id=$2",board_id,key))
                return value
            sources = []
            for key in removed:
                previous = await prior(key)
                if not previous or previous.get("kind") not in ("pen","marker"):
                    return None
                sources.append(previous)
            for item in upserts:
                previous = await prior(item["id"])
                if item.get("kind") in ("pen","marker"):
                    # Fragments inherit author, color and width of removed ink.
                    if previous is not None or not any(all(item.get(k)==source.get(k) for k in ("kind","createdBy","color","weight")) for source in sources):
                        return None
                elif item.get("kind")=="sticky" and previous is not None:
                    if {k:v for k,v in previous.items() if k!="stickerInk"} != {k:v for k,v in item.items() if k!="stickerInk"}:
                        return None
                else:
                    return None
            return str(user["id"])+":"+gesture
        if delta is not None:
            if set(delta.get("set", {})) - {"view", "preview"} or delta.get("remove"):
                return None
            changes = delta.get("items", {})
            upserts = changes.get("upsert", [])
            if changes.get("remove") or len(upserts) != 1:
                return None
            item = upserts[0]
        else:
            if {k:v for k,v in base.items() if k not in ("items","view","preview")} != {k:v for k,v in document.items() if k not in ("items","view","preview")}:
                return None
            changed = [v for k,v in new.items() if old.get(k)!=v]
            if len(changed)!=1 or old.keys()-new.keys():
                return None
            item = changed[0]
        key = item["id"]
        if list(new) != list(old) + ([key] if key not in old else []):
            return None
        previous = old.get(key)
        if previous == {"id":key}:
            previous = decode(await conn.fetchval("SELECT item FROM board_document_items WHERE board_id=$1 AND item_id=$2",board_id,key))
        if item.get("kind") in ("pen","marker") and key==gesture and item.get("createdBy")==str(user["id"]):
            if previous is not None:
                geometry={"x","y","width","height","points"}
                if {k:v for k,v in previous.items() if k not in geometry}!={k:v for k,v in item.items() if k not in geometry}:
                    return None
        elif item.get("kind")=="sticky" and previous is not None:
            if {k:v for k,v in previous.items() if k!="stickerInk"}!={k:v for k,v in item.items() if k!="stickerInk"}:
                return None
            a=item_map(previous.get("stickerInk",[]))
            b=item_map(item.get("stickerInk",[]))
            if list(b)!=list(a)+([gesture] if gesture not in a else []) or gesture not in b:
                return None
            if any(a[k]!=v for k,v in b.items() if k!=gesture):
                return None
        else:
            return None
        return str(user["id"])+":"+gesture
    except (KeyError,TypeError,ValueError,AttributeError):
        return None


async def retained_history_versions(conn,board_id,limit):
    return await conn.fetchval("""SELECT min(version) FROM (
        SELECT max(version) AS version FROM board_history WHERE board_id=$1
        GROUP BY COALESCE(ink_gesture,'revision:'||version::text)
        ORDER BY max(version) DESC LIMIT $2
    ) recent""",board_id,limit)


async def record_revision(conn, board_id, revision, user, base, document, delta, ink_gesture=None):
    version = revision["version"]
    added, changed, removed = counts(base, document, delta)
    checkpoint = delta is None or version % CHECKPOINT_INTERVAL == 0
    # A periodic checkpoint is reconstructed from the already persisted
    # history, rather than rereading every unchanged live item from PostgreSQL.
    value = (document if delta is None else apply_delta(await load_history_document(conn,board_id,version-1),delta)) if checkpoint else None
    await conn.execute("""INSERT INTO board_history(board_id,version,checkpoint,delta,saved_at,saved_by,
        saved_by_name,title,item_count,ink_count,added_count,changed_count,removed_count,ink_gesture)
        VALUES($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)""",
        board_id, version, encode(value) if value is not None else None,
        None if checkpoint else encode(delta), revision["updated_at"], user["id"], user["display_name"],
        str(document.get("title") or "Доска")[:160], len(document["items"]), len(document.get("ink", [])),
        added, changed, removed, ink_gesture)
    limit = await conn.fetchval("SELECT CASE WHEN billing_unlimited(owner_id) THEN $2::int ELSE $3::int END FROM boards WHERE id=$1",board_id,HISTORY_LIMIT,FREE_HISTORY_LIMIT)
    # Keep the restore chain for each displayed version; intermediate ink
    # checkpoints are not independent user actions and must not consume quota.
    # Compact at every full checkpoint, and after an ordinary operation.
    if version > limit and (ink_gesture is None or version % CHECKPOINT_INTERVAL == 0):
        await conn.execute("""WITH retained AS (
            SELECT max(version) AS target FROM board_history WHERE board_id=$1
            GROUP BY COALESCE(ink_gesture,'revision:'||version::text)
            ORDER BY max(version) DESC LIMIT $2
        ), spans AS (
            SELECT target,(SELECT max(version) FROM board_history
                WHERE board_id=$1 AND checkpoint IS NOT NULL AND version<=target) AS start
            FROM retained
        )
        DELETE FROM board_history h WHERE h.board_id=$1
          AND NOT EXISTS(SELECT 1 FROM spans WHERE h.version BETWEEN start AND target)
        """,board_id,limit)


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
                       added_count,changed_count,removed_count,ink_gesture FROM board_history WHERE board_id=$1
                UNION ALL
                SELECT d.version,d.updated_at,d.updated_by,COALESCE(u.display_name,'Участник'),
                    COALESCE(d.document_metadata->>'title',d.document->>'title','Доска'),
                    COALESCE(cardinality(d.item_order),jsonb_array_length(d.document->'items'),0),
                    COALESCE(jsonb_array_length(COALESCE(d.document_metadata,d.document)->'ink'),0),0,0,0,NULL
                FROM current d LEFT JOIN account_users u ON u.id=d.updated_by
                WHERE NOT EXISTS(SELECT 1 FROM board_history h WHERE h.board_id=$1 AND h.version=d.version)
            ), grouped AS (
              SELECT *,row_number() OVER(PARTITION BY COALESCE(ink_gesture,'revision:'||version::text) ORDER BY version DESC) AS position
              FROM revisions
            ) SELECT version,saved_at,saved_by,saved_by_name,title,item_count,ink_count,
                     added_count,changed_count,removed_count FROM grouped WHERE position=1
              ORDER BY version DESC LIMIT LEAST($2,CASE WHEN billing_unlimited((SELECT owner_id FROM boards WHERE id=$1)) THEN 100 ELSE 25 END)""", board_id, limit)
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
            if current is None or not 1 <= version <= current:
                raise HTTPException(404, "Версия не найдена.")
            if version == current:
                return decode(await conn.fetchval("SELECT lektrus_board_document(d) FROM board_documents d WHERE board_id=$1", board_id))
            unlimited = await conn.fetchval("SELECT billing_unlimited(owner_id) FROM boards WHERE id=$1",board_id)
            first = await retained_history_versions(conn,board_id,HISTORY_LIMIT if unlimited else FREE_HISTORY_LIMIT)
            if first is None or version < first:
                if not unlimited and version >= max(1,current-HISTORY_LIMIT+1):
                    from billing import limit_detail
                    raise HTTPException(409, limit_detail("history"))
                raise HTTPException(404, "Версия не найдена.")
            return await load_history_document(conn,board_id,version)

    return router
