"""Durable attachment decisions. Call mutations under the board row lock.

Only metadata is stored here; binary assets and authoritative board content
remain in their existing stores. A rejection and a document insertion cannot
both win: both transactions serialize on the same board lock.
"""
import json
import time
from uuid import UUID

from fastapi import HTTPException


def unpack(value):
    return json.loads(value) if isinstance(value, str) else value


def can_decide(role, participant):
    return role in ("owner", "editor") and participant not in ("student", "observer")


async def register_request(conn, board_id, actor_id, event):
    previous = await conn.fetchrow(
        "SELECT * FROM board_attachment_approvals WHERE board_id=$1 AND request_id=$2",
        board_id, event["request_id"],
    )
    if previous:
        if previous["student_id"] != actor_id or previous["asset_id"] != event["asset_id"]:
            raise HTTPException(409, "attachment_request_identity_conflict")
        return unpack(previous["result_event"] or previous["request_event"])
    asset = await conn.fetchrow(
        "SELECT created_by,content_type FROM board_assets WHERE board_id=$1 AND asset_id=$2",
        board_id, event["asset_id"],
    )
    if not asset or asset["created_by"] != actor_id:
        raise HTTPException(403, "attachment_asset_not_owned")
    mime = asset["content_type"]
    if not ((event["kind"] == "image" and mime.startswith("image/")) or
            (event["kind"] == "pdf" and mime == "application/pdf")):
        raise HTTPException(422, "attachment_kind_mismatch")
    durable = {**event, "mime": mime, "durable": True}
    inserted = await conn.fetchval(
        """INSERT INTO board_attachment_approvals(board_id,request_id,student_id,asset_id,request_event)
           VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING RETURNING request_id""",
        board_id, event["request_id"], actor_id, event["asset_id"], json.dumps(durable),
    )
    if inserted is None:
        raise HTTPException(409, "attachment_asset_already_requested")
    return durable


async def get_request(conn, board_id, request_id):
    row = await conn.fetchrow(
        "SELECT * FROM board_attachment_approvals WHERE board_id=$1 AND request_id=$2",
        board_id, request_id,
    )
    if row is None:
        raise HTTPException(404, "attachment_request_not_found")
    return row


async def resolve(conn, row, actor, role, approved):
    if row["approved"] is not None:
        return unpack(row["result_event"])
    request = unpack(row["request_event"])
    event = {
        "type": "attachment_result", "durable": True,
        "request_id": row["request_id"], "target_user_id": str(row["student_id"]),
        "user_id": str(actor["id"]), "name": str(actor["display_name"] or "Участник")[:100],
        "role": role, "attachment_name": request["attachment_name"], "approved": approved,
        "sent_at": int(time.time() * 1000),
    }
    await conn.execute(
        """UPDATE board_attachment_approvals SET approved=$3,result_event=$4::jsonb,resolved_at=now()
           WHERE board_id=$1 AND request_id=$2""",
        row["board_id"], row["request_id"], approved, json.dumps(event),
    )
    return event


async def approve_new_media(conn, board_id, actor, role, restricted, base, document, delta):
    # Fast normalized saves provide ID-only base items. Inspect only newly
    # introduced media; ordinary ink checkpoints do not perform extra SQL.
    original_ids = {i.get("id") for i in (base or {}).get("items", []) if isinstance(i, dict)}
    candidates = (delta.get("items", {}).get("upsert", []) if delta is not None else document.get("items", []))
    media = [i for i in candidates if isinstance(i, dict) and i.get("kind") in ("image", "pdf")
             and isinstance(i.get("assetId"), str) and isinstance(i.get("id"), str)
             and i["id"] not in original_ids]
    if not media:
        return []
    prefix = "approved-media-"
    rows = await conn.fetch(
        """SELECT * FROM board_attachment_approvals WHERE board_id=$1
           AND (asset_id=ANY($2::text[]) OR request_id=ANY($3::text[]))""",
        board_id, [i["assetId"] for i in media],
        [i["id"][len(prefix):] for i in media if i["id"].startswith(prefix)],
    )
    by_asset = {row["asset_id"]: row for row in rows}
    by_request = {row["request_id"]: row for row in rows}
    results, resolved = [], set()
    for item in media:
        identified = by_request.get(item["id"][len(prefix):]) if item["id"].startswith(prefix) else None
        row = by_asset.get(item["assetId"])
        if identified and identified["asset_id"] != item["assetId"]:
            raise HTTPException(409, "attachment_request_identity_conflict")
        if row is None:
            continue  # normal uploads and older imported documents
        if row["approved"] is False:
            raise HTTPException(409, "attachment_rejected")
        if row["approved"] is True:
            continue  # intentional duplication or undo after approval
        if restricted or not can_decide(role, None):
            raise HTTPException(403, "attachment_requires_teacher")
        if row["request_id"] in resolved:
            raise HTTPException(409, "attachment_duplicate_approval")
        request = unpack(row["request_event"])
        if item["kind"] != request["kind"]:
            raise HTTPException(422, "attachment_kind_mismatch")
        results.append(await resolve(conn, row, actor, role, True))
        resolved.add(row["request_id"])
    return results


async def list_requests(conn, board_id, actor_id, teacher):
    rows = await conn.fetch(
        """SELECT request_event,result_event FROM board_attachment_approvals
           WHERE board_id=$1 AND ($2::boolean OR student_id=$3)
           ORDER BY (approved IS NOT NULL), created_at DESC LIMIT 200""",
        board_id, teacher, actor_id,
    )
    return {
        "requests": [unpack(row["request_event"]) for row in rows if row["result_event"] is None],
        "results": [unpack(row["result_event"]) for row in rows if row["result_event"] is not None],
    }
