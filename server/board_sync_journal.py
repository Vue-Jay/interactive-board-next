"""Bounded metadata-only diagnostics. Telemetry must not break document saves."""
import json
import logging
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

class SyncJournalEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event: Literal["object_change","save_ack","save_error","revision_applied","revision_deferred",
                   "revision_rejected","socket_online","socket_offline","socket_reconnecting"]
    version: int | None = Field(None, ge=0, le=2**63-1)
    expected_version: int | None = Field(None, ge=0, le=2**63-1)
    status: int | None = Field(None, ge=0, le=599)
    elapsed_ms: int | None = Field(None, ge=0, le=86400000)
    count: int | None = Field(None, ge=0, le=10000)
    added: int | None = Field(None, ge=0, le=10000)
    changed: int | None = Field(None, ge=0, le=10000)
    removed: int | None = Field(None, ge=0, le=10000)
    transport: Literal["socket","http"] | None = None

class SyncJournalBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    events: list[SyncJournalEvent] = Field(min_length=1,max_length=40)

async def write_sync_events(pool, board_id, actor_id, source, events):
    try:
        async with pool.acquire(timeout=1) as conn:
            async with conn.transaction():
                if source=="client":
                    # One batch per actor/board per five seconds, even with multiple tabs.
                    if await conn.fetchval("""SELECT EXISTS(SELECT 1 FROM board_sync_journal
                        WHERE board_id=$1 AND actor_id=$2 AND source='client'
                        AND created_at>now()-interval '5 seconds')""",board_id,actor_id):
                        return
                await conn.executemany("""INSERT INTO board_sync_journal(board_id,actor_id,source,event)
                    VALUES($1,$2,$3,$4::jsonb)""",
                    [(board_id,actor_id,source,json.dumps(event)) for event in events])
                await conn.execute("""DELETE FROM board_sync_journal WHERE id IN
                    (SELECT id FROM board_sync_journal WHERE board_id=$1 ORDER BY id DESC OFFSET 2000)""",board_id)
                await conn.execute("DELETE FROM board_sync_journal WHERE created_at<now()-interval '7 days'")
    except Exception:
        logging.getLogger("lektrus.sync_journal").warning("Technical journal write failed",exc_info=True)

async def read_sync_events(conn,board_id):
    rows=await conn.fetch("""SELECT id,actor_id,source,created_at,event FROM board_sync_journal
        WHERE board_id=$1 AND created_at>=now()-interval '7 days' ORDER BY id DESC LIMIT 2000""",board_id)
    return [{"id":row["id"],"actor_id":str(row["actor_id"]) if row["actor_id"] else None,
             "source":row["source"],"created_at":row["created_at"].isoformat(),
             **(json.loads(row["event"]) if isinstance(row["event"],str) else row["event"])} for row in reversed(rows)]
