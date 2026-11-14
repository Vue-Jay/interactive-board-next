"""Copy Lectrus core data directly from Supabase PostgreSQL to isolated self-hosted DB.

Default is read-only preflight. --apply requires an EMPTY target and runs all
inserts in one transaction. Never logs email addresses, passwords, hashes, or
board content. Does not migrate Storage binary objects or secondary features.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os

import asyncpg

SOURCE_SQL = {
    "users": """SELECT u.id,lower(u.email) AS email,
       u.encrypted_password AS password_hash,
       coalesce(nullif(p.display_name,''),split_part(u.email,'@',1)) AS display_name,
       coalesce(p.first_name,'') AS first_name,
       coalesce(p.last_name,'') AS last_name,
       coalesce(p.account_role,'student') AS account_role,
       coalesce(p.teacher_status,'none') AS teacher_status,
       exists(select 1 from public.app_admins a where a.user_id=u.id) AS is_admin,
       coalesce(p.subscription_plan,'free') AS subscription_plan,
       p.subscription_until,
       coalesce(to_jsonb(p)::text,'{}') AS profile_details,
       u.email_confirmed_at,u.created_at,
       coalesce(u.is_anonymous,false) AS is_anonymous
       FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id
       ORDER BY u.id""",
    "boards": """SELECT id,owner_id,title,created_at,updated_at,deleted_at
                 FROM public.boards ORDER BY id""",
    "members": """SELECT board_id,user_id,role,added_at
                  FROM public.board_members ORDER BY board_id,user_id""",
    "documents": """SELECT board_id,document::text AS document,
                           version,updated_at,updated_by
                    FROM public.board_documents ORDER BY board_id""",
}

def source_uri() -> str:
    value = os.getenv("LEKTRUS_SOURCE_DATABASE_URL")
    if not value or not value.startswith(("postgresql://", "postgres://")):
        raise RuntimeError("LEKTRUS_SOURCE_DATABASE_URL is required")
    return value

def target_uri() -> str:
    value = os.getenv("DATABASE_URL")
    if not value or not value.startswith(("postgresql://", "postgres://")):
        raise RuntimeError("DATABASE_URL for an isolated target is required")
    return value

def preflight(rows: dict[str, list[asyncpg.Record]]) -> None:
    users = rows["users"]
    if any(r["is_anonymous"] or not r["email"] or not r["password_hash"]
           or not r["password_hash"].startswith(("$2a$", "$2b$", "$2y$"))
           for r in users):
        raise RuntimeError("Some users cannot be migrated without account review")
    user_ids = {r["id"] for r in users}
    board_ids = {r["id"] for r in rows["boards"]}
    if len(user_ids) != len(users) or len(board_ids) != len(rows["boards"]):
        raise RuntimeError("Duplicate user/board identifiers")
    if any(b["owner_id"] not in user_ids for b in rows["boards"]):
        raise RuntimeError("A board owner is missing from exported accounts")
    if any(m["board_id"] not in board_ids or m["user_id"] not in user_ids
           or m["role"] not in ("editor", "viewer") for m in rows["members"]):
        raise RuntimeError("A membership cannot be migrated")
    if any(d["board_id"] not in board_ids or d["updated_by"] not in user_ids
           or not d["document"] for d in rows["documents"]):
        raise RuntimeError("A document has an unknown owner or invalid payload")

async def run(apply: bool) -> None:
    source = await asyncpg.connect(source_uri(), ssl="require", timeout=20)
    try:
        async with source.transaction(isolation="repeatable_read", readonly=True):
            rows = {name: await source.fetch(sql) for name,sql in SOURCE_SQL.items()}
            preflight(rows)
            counts = {name: len(value) for name,value in rows.items()}
            print("Snapshot preflight OK:", json.dumps(counts, sort_keys=True))
            if not apply:
                print("READ-ONLY MODE. Nothing copied. Supply --apply only for isolated target.")
                return

            target = await asyncpg.connect(target_uri(), timeout=20)
            try:
                async with target.transaction():
                    for table in ("account_users", "account_sessions", "boards",
                                  "board_members", "board_documents"):
                        existing = await target.fetchval(f"SELECT count(*) FROM {table}")
                        if existing:
                            raise RuntimeError("Refusing import into a nonempty target")
                    await target.executemany(
                        """INSERT INTO account_users
                           (id,email,password_hash,display_name,first_name,last_name,
                            account_role,teacher_status,is_admin,subscription_plan,
                            subscription_until,profile_details,email_confirmed_at,created_at)
                           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14)""",
                        [tuple(r[key] for key in (
                            "id","email","password_hash","display_name","first_name",
                            "last_name","account_role","teacher_status","is_admin",
                            "subscription_plan","subscription_until","profile_details",
                            "email_confirmed_at","created_at",
                        )) for r in rows["users"]],
                    )
                    await target.executemany(
                        """INSERT INTO boards(id,owner_id,title,created_at,updated_at,deleted_at)
                           VALUES($1,$2,$3,$4,$5,$6)""",
                        [tuple(r[k] for k in (
                            "id","owner_id","title","created_at","updated_at","deleted_at"
                        )) for r in rows["boards"]],
                    )
                    await target.executemany(
                        """INSERT INTO board_members(board_id,user_id,role,added_at)
                           VALUES($1,$2,$3,$4)""",
                        [tuple(r[k] for k in (
                            "board_id","user_id","role","added_at"
                        )) for r in rows["members"]],
                    )
                    await target.executemany(
                        """INSERT INTO board_documents(board_id,document,version,updated_at,updated_by)
                           VALUES($1,$2::jsonb,$3,$4,$5)""",
                        [tuple(r[k] for k in (
                            "board_id","document","version","updated_at","updated_by"
                        )) for r in rows["documents"]],
                    )
                    for table,name in (
                        ("account_users","users"),
                        ("boards","boards"),
                        ("board_members","members"),
                        ("board_documents","documents"),
                    ):
                        if await target.fetchval(f"SELECT count(*) FROM {table}") != counts[name]:
                            raise RuntimeError("Post-import record counts do not match")
                    copied = await target.fetch(
                        "SELECT board_id,document::text AS document FROM board_documents"
                    )
                    source_hashes = {
                        r["board_id"]: hashlib.sha256(
                            json.dumps(json.loads(r["document"]),sort_keys=True,
                                       ensure_ascii=False,separators=(",",":")).encode()
                        ).digest() for r in rows["documents"]
                    }
                    for row in copied:
                        result = hashlib.sha256(
                            json.dumps(json.loads(row["document"]),sort_keys=True,
                                       ensure_ascii=False,separators=(",",":")).encode()
                        ).digest()
                        if source_hashes.get(row["board_id"]) != result:
                            raise RuntimeError("Document content validation failed")
                print("Atomic core import verified. Binary assets and other features NOT migrated.")
            finally:
                await target.close()
    finally:
        await source.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true",
                        help="Copy into an empty target in one transaction")
    args = parser.parse_args()
    asyncio.run(run(apply=args.apply))
