"""Private, authenticated board-asset endpoints for the self-hosted pilot.

No static file route exposes the asset directory. Large uploads stream into a
private temporary file and only become visible after an authenticated SQL insert.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import re
import tempfile
from pathlib import Path
from uuid import UUID, uuid4

import asyncpg
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from fastapi.responses import FileResponse

MAX_ASSET_BYTES = 50 * 1024 * 1024
VALID_ASSET_ID = re.compile(r"^[A-Za-z0-9_-]{1,160}$")
VALID_MIME = frozenset({
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
    "image/bmp", "image/heic", "image/heif", "image/tiff",
    "image/svg+xml", "application/pdf",
})

def assets_root() -> Path:
    root = os.environ.get("LEKTRUS_ASSETS_DIR", "").strip()
    if not root or not Path(root).is_absolute():
        raise RuntimeError("LEKTRUS_ASSETS_DIR must be an absolute private path")
    path = Path(root)
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    return path.resolve(strict=True)

def asset_id_or_404(value: str) -> str:
    if not VALID_ASSET_ID.fullmatch(value):
        raise HTTPException(404, "Вложение не найдено.")
    return value

def file_path(root: Path, board_id: UUID, storage_name: UUID) -> Path:
    # The physical name is server-generated, never supplied by the browser.
    return root / str(board_id) / storage_name.hex

def response_headers(asset: asyncpg.Record) -> dict[str, str]:
    return {
        "ETag": '"' + asset["sha256"] + '"',
        "Cache-Control": "private, no-cache",
        "Vary": "Authorization",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
        "Content-Length": str(asset["size_bytes"]),
        "Accept-Ranges": "bytes",
    }

def make_asset_router(current_user, board_access) -> APIRouter:
    router = APIRouter()

    @router.get("/api/v1/boards/{board_id}/assets")
    async def list_board_assets(
        board_id: UUID, request: Request, user=Depends(current_user)
    ):
        async with request.app.state.pool.acquire() as conn:
            await board_access(conn, board_id, user["id"])
            records = await conn.fetch(
                """SELECT asset_id,content_type,size_bytes,sha256,created_at
                     FROM board_assets WHERE board_id=$1
                    ORDER BY asset_id LIMIT 2000""",
                board_id,
            )
        return [
            {
                "name": str(board_id) + "/" + row["asset_id"],
                "content_type": row["content_type"],
                "size_bytes": row["size_bytes"],
                "sha256": row["sha256"],
                "created_at": row["created_at"].isoformat(),
            }
            for row in records
        ]

    @router.post("/api/v1/boards/{board_id}/assets/{asset_id}", status_code=201)
    async def upload_asset(
        board_id: UUID, asset_id: str, request: Request,
        user=Depends(current_user),
    ):
        asset_id_or_404(asset_id)
        mime = request.headers.get("content-type", "").split(";")[0].strip().lower()
        if mime == "image/jpg":
            mime = "image/jpeg"
        if mime not in VALID_MIME:
            raise HTTPException(415, "Можно загружать только изображения или PDF.")
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length = int(content_length)
            except ValueError:
                raise HTTPException(400, "Некорректный размер файла.")
            if length < 1 or length > MAX_ASSET_BYTES:
                raise HTTPException(413, "Допускаются файлы размером до 50 МБ.")

        # Reject unauthorized large uploads BEFORE receiving their body.
        async with request.app.state.pool.acquire() as conn:
            _, role = await board_access(conn, board_id, user["id"])
            if role not in ("owner", "editor"):
                raise HTTPException(403, "Недостаточно прав для загрузки файла.")

        root = assets_root()
        fd, temporary_name = tempfile.mkstemp(prefix=".incoming-", dir=root)
        temp = Path(temporary_name)
        sha = hashlib.sha256()
        size = 0
        final: Path | None = None
        committed = False
        try:
            with os.fdopen(fd, "wb") as output:
                async for chunk in request.stream():
                    if not chunk:
                        continue
                    size += len(chunk)
                    if size > MAX_ASSET_BYTES:
                        raise HTTPException(413, "Файл превышает 50 МБ.")
                    sha.update(chunk)
                    await asyncio.to_thread(output.write, chunk)
                await asyncio.to_thread(output.flush)
            if size == 0:
                raise HTTPException(422, "Невозможно загрузить пустой файл.")
            if content_length and size != int(content_length):
                raise HTTPException(400, "Передано не всё содержимое файла.")

            storage_name = uuid4()
            final = file_path(root, board_id, storage_name)
            async with request.app.state.pool.acquire() as conn:
                async with conn.transaction():
                    # Serialize concurrent uploads of the same board and re-check
                    # membership after the stream finished (rights may have changed).
                    _, role = await board_access(
                        conn, board_id, user["id"], lock=True
                    )
                    if role not in ("owner", "editor"):
                        raise HTTPException(403, "Права на запись в доску изменились.")
                    inserted = await conn.fetchval(
                        """INSERT INTO board_assets
                           (board_id,asset_id,storage_name,content_type,
                            size_bytes,sha256,created_by)
                           VALUES($1,$2,$3,$4,$5,$6,$7)
                           ON CONFLICT(board_id,asset_id) DO NOTHING
                           RETURNING asset_id""",
                        board_id, asset_id, storage_name, mime,
                        size, sha.hexdigest(), user["id"],
                    )
                    if inserted is None:
                        raise HTTPException(409, "Вложение с таким ID уже существует.")
                    final.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                    await asyncio.to_thread(os.replace, temp, final)
            committed = True
            return {
                "name": str(board_id) + "/" + asset_id,
                "content_type": mime,
                "size_bytes": size,
                "sha256": sha.hexdigest(),
            }
        finally:
            temp.unlink(missing_ok=True)
            # A SQL rollback after renaming must not leave a publicly discoverable
            # file. A process crash can still orphan a private physical file.
            if final is not None and not committed:
                final.unlink(missing_ok=True)

    async def find_asset(
        board_id: UUID, asset_id: str, request: Request, user
    ):
        asset_id_or_404(asset_id)
        async with request.app.state.pool.acquire() as conn:
            await board_access(conn, board_id, user["id"])
            row = await conn.fetchrow(
                """SELECT asset_id,storage_name,content_type,size_bytes,sha256
                     FROM board_assets WHERE board_id=$1 AND asset_id=$2""",
                board_id, asset_id,
            )
        if row is None:
            raise HTTPException(404, "Вложение не найдено.")
        return row

    @router.get("/api/v1/boards/{board_id}/assets/{asset_id}")
    async def get_asset(
        board_id: UUID, asset_id: str, request: Request, user=Depends(current_user),
        if_none_match: str | None = Header(default=None),
    ):
        row = await find_asset(board_id, asset_id, request, user)
        headers = response_headers(row)
        path = file_path(assets_root(), board_id, row["storage_name"])
        if not path.is_file():
            raise HTTPException(503, "Файл отсутствует в хранилище. Требуется восстановление.")
        if if_none_match and headers["ETag"] in {
            token.strip() for token in if_none_match.split(",")
        }:
            # Authorization is checked before returning 304.
            headers.pop("Content-Length", None)
            headers.pop("Accept-Ranges", None)
            return Response(status_code=304, headers=headers)
        if row["content_type"] == "image/svg+xml":
            headers["Content-Disposition"] = "attachment"
        return FileResponse(path, media_type=row["content_type"], headers=headers)

    @router.head("/api/v1/boards/{board_id}/assets/{asset_id}")
    async def head_asset(
        board_id: UUID, asset_id: str, request: Request, user=Depends(current_user)
    ):
        row = await find_asset(board_id, asset_id, request, user)
        path = file_path(assets_root(), board_id, row["storage_name"])
        if not path.is_file():
            raise HTTPException(503, "Файл отсутствует в хранилище.")
        return Response(status_code=200, headers=response_headers(row))

    @router.delete("/api/v1/boards/{board_id}/assets/{asset_id}", status_code=204)
    async def delete_asset(
        board_id: UUID, asset_id: str, request: Request, user=Depends(current_user)
    ):
        asset_id_or_404(asset_id)
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                _, role = await board_access(conn, board_id, user["id"], lock=True)
                if role not in ("owner", "editor"):
                    raise HTTPException(403, "Недостаточно прав для удаления файла.")
                deleted = await conn.fetchrow(
                    """DELETE FROM board_assets
                        WHERE board_id=$1 AND asset_id=$2
                        RETURNING storage_name""",
                    board_id, asset_id,
                )
        if deleted is not None:
            # Database deletion is authoritative; if unlink fails, a private
            # orphan can be collected without ever granting public access.
            path = file_path(assets_root(), board_id, deleted["storage_name"])
            try:
                await asyncio.to_thread(path.unlink, missing_ok=True)
            except OSError:
                pass
        return Response(status_code=204)

    return router
