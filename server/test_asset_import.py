"""Lossless Supabase Storage migration tests with fake HTTPS, never real credentials."""
import hashlib
import json
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID

import asyncpg
import httpx
import pytest

import import_supabase_assets as importer
from test_importer import OWNER, STUDENT, BOARD

IMAGE_A = b"\x89PNG\r\n\x1a\n" + b"test-png" * 33
IMAGE_B = b"\xff\xd8" + b"test-jpeg" * 29 + b"\xff\xd9"

def manifest_row(name, mime, size, owner=None):
    return {
        "name":name,
        "metadata":json.dumps({"mimetype":mime,"size":size}),
        "owner_id":str(owner) if owner else None,
        "created_at":None,
    }

def test_storage_manifest_rejects_traversal_and_bad_metadata():
    row = manifest_row(str(BOARD)+"/good_image","image/png",len(IMAGE_A),OWNER)
    result = importer.manifest_from_rows([row])
    assert len(result)==1
    assert result[0].board_id==BOARD and result[0].owner_id==OWNER
    for broken in [
        manifest_row(str(BOARD)+"/../evil","image/png",10),
        manifest_row("not-uuid/good_image","image/png",10),
        manifest_row(str(BOARD)+"/good_image","text/html",10),
        manifest_row(str(BOARD)+"/good_image","image/png",0),
        manifest_row(str(BOARD)+"/good_image","image/png",50*1024*1024+1),
    ]:
        with pytest.raises(RuntimeError):
            importer.manifest_from_rows([broken])
    with pytest.raises(RuntimeError,match="duplicated"):
        importer.manifest_from_rows([row,row])

def test_storage_origin_must_match_source_database(monkeypatch):
    monkeypatch.setenv("LEKTRUS_SOURCE_STORAGE_URL","http://mock.supabase.co")
    with pytest.raises(RuntimeError):
        importer.storage_endpoint("postgresql://x:x@db.mock.supabase.co/db")
    monkeypatch.setenv("LEKTRUS_SOURCE_STORAGE_URL","https://evil.example/")
    with pytest.raises(RuntimeError):
        importer.storage_endpoint("postgresql://x:x@db.mock.supabase.co/db")
    monkeypatch.setenv("LEKTRUS_SOURCE_STORAGE_URL","https://wrong.supabase.co")
    with pytest.raises(RuntimeError,match="differ"):
        importer.storage_endpoint("postgresql://x:x@db.mock.supabase.co/db")
    monkeypatch.setenv("LEKTRUS_SOURCE_STORAGE_URL","https://mock.supabase.co")
    assert importer.storage_endpoint("postgresql://x:x@db.mock.supabase.co/db")==(
        "https://mock.supabase.co"
    )

@pytest.mark.asyncio
async def test_source_size_mismatch_leaves_no_private_tempfile(tmp_path):
    name = str(BOARD)+"/image_a"
    row = importer.manifest_from_rows([
        manifest_row(name,"image/png",len(IMAGE_A)+1,OWNER)
    ])[0]
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200,stream=httpx.ByteStream(IMAGE_A)))
    )
    async with client:
        with pytest.raises(RuntimeError,match="bytes"):
            await importer.copy_binary(
                client,"https://mock.supabase.co",{"Authorization":"Bearer fake"},row,tmp_path
            )
    assert list(tmp_path.glob(".asset-import-*"))==[]

@pytest.mark.asyncio
async def test_source_assets_copy_in_one_transaction_without_overwriting(
    monkeypatch,tmp_path
):
    target_dsn = __import__("os").environ["DATABASE_URL"]
    parts = urlsplit(target_dsn)
    source_dsn = urlunsplit(
        (parts.scheme,parts.netloc,"/lektrus_source_ci",parts.query,parts.fragment)
    )
    # test_importer.py initializes the core import before this test.
    source = await asyncpg.connect(source_dsn)
    await source.execute("""
        CREATE SCHEMA IF NOT EXISTS storage;
        CREATE TABLE IF NOT EXISTS storage.objects (
          name text primary key, bucket_id text, metadata jsonb,
          owner_id text, created_at timestamptz not null default now()
        );
        TRUNCATE storage.objects;
    """)
    await source.execute(
        """INSERT INTO storage.objects(name,bucket_id,metadata,owner_id)
           VALUES($1,'board-assets',$2::jsonb,$3),($4,'board-assets',$5::jsonb,$6)""",
        str(BOARD)+"/image_a",
        json.dumps({"mimetype":"image/png","size":len(IMAGE_A)}),str(OWNER),
        str(BOARD)+"/image_b",
        json.dumps({"mimetype":"image/jpeg","size":len(IMAGE_B)}),str(STUDENT),
    )
    await source.close()

    dest = await asyncpg.connect(target_dsn)
    await dest.execute(
        """CREATE TABLE IF NOT EXISTS board_assets (
          board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
          asset_id text NOT NULL,storage_name uuid NOT NULL UNIQUE,
          content_type text NOT NULL,size_bytes bigint NOT NULL,
          sha256 char(64) NOT NULL,
          created_by uuid NOT NULL REFERENCES account_users(id),
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY(board_id,asset_id)
        )"""
    )
    await dest.execute("DELETE FROM board_assets")
    assert await dest.fetchval("SELECT count(*) FROM boards WHERE id=$1",BOARD)==1
    await dest.close()

    monkeypatch.setenv("LEKTRUS_SOURCE_DATABASE_URL",source_dsn)
    monkeypatch.setenv("LEKTRUS_TEST_INSECURE_SOURCE","1")
    monkeypatch.setenv("LEKTRUS_SOURCE_STORAGE_URL","https://mock.supabase.co")
    monkeypatch.setenv("LEKTRUS_SOURCE_PROJECT_REF","mock")
    monkeypatch.setenv("LEKTRUS_SOURCE_STORAGE_API_KEY","synthetic-key")
    monkeypatch.setenv("LEKTRUS_SOURCE_STORAGE_ACCESS_TOKEN","synthetic-token")
    monkeypatch.setenv("LEKTRUS_ASSETS_DIR",str(tmp_path/"private"))

    file_data={
        str(BOARD)+"/image_a":IMAGE_A,
        str(BOARD)+"/image_b":IMAGE_B,
    }
    requests=[]
    def handler(request):
        requests.append(request)
        assert request.url.host=="mock.supabase.co"
        assert request.headers["authorization"]=="Bearer synthetic-token"
        assert request.headers["apikey"]=="synthetic-key"
        name=request.url.path.partition("/board-assets/")[2]
        if name not in file_data:return httpx.Response(404)
        return httpx.Response(200,stream=httpx.ByteStream(file_data[name]))

    client_class = httpx.AsyncClient
    def mock_async_client(**kwargs):
        return client_class(
            transport=httpx.MockTransport(handler),**kwargs
        )
    monkeypatch.setattr(importer.httpx,"AsyncClient",mock_async_client)

    await importer.run(apply=False)
    assert requests==[],"Read-only preflight must not request any binary"
    await importer.run(apply=True)
    assert len(requests)==2

    dest=await asyncpg.connect(target_dsn)
    try:
        rows=await dest.fetch(
            """SELECT board_id,asset_id,storage_name,content_type,size_bytes,
                      sha256,created_by FROM board_assets ORDER BY asset_id"""
        )
        assert len(rows)==2
        assert [x["asset_id"] for x in rows]==["image_a","image_b"]
        assert [x["created_by"] for x in rows]==[OWNER,STUDENT]
        for row in rows:
            contents=file_data[str(row["board_id"])+"/"+row["asset_id"]]
            path=tmp_path/"private"/str(row["board_id"])/row["storage_name"].hex
            assert path.read_bytes()==contents
            assert row["size_bytes"]==len(contents)
            assert row["sha256"]==hashlib.sha256(contents).hexdigest()
    finally:
        await dest.close()

    with pytest.raises(RuntimeError,match="empty"):
        await importer.run(apply=True)
    assert len(requests)==2,"A repeated import must not fetch or replace files"
