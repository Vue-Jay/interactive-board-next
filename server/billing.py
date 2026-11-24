"""Authoritative subscription and quota information; no checkout."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from uuid import UUID

MESSAGES = {
    "history": "В Free доступны 25 последних версий истории изменений.",
    "boards": "В Free доступно до 5 собственных досок. Освободите место или управляйте активными досками в тарифах.",
    "readonly": "Эта доска доступна только для просмотра. Выберите её среди активных досок в разделе «Тарифы».",
    "students": "В Free можно добавить до 5 учеников в свою базу.",
    "groups": "В Free доступна одна группа или класс.",
    "templates": "В Free доступно до 3 личных шаблонов.",
    "storage_pro": "Хранилище Pro заполнено: доступно 5 ГБ. Удалите ненужные файлы.",
    "storage": "Хранилище Free заполнено: доступно 250 МБ. Удалите ненужные файлы.",
    "file": "В Free размер одного файла не должен превышать 25 МБ.",
    "participants": "На доске Free одновременно могут работать 6 участников, включая владельца.",
}

def limit_detail(resource):
    return {"code": "plan_limit", "resource": resource, "message": MESSAGES[resource]}

FREE_STORAGE_BYTES = 250 * 1024**2
PRO_STORAGE_BYTES = 5 * 1024**3

# Same ownership and categories as billing_storage() and its enforcement
# triggers, including assets retained on deleted/archived boards.
STORAGE_BY_OWNER = """
WITH assets AS (
    SELECT b.owner_id, sum(a.size_bytes)::bigint AS bytes
    FROM board_assets a JOIN boards b ON b.id=a.board_id
    WHERE ($1::uuid IS NULL OR b.owner_id=$1) GROUP BY b.owner_id
), materials AS (
    SELECT owner_id, sum(size_bytes)::bigint AS bytes FROM learning_materials
    WHERE ($1::uuid IS NULL OR owner_id=$1) GROUP BY owner_id
), templates AS (
    SELECT owner_id, sum(billing_template_bytes(assets))::bigint AS bytes FROM board_templates
    WHERE ($1::uuid IS NULL OR owner_id=$1) GROUP BY owner_id
), usage AS (
    SELECT u.id, u.display_name, u.email, u.is_admin, u.guest_board_id,
        coalesce(u.subscription_plan='pro' AND u.subscription_until>now(),false) AS pro,
        coalesce(a.bytes,0)::bigint AS board_bytes,
        coalesce(m.bytes,0)::bigint AS material_bytes,
        coalesce(t.bytes,0)::bigint AS template_bytes,
        (coalesce(a.bytes,0)+coalesce(m.bytes,0)+coalesce(t.bytes,0))::bigint AS used_bytes
    FROM account_users u LEFT JOIN assets a ON a.owner_id=u.id
    LEFT JOIN materials m ON m.owner_id=u.id LEFT JOIN templates t ON t.owner_id=u.id
    WHERE ($1::uuid IS NULL OR u.id=$1)
)
"""

def storage_view(row):
    used = row["used_bytes"]
    limit = None if row["is_admin"] else PRO_STORAGE_BYTES if row["pro"] else FREE_STORAGE_BYTES
    return {"used_bytes": used, "limit_bytes": limit,
            "remaining_bytes": None if limit is None else max(0,limit-used),
            "board_bytes": row["board_bytes"], "material_bytes": row["material_bytes"],
            "template_bytes": row["template_bytes"]}

class ActiveBoards(BaseModel):
    board_ids: list[UUID] = Field(max_length=5)

def make_billing_router(current_user):
    router = APIRouter(prefix="/api/v1/billing")

    @router.get("")
    async def get_billing(request: Request, user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn:
            owner = user["id"]
            row = await conn.fetchrow("""SELECT is_admin, subscription_plan, subscription_until, billing_unlimited(id) AS unlimited,
                (SELECT count(*) FROM billing_students(id)) AS students,
                (SELECT count(*) FROM billing_groups(id)) AS groups,
                (SELECT count(*) FROM board_templates WHERE owner_id=account_users.id) AS templates
                FROM account_users WHERE id=$1""", owner)
            storage = storage_view(await conn.fetchrow(STORAGE_BY_OWNER+" SELECT * FROM usage", owner))
            boards = await conn.fetch("""SELECT id,title,NOT billing_readonly(id) AS active FROM boards
                WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY billing_preferred DESC,created_at DESC,id""", owner)
            return {"plan": "pro" if row["subscription_plan"]=="pro" and row["unlimited"] and row["subscription_until"] else "free",
                    "is_admin": row["is_admin"], "unlimited": row["unlimited"], "until": row["subscription_until"],
                    "usage": {"boards": len(boards), "students": row["students"], "groups": row["groups"],
                              "templates": row["templates"], "storage_bytes": storage["used_bytes"]},
                    "storage": storage,
                    "boards": [dict(b) for b in boards]}

    @router.put("/active-boards")
    async def set_active(data: ActiveBoards, request: Request, user=Depends(current_user)):
        ids = set(data.board_ids)
        async with request.app.state.pool.acquire() as conn, conn.transaction():
            owner = user["id"]
            rows = await conn.fetch("SELECT id FROM boards WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY id FOR UPDATE", owner)
            if not ids <= {r["id"] for r in rows} or len(ids) != min(5,len(rows)):
                raise HTTPException(422, "Выберите до пяти собственных досок (ровно пять, если их больше).")
            await conn.execute("SELECT billing_lock($1)", owner)
            await conn.execute("""UPDATE boards SET billing_preferred=(id=ANY($2::uuid[]))
                WHERE owner_id=$1 AND deleted_at IS NULL""", owner, list(ids))
        return {"ok": True}

    return router
