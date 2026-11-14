"""Migration is tested between two disposable PostgreSQL databases."""
import os
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID, uuid4

import asyncpg
import bcrypt
import pytest

from import_supabase_core import run as run_import

OWNER = UUID("00000000-0000-4000-8000-000000000101")
STUDENT = UUID("00000000-0000-4000-8000-000000000102")
BOARD = UUID("00000000-0000-4000-8000-000000000103")
DOCUMENT = '{"version":1,"title":"Урок","items":[{"id":"a","kind":"text"}],"ink":[]}'

@pytest.mark.asyncio
async def test_lossless_core_import_to_empty_database(monkeypatch):
    target_dsn = os.environ["DATABASE_URL"]
    parts = urlsplit(target_dsn)
    source_dsn = urlunsplit((parts.scheme,parts.netloc,
                            "/lektrus_source_ci",parts.query,parts.fragment))
    admin = await asyncpg.connect(target_dsn)
    await admin.execute("CREATE DATABASE lektrus_source_ci")
    await admin.close()

    source = await asyncpg.connect(source_dsn)
    await source.execute("""
        CREATE SCHEMA auth;
        CREATE TABLE auth.users (
            id uuid primary key, email text,
            encrypted_password text, email_confirmed_at timestamptz,
            created_at timestamptz not null default now(),
            is_anonymous boolean not null default false
        );
        CREATE TABLE public.profiles(
            id uuid primary key,display_name text,first_name text,last_name text,
            account_role text,teacher_status text,
            subscription_plan text,subscription_until timestamptz
        );
        CREATE TABLE public.app_admins(user_id uuid primary key);
        CREATE TABLE public.boards(
            id uuid primary key,owner_id uuid,title text,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now(),deleted_at timestamptz
        );
        CREATE TABLE public.board_members(
            board_id uuid,user_id uuid,role text,added_at timestamptz not null default now()
        );
        CREATE TABLE public.board_documents(
            board_id uuid,document jsonb,version bigint,
            updated_at timestamptz not null default now(),updated_by uuid
        );
        CREATE TABLE public.board_invites (
            id uuid primary key,board_id uuid,email text,role text,
            created_at timestamptz not null default now()
        );
    """)
    password = bcrypt.hashpw(b"migrated-password", bcrypt.gensalt(rounds=4)).decode()
    for uid,email,role in [(OWNER,"teacher@test.invalid","teacher"),
                           (STUDENT,"pupil@test.invalid","student")]:
        await source.execute(
            """INSERT INTO auth.users(id,email,encrypted_password,email_confirmed_at)
               VALUES($1,$2,$3,now())""",uid,email,password
        )
        await source.execute(
            """INSERT INTO public.profiles(id,display_name,first_name,last_name,
                      account_role,teacher_status,subscription_plan)
               VALUES($1,$2,$3,$4,$5,$6,'free')""",
            uid,"Учитель" if uid==OWNER else "Ученик",
            "Имя","Фамилия",role,"approved" if role=="teacher" else "none"
        )
    await source.execute(
        "INSERT INTO public.boards(id,owner_id,title) VALUES($1,$2,$3)",
        BOARD,OWNER,"Урок"
    )
    await source.execute(
        "INSERT INTO public.board_members(board_id,user_id,role) VALUES($1,$2,'editor')",
        BOARD,STUDENT
    )
    await source.execute(
        """INSERT INTO public.board_documents(board_id,document,version,updated_by)
           VALUES($1,$2::jsonb,5,$3)""",BOARD,DOCUMENT,STUDENT
    )
    invite_id = uuid4()
    await source.execute(
        """INSERT INTO public.board_invites(id,board_id,email,role)
           VALUES($1,$2,'future@test.invalid','viewer')""",invite_id,BOARD
    )
    await source.close()

    target = await asyncpg.connect(target_dsn)
    await target.execute(
        "TRUNCATE account_sessions,board_documents,board_members,boards,account_users CASCADE"
    )
    await target.close()

    monkeypatch.setenv("LEKTRUS_SOURCE_DATABASE_URL",source_dsn)
    monkeypatch.setenv("LEKTRUS_TEST_INSECURE_SOURCE","1")
    await run_import(apply=False)
    target = await asyncpg.connect(target_dsn)
    assert await target.fetchval("SELECT count(*) FROM account_users")==0
    await target.close()

    await run_import(apply=True)
    target = await asyncpg.connect(target_dsn)
    try:
        rows = await target.fetch("SELECT * FROM account_users ORDER BY email")
        assert len(rows)==2
        assert all(bcrypt.checkpw(b"migrated-password",
                                  row["password_hash"].encode()) for row in rows)
        assert {r["account_role"] for r in rows}=={"teacher","student"}
        assert {r["id"] for r in rows}=={OWNER,STUDENT}
        assert await target.fetchval("SELECT count(*) FROM board_members")==1
        invite = await target.fetchrow(
            "SELECT id,board_id,email,role FROM board_invites"
        )
        assert invite["id"] == invite_id
        assert invite["board_id"] == BOARD
        assert invite["email"] == "future@test.invalid"
        assert invite["role"] == "viewer"
        doc = await target.fetchrow(
            "SELECT version,updated_by,document::text AS document FROM board_documents"
        )
        assert doc["version"]==5 and doc["updated_by"]==STUDENT
        assert '"kind": "text"' in doc["document"]
    finally:
        await target.close()
    with pytest.raises(RuntimeError,match="nonempty"):
        await run_import(apply=True)
