"""Public release journal and authenticated editorial administration."""
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from admin import require_admin

Category = Literal["update", "feature", "announcement"]
PUBLIC_COLUMNS = "id,category,title,summary,body,version,published_at"
ADMIN_COLUMNS = PUBLIC_COLUMNS + ",created_at,updated_at"


class NewsInput(BaseModel):
    category: Category
    title: str = Field(min_length=1, max_length=160)
    summary: str = Field(default="", max_length=500)
    body: str = Field(default="", max_length=12000)
    version: str = Field(default="", max_length=40)
    published: bool = False

    def values(self):
        title, summary, body, version = (self.title.strip(), self.summary.strip(), self.body.strip(), self.version.strip())
        if not title or (self.published and (not summary or not body)):
            raise HTTPException(422, "Укажите заголовок, а перед публикацией — краткое описание и полный текст.")
        return self.category, title, summary, body, version, self.published


def make_news_router(current_user):
    router = APIRouter()

    @router.get("/api/v1/news")
    async def public_news(request: Request, category: Category | None = None,
                          limit: int = Query(20, ge=1, le=50), offset: int = Query(0, ge=0, le=100000)):
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(f"""SELECT {PUBLIC_COLUMNS} FROM site_news
                WHERE published_at IS NOT NULL AND ($1::text IS NULL OR category=$1)
                ORDER BY published_at DESC,id DESC LIMIT $2 OFFSET $3""", category, limit, offset)
        return [dict(row) for row in rows]

    @router.get("/api/v1/admin/news")
    async def admin_news(request: Request, user=Depends(current_user),
                         limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0, le=100000)):
        require_admin(user)
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(f"""SELECT {ADMIN_COLUMNS} FROM site_news
                ORDER BY updated_at DESC,id DESC LIMIT $1 OFFSET $2""", limit, offset)
        return [dict(row) for row in rows]

    @router.post("/api/v1/admin/news", status_code=201)
    async def create_news(data: NewsInput, request: Request, user=Depends(current_user)):
        require_admin(user)
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow(f"""INSERT INTO site_news (category,title,summary,body,version,published_at)
                VALUES ($1,$2,$3,$4,$5,CASE WHEN $6 THEN now() ELSE NULL END)
                RETURNING {ADMIN_COLUMNS}""", *data.values())
        return dict(row)

    @router.put("/api/v1/admin/news/{news_id}")
    async def update_news(news_id: UUID, data: NewsInput, request: Request, user=Depends(current_user)):
        require_admin(user)
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow(f"""UPDATE site_news SET category=$1,title=$2,summary=$3,body=$4,
                version=$5,published_at=CASE WHEN $6 THEN COALESCE(published_at,now()) ELSE NULL END,
                updated_at=now() WHERE id=$7 RETURNING {ADMIN_COLUMNS}""", *data.values(), news_id)
        if row is None:
            raise HTTPException(404, "Публикация не найдена.")
        return dict(row)

    return router
