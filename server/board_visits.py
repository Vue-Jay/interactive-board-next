"""Board visit history, with bounded heartbeat writes and stale-session expiry."""
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel


class VisitInput(BaseModel):
    visit_id: UUID
    action: Literal["ping", "leave"]


VISIT_VIEW = """v.visit_id,v.board_id,v.user_id,v.user_name,b.title AS board_title,v.started_at,
    CASE WHEN v.left_at IS NOT NULL THEN v.left_at
         WHEN v.last_seen<now()-interval '120 seconds' THEN v.last_seen ELSE NULL END AS left_at,
    GREATEST(0,EXTRACT(epoch FROM (COALESCE(v.left_at,v.last_seen)-v.started_at)))::integer AS duration_seconds,
    v.left_at IS NULL AND v.last_seen>=now()-interval '120 seconds' AS active"""


def make_visit_router(current_user, board_access):
    router = APIRouter(prefix="/api/v1")

    @router.post("/boards/{board_id}/visits")
    async def track(board_id: UUID, data: VisitInput, request: Request, user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn, conn.transaction():
            await board_access(conn, board_id, user["id"])
            if data.action == "leave":
                await conn.execute("""UPDATE board_visits SET left_at=LEAST(now(),last_seen+interval '120 seconds')
                    WHERE board_id=$1 AND user_id=$2 AND visit_id=$3 AND left_at IS NULL""",
                    board_id,user["id"],data.visit_id)
            else:
                # An existing pulse is cheap and does not reopen a completed visit.
                updated = await conn.execute("""UPDATE board_visits SET last_seen=now()
                    WHERE board_id=$1 AND user_id=$2 AND visit_id=$3 AND left_at IS NULL
                    AND last_seen BETWEEN now()-interval '120 seconds' AND now()-interval '20 seconds'""",board_id,user["id"],data.visit_id)
                if updated == "UPDATE 0":
                    inserted = await conn.fetchval("""INSERT INTO board_visits(board_id,user_id,visit_id,user_name)
                        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING visit_id""",
                        board_id,user["id"],data.visit_id,user["display_name"])
                    if inserted:
                        await conn.execute("""DELETE FROM board_visits WHERE board_id=$1 AND started_at <
                            (SELECT started_at FROM board_visits WHERE board_id=$1 ORDER BY started_at DESC OFFSET 1499 LIMIT 1)""",board_id)
                    else:
                        expired = await conn.fetchval("""SELECT left_at IS NOT NULL OR last_seen<now()-interval '120 seconds'
                            FROM board_visits WHERE board_id=$1 AND user_id=$2 AND visit_id=$3""",board_id,user["id"],data.visit_id)
                        if expired:
                            return {"ok": True, "expired": True}
        return {"ok": True}

    @router.get("/boards/{board_id}/visits")
    async def list_visits(board_id: UUID, request: Request, student_id: UUID | None = None, user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn:
            _, role = await board_access(conn, board_id, user["id"])
            if role != "owner" and not user["is_admin"]:
                raise HTTPException(403, "История посещений доступна владельцу доски.")
            rows = await conn.fetch(f"""SELECT {VISIT_VIEW} FROM board_visits v JOIN boards b ON b.id=v.board_id
                WHERE v.board_id=$1 AND ($2::uuid IS NULL OR v.user_id=$2)
                ORDER BY v.started_at DESC LIMIT 150""",board_id,student_id)
        return [dict(row) for row in rows]

    @router.get("/students/{student_id}/visits")
    async def list_student_visits(student_id: UUID, request: Request, user=Depends(current_user)):
        if not user["is_admin"] and not (user["account_role"]=="teacher" and user["teacher_status"]=="approved"):
            raise HTTPException(403, "История посещений доступна преподавателю.")
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(f"""SELECT {VISIT_VIEW} FROM board_visits v JOIN boards b ON b.id=v.board_id
                WHERE v.user_id=$1 AND b.deleted_at IS NULL AND (b.owner_id=$2 OR $3)
                ORDER BY v.started_at DESC LIMIT 100""",student_id,user["id"],user["is_admin"])
        return [dict(row) for row in rows]

    return router
