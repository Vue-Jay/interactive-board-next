"""Apply the versioned PostgreSQL schema for the Timeweb deployment."""
from pathlib import Path

SCHEMA_LOCK = 4983390431404923


async def apply_schema(conn):
    files = sorted(Path(__file__).with_name("sql").glob("[0-9][0-9][0-9]_*.sql"))
    if not files:
        raise RuntimeError("No Lektrus schema files found")
    async with conn.transaction():
        await conn.execute("SELECT pg_advisory_xact_lock($1)", SCHEMA_LOCK)
        await conn.execute(
            "CREATE TABLE IF NOT EXISTS lektrus_schema_versions "
            "(filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
        )
        applied = {row["filename"] for row in await conn.fetch("SELECT filename FROM lektrus_schema_versions")}
        for sql_file in files:
            if sql_file.name in applied:
                continue
            await conn.execute(sql_file.read_text(encoding="utf-8"))
            await conn.execute("INSERT INTO lektrus_schema_versions(filename) VALUES($1)", sql_file.name)
