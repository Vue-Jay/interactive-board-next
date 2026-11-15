"""Personal, immutable board snapshots. Attachments are retained independently of source boards."""
import asyncio
import errno
import json
import os
import shutil
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from assets import assets_root, file_path


class TemplateCreate(BaseModel):
    board_id: UUID
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    category: str = Field(default="", max_length=80)
    document: dict


class TemplateCopy(BaseModel):
    board_id: UUID


def decode(value):
    return json.loads(value) if isinstance(value, str) else value


def view(row):
    return {"id": str(row["id"]), "owner_id": str(row["owner_id"]),
            "title": row["title"], "description": row["description"],
            "category": row["category"], "document": decode(row["document"]),
            "created_at": row["created_at"].isoformat(),
            "updated_at": row["updated_at"].isoformat(), "use_count": row["use_count"]}


def teacher(user):
    if user["account_role"] != "teacher" or user["guest_board_id"] is not None:
        raise HTTPException(403, "Шаблоны доступны преподавателям.")


def template_path(root, ident, storage_name):
    return root / "templates" / str(ident) / storage_name.hex


def retain_asset(source, destination):
    try:
        os.link(source, destination)
    except OSError as error:
        # Some managed volumes cannot create hard links. Keep an independent
        # copy on those volumes rather than losing attachments.
        if error.errno not in (errno.EXDEV, errno.EOPNOTSUPP, errno.EPERM, errno.ENOSYS):
            raise
        shutil.copyfile(source, destination)


def clean(paths):
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            # Private orphan files are not reachable after the DB row is removed.
            pass


def make_template_router(current_user, board_access, serialize_document):
    router = APIRouter(prefix="/api/v1/board-templates")

    async def owned(conn, ident, user, lock=False):
        row = await conn.fetchrow("select * from board_templates where id=$1 and owner_id=$2" +
                                  (" for update" if lock else ""), ident, user["id"])
        if row is None:
            raise HTTPException(404, "Шаблон не найден.")
        return row

    @router.get("")
    async def listing(request: Request, user=Depends(current_user)):
        teacher(user)
        async with request.app.state.pool.acquire() as c:
            rows = await c.fetch("select * from board_templates where owner_id=$1 order by updated_at desc", user["id"])
        return [view(row) for row in rows]

    @router.post("", status_code=201)
    async def create(data: TemplateCreate, request: Request, user=Depends(current_user)):
        teacher(user)
        title = data.title.strip()
        if not title:
            raise HTTPException(422, "Введите название шаблона.")
        doc = serialize_document(data.document)
        ids = set()
        for item in data.document["items"]:
            if isinstance(item, dict) and item.get("kind") in ("image", "pdf"):
                asset = item.get("assetId")
                if not isinstance(asset, str) or not asset:
                    raise HTTPException(422, "Некорректное вложение.")
                ids.add(asset)
        ident, paths, manifest = uuid4(), [], []
        try:
            async with request.app.state.pool.acquire() as c:
                async with c.transaction():
                    _, role = await board_access(c, data.board_id, user["id"], lock=True)
                    if role != "owner":
                        raise HTTPException(403, "Можно сохранять только свою доску.")
                    if ids:
                        root = assets_root()
                        rows = await c.fetch("select * from board_assets where board_id=$1 and asset_id=any($2::text[])",
                                             data.board_id, list(ids))
                        if len(rows) != len(ids):
                            raise HTTPException(409, "Не все вложения сохранены на сервере.")
                        for row in rows:
                            storage = uuid4()
                            destination = template_path(root, ident, storage)
                            destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                            paths.append(destination)
                            await asyncio.to_thread(retain_asset, file_path(root, data.board_id, row["storage_name"]), destination)
                            manifest.append({"id": row["asset_id"], "storage": str(storage),
                                             "mime": row["content_type"], "size": row["size_bytes"], "sha": row["sha256"].strip()})
                    row = await c.fetchrow("""insert into board_templates(id,owner_id,title,description,category,document,assets)
                        values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) returning *""", ident, user["id"], title,
                        data.description.strip(), data.category.strip(), doc, json.dumps(manifest))
            return view(row)
        except BaseException:
            clean(paths)
            raise

    @router.post("/{ident}/copy-assets")
    async def copy_assets(ident: UUID, data: TemplateCopy, request: Request, user=Depends(current_user)):
        teacher(user)
        paths = []
        try:
            async with request.app.state.pool.acquire() as c:
                async with c.transaction():
                    row = await owned(c, ident, user, True)
                    _, role = await board_access(c, data.board_id, user["id"], lock=True)
                    if role != "owner":
                        raise HTTPException(403, "Можно использовать только свою доску.")
                    manifest = decode(row["assets"])
                    if manifest:
                        root = assets_root()
                        for asset in manifest:
                            existing = await c.fetchval("select sha256 from board_assets where board_id=$1 and asset_id=$2",
                                                        data.board_id, asset["id"])
                            if existing is not None:
                                if existing.strip() != asset["sha"]:
                                    raise HTTPException(409, "Конфликт вложений.")
                                continue
                            storage = uuid4()
                            destination = file_path(root, data.board_id, storage)
                            destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                            paths.append(destination)
                            await asyncio.to_thread(retain_asset, template_path(root, ident, UUID(asset["storage"])), destination)
                            await c.execute("""insert into board_assets(board_id,asset_id,storage_name,content_type,size_bytes,sha256,created_by)
                                values($1,$2,$3,$4,$5,$6,$7)""", data.board_id, asset["id"], storage,
                                asset["mime"], asset["size"], asset["sha"], user["id"])
            return {"ok": True}
        except BaseException:
            clean(paths)
            raise

    @router.post("/{ident}/used")
    async def used(ident: UUID, request: Request, user=Depends(current_user)):
        teacher(user)
        async with request.app.state.pool.acquire() as c:
            if await c.execute("update board_templates set use_count=use_count+1 where id=$1 and owner_id=$2",
                               ident, user["id"]) == "UPDATE 0":
                raise HTTPException(404, "Шаблон не найден.")
        return {"ok": True}

    @router.delete("/{ident}", status_code=204)
    async def delete(ident: UUID, request: Request, user=Depends(current_user)):
        teacher(user)
        async with request.app.state.pool.acquire() as c:
            async with c.transaction():
                row = await owned(c, ident, user, True)
                await c.execute("delete from board_templates where id=$1 and owner_id=$2", ident, user["id"])
        manifest = decode(row["assets"])
        if manifest:
            root = assets_root()
            clean([template_path(root, ident, UUID(asset["storage"])) for asset in manifest])
        return Response(status_code=204)

    return router
