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
                (SELECT count(*) FROM board_templates WHERE owner_id=account_users.id) AS templates,
                billing_storage(id) AS storage_bytes FROM account_users WHERE id=$1""", owner)
            boards = await conn.fetch("""SELECT id,title,NOT billing_readonly(id) AS active FROM boards
                WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY billing_preferred DESC,created_at DESC,id""", owner)
            return {"plan": "pro" if row["subscription_plan"]=="pro" and row["unlimited"] and row["subscription_until"] else "free",
                    "is_admin": row["is_admin"], "unlimited": row["unlimited"], "until": row["subscription_until"],
                    "usage": {"boards": len(boards), "students": row["students"], "groups": row["groups"],
                              "templates": row["templates"], "storage_bytes": row["storage_bytes"]},
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
