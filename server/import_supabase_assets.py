"""Private asset migration from Supabase Storage into the self-hosted filesystem.

By default the source DB is READ ONLY and no files are downloaded. --apply
requires an empty target board_assets table, an already imported core database,
a secret Storage access token and a private filesystem volume.

Source secrets, image content and account identifiers are never printed.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote, urlsplit
from uuid import UUID, uuid4

import asyncpg
import httpx

from assets import MAX_ASSET_BYTES, VALID_ASSET_ID, VALID_MIME, assets_root, file_path
from import_supabase_core import source_uri, target_uri

MAX_IMPORT_OBJECTS = 10_000
MAX_IMPORT_BYTES = 5 * 1024 * 1024 * 1024  # defensive pilot capacity ceiling

SOURCE_OBJECTS_SQL = """
SELECT name, metadata::text AS metadata, owner_id, created_at
FROM storage.objects
WHERE bucket_id='board-assets'
ORDER BY name
"""

@dataclass(frozen=True)
class SourceAsset:
    board_id: UUID
    asset_id: str
    name: str
    content_type: str
    size: int
    owner_id: UUID | None
    created_at: object

def manifest_from_rows(rows) -> list[SourceAsset]:
    if len(rows) > MAX_IMPORT_OBJECTS:
        raise RuntimeError("Source Storage has more assets than the pilot accepts")
    seen: set[tuple[UUID,str]] = set()
    assets: list[SourceAsset] = []
    total_bytes = 0
    for row in rows:
        name = row["name"]
        if not isinstance(name,str) or name.count("/") != 1:
            raise RuntimeError("Unsupported Source Storage key format")
        board_text, asset_id = name.split("/")
        try:
            board_id = UUID(board_text)
        except ValueError as exc:
            raise RuntimeError("Source asset has invalid board UUID") from exc
        if str(board_id) != board_text or not VALID_ASSET_ID.fullmatch(asset_id):
            raise RuntimeError("Source Storage path cannot be represented safely")
        key = (board_id,asset_id)
        if key in seen:
            raise RuntimeError("Source Storage has duplicated board attachment ID")
        seen.add(key)
        metadata = row["metadata"]
        if isinstance(metadata,str):
            metadata = json.loads(metadata)
        if not isinstance(metadata,dict):
            raise RuntimeError("Source Storage metadata is invalid")
        try:
            size = int(metadata.get("size"))
        except (ValueError,TypeError):
            raise RuntimeError("Source Storage size is missing or invalid") from None
        mime = str(metadata.get("mimetype") or "").lower().strip()
        if mime == "image/jpg":
            mime = "image/jpeg"
        if size <= 0 or size > MAX_ASSET_BYTES or mime not in VALID_MIME:
            raise RuntimeError("Source contains a file outside the accepted size/type policy")
        total_bytes += size
        if total_bytes > MAX_IMPORT_BYTES:
            raise RuntimeError("Storage copy exceeds the pilot capacity ceiling")
        owner = row["owner_id"]
        try:
            owner_id = UUID(str(owner)) if owner else None
        except ValueError:
            owner_id = None
        assets.append(SourceAsset(board_id,asset_id,name,mime,size,
                                  owner_id,row["created_at"]))
    return assets

def storage_endpoint(source_database_url: str) -> str:
    value = os.getenv("LEKTRUS_SOURCE_STORAGE_URL","").strip()
    if not value:
        raise RuntimeError("LEKTRUS_SOURCE_STORAGE_URL is required to copy assets")
    parts = urlsplit(value)
    if (parts.scheme != "https" or not parts.hostname
        or not parts.hostname.endswith(".supabase.co")
        or parts.hostname.count(".") != 2
        or parts.username or parts.password or parts.port or parts.path not in ("","/")
        or parts.query or parts.fragment):
        raise RuntimeError("Storage URL must be the canonical HTTPS project.supabase.co origin")
    api_ref = parts.hostname.split(".")[0]
    database_host = urlsplit(source_database_url).hostname or ""
    if database_host.startswith("db.") and database_host.endswith(".supabase.co"):
        if database_host.split(".")[1] != api_ref:
            raise RuntimeError("Storage and database projects differ")
    else:
        expected = os.getenv("LEKTRUS_SOURCE_PROJECT_REF","")
        if expected != api_ref:
            raise RuntimeError("Set an explicit matching source project ref for pooled DB URLs")
    return value.rstrip("/")

async def copy_binary(
    client: httpx.AsyncClient, url: str, headers: dict[str,str],
    asset: SourceAsset, directory: Path
) -> tuple[Path,str]:
    fd, name = tempfile.mkstemp(prefix=".asset-import-",dir=directory)
    temp = Path(name)
    sha = hashlib.sha256()
    size = 0
    try:
        async with client.stream(
            "GET",
            url+"/storage/v1/object/authenticated/board-assets/"+quote(asset.name,safe="/"),
            headers=headers,
        ) as response:
            if response.status_code != 200:
                raise RuntimeError("Storage download failed (HTTP status " +
                                   str(response.status_code) + ")")
            with os.fdopen(fd,"wb") as output:
                fd = -1
                async for chunk in response.aiter_raw():
                    size += len(chunk)
                    if size > asset.size or size > MAX_ASSET_BYTES:
                        raise RuntimeError("Storage asset exceeded its declared size")
                    sha.update(chunk)
                    await asyncio.to_thread(output.write,chunk)
                await asyncio.to_thread(output.flush)
        if size != asset.size:
            raise RuntimeError("Downloaded Storage bytes do not match source metadata")
        # Verify that local disk persisted the same bytes as the stream.
        def disk_digest():
            h = hashlib.sha256()
            with temp.open("rb") as fh:
                for part in iter(lambda: fh.read(256*1024),b""):
                    h.update(part)
            return h.hexdigest()
        if await asyncio.to_thread(disk_digest) != sha.hexdigest():
            raise RuntimeError("Temporary file content failed SHA-256 validation")
        return temp,sha.hexdigest()
    except Exception:
        if fd >= 0:
            os.close(fd)
        temp.unlink(missing_ok=True)
        raise

async def run(apply: bool):
    source_dsn = source_uri()
    # Even dry run is read-only on Supabase; no content or credentials printed.
    source_host = urlsplit(source_dsn).hostname
    local_ci = (os.getenv("LEKTRUS_TEST_INSECURE_SOURCE") == "1"
                and source_host in ("localhost", "127.0.0.1"))
    source = await asyncpg.connect(
        source_dsn,ssl=False if local_ci else "require",timeout=20
    )
    try:
        async with source.transaction(isolation="repeatable_read",readonly=True):
            manifest = manifest_from_rows(await source.fetch(SOURCE_OBJECTS_SQL))
    finally:
        await source.close()

    print("Storage manifest:",len(manifest),"objects,",
          sum(item.size for item in manifest),"bytes; no private paths printed")
    if not apply:
        print("READ-ONLY MODE: no file downloaded or target data changed.")
        return

    dst_dsn = target_uri()
    source_parts,target_parts = urlsplit(source_dsn),urlsplit(dst_dsn)
    if (source_parts.hostname,source_parts.port,source_parts.path) == (
        target_parts.hostname,target_parts.port,target_parts.path
    ):
        raise RuntimeError("Source and destination databases must be different")
    url = storage_endpoint(source_dsn)
    key = os.getenv("LEKTRUS_SOURCE_STORAGE_API_KEY","").strip()
    token = os.getenv("LEKTRUS_SOURCE_STORAGE_ACCESS_TOKEN","").strip()
    if not key or not token:
        raise RuntimeError("Source Storage API key and authorized token are required")

    target = await asyncpg.connect(dst_dsn,timeout=20)
    root = assets_root()
    staged: list[tuple[SourceAsset,Path,str]] = []
    installed: list[Path] = []
    committed = False
    try:
        if await target.fetchval("SELECT count(*) FROM board_assets") != 0:
            raise RuntimeError("Target attachment table must be empty")
        boards = await target.fetch("SELECT id,owner_id FROM boards")
        owners = {b["id"]: b["owner_id"] for b in boards}
        account_ids = {r["id"] for r in await target.fetch("SELECT id FROM account_users")}
        if any(asset.board_id not in owners for asset in manifest):
            raise RuntimeError("A Storage object refers to an unimported board")

        timeout = httpx.Timeout(connect=10,read=90,write=10,pool=10)
        headers = {
            "apikey":key,
            "Authorization":"Bearer "+token,
            "Accept-Encoding":"identity",
        }
        async with httpx.AsyncClient(
            timeout=timeout,follow_redirects=False,trust_env=False
        ) as client:
            for asset in manifest:
                temp,digest = await copy_binary(client,url,headers,asset,root)
                staged.append((asset,temp,digest))

        async with target.transaction():
            # Reject concurrent changes during the final install.
            await target.execute("LOCK TABLE board_assets IN SHARE ROW EXCLUSIVE MODE")
            if await target.fetchval("SELECT count(*) FROM board_assets") != 0:
                raise RuntimeError("Target attachment table changed during import")
            for asset,temp,digest in staged:
                storage_name = uuid4()
                creator = asset.owner_id if asset.owner_id in account_ids else owners[asset.board_id]
                final = file_path(root,asset.board_id,storage_name)
                await target.execute(
                    """INSERT INTO board_assets
                       (board_id,asset_id,storage_name,content_type,
                        size_bytes,sha256,created_by,created_at)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""",
                    asset.board_id,asset.asset_id,storage_name,asset.content_type,
                    asset.size,digest,creator,asset.created_at,
                )
                final.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
                await asyncio.to_thread(os.replace,temp,final)
                installed.append(final)
            expected = len(manifest)
            if await target.fetchval("SELECT count(*) FROM board_assets") != expected:
                raise RuntimeError("Not all metadata rows were installed")
        committed = True
        print("Storage import verified:",len(installed),
              "private objects. No changes made to Supabase.")
    finally:
        for _,path,_ in staged:
            path.unlink(missing_ok=True)
        if not committed:
            # PostgreSQL rollback removes metadata; remove copied files as well.
            for path in installed:
                path.unlink(missing_ok=True)
        await target.close()

if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply",action="store_true",
                        help="Download and atomically install into an empty target")
    args=parser.parse_args()
    asyncio.run(run(args.apply))
