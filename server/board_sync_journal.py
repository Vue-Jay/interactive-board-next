"""Bounded metadata-only diagnostics. Telemetry must not break document saves."""
import asyncio
import json
import logging
import time
from collections import deque
from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

class SyncJournalEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event: Literal["object_change","save_ack","save_error","revision_applied","revision_deferred",
                   "revision_rejected","socket_online","socket_offline","socket_reconnecting",
                   "session_start","session_end","visibility_changed","state_checkpoint",
                   "revision_waiting","revision_settled","ink_save_sample","live_dispatch_sample","socket_rtt"]
    version: int | None = Field(None, ge=0, le=2**63-1)
    expected_version: int | None = Field(None, ge=0, le=2**63-1)
    status: int | None = Field(None, ge=0, le=599)
    elapsed_ms: int | None = Field(None, ge=0, le=86400000)
    count: int | None = Field(None, ge=0, le=10000)
    added: int | None = Field(None, ge=0, le=10000)
    changed: int | None = Field(None, ge=0, le=10000)
    removed: int | None = Field(None, ge=0, le=10000)
    transport: Literal["socket","http"] | None = None
    session_id: str | None = Field(None, min_length=32, max_length=36, pattern=r"^[0-9a-f-]+$")
    sequence: int | None = Field(None, ge=1, le=2**53-1)
    occurred_at_ms: int | None = Field(None, ge=0, le=2**53-1)
    session_elapsed_ms: int | None = Field(None, ge=0, le=2**53-1)
    build_id: str | None = Field(None, min_length=1, max_length=96, pattern=r"^[a-zA-Z0-9_.-]+$")
    platform: Literal["web","android","ios"] | None = None
    dropped_count: int | None = Field(None, ge=0, le=2**53-1)
    fingerprint: str | None = Field(None, pattern=r"^[0-9a-f]{16}$")
    local_fingerprint: str | None = Field(None, pattern=r"^[0-9a-f]{16}$")
    pending: bool | None = None
    deferred_version: int | None = Field(None, ge=0, le=2**63-1)
    reason: Literal["save_in_flight","gesture"] | None = None
    role: Literal["owner","co_teacher","student","observer"] | None = None
    visibility: Literal["visible","hidden"] | None = None
    ink: bool | None = None
    dirty: bool | None = None
    first_version: int | None = Field(None, ge=0, le=2**63-1)
    sequence_end: int | None = Field(None, ge=1, le=2**53-1)
    last_occurred_at_ms: int | None = Field(None, ge=0, le=2**53-1)
    event_count: int | None = Field(None, ge=1, le=10000)
    live_type: Literal["cursor","ink_motion","ink_motion_ack","live_ink","live_erase","object_transform","object_preview","editor_mutation"] | None = None
    max_ms: int | None = Field(None, ge=0, le=86400000)
    window_ms: int | None = Field(None, ge=0, le=86400000)

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
                        return False
                await conn.executemany("""INSERT INTO board_sync_journal(board_id,actor_id,source,event)
                    VALUES($1,$2,$3,$4::jsonb)""",
                    [(board_id,actor_id,source,json.dumps(event)) for event in events])
                await conn.execute("""DELETE FROM board_sync_journal WHERE id IN
                    (SELECT id FROM board_sync_journal WHERE board_id=$1 ORDER BY id DESC OFFSET 2000)""",board_id)
                await conn.execute("DELETE FROM board_sync_journal WHERE created_at<now()-interval '7 days'")
        return True
    except Exception:
        logging.getLogger("lektrus.sync_journal").warning("Technical journal write failed",exc_info=True)
        return False

async def read_sync_events(conn,board_id):
    rows=await conn.fetch("""SELECT id,actor_id,source,created_at,event FROM board_sync_journal
        WHERE board_id=$1 AND created_at>=now()-interval '7 days' ORDER BY id DESC LIMIT 2000""",board_id)
    return [{"id":row["id"],"actor_id":str(row["actor_id"]) if row["actor_id"] else None,
             "source":row["source"],"created_at":row["created_at"].isoformat(),
             **(json.loads(row["event"]) if isinstance(row["event"],str) else row["event"])} for row in reversed(rows)]


class ServerSyncJournal:
    """One bounded writer per app. Saves never wait for diagnostic storage."""
    def __init__(self, pool):
        self.pool = pool
        self.queue = deque()
        self.task = None
        self.dropped = 0
        self.ink_sampled = {}

    def submit(self, board_id, actor_id, event):
        if len(self.queue) >= 512:
            self.dropped += 1
            return
        self.queue.append((board_id, actor_id, event))
        if self.task is None or self.task.done():
            self.task = asyncio.create_task(self._run())

    def sample_ink(self, board_id, actor_id):
        now = time.monotonic()
        key = (board_id, actor_id)
        if now - self.ink_sampled.get(key, -10) < 5:
            return False
        if len(self.ink_sampled) >= 512:
            self.ink_sampled = {k:v for k,v in self.ink_sampled.items() if now-v<5}
        if len(self.ink_sampled) >= 512 and key not in self.ink_sampled:
            return False
        self.ink_sampled[key] = now
        return True

    async def _run(self):
        while self.queue:
            board_id, actor_id, event = self.queue.popleft()
            if not await write_sync_events(self.pool, board_id, actor_id, "server", [event]):
                self.dropped += 1

    async def drain(self, timeout=2):
        if self.task is not None:
            try:
                await asyncio.wait_for(asyncio.shield(self.task), timeout)
            except asyncio.TimeoutError:
                pass

    async def close(self):
        await self.drain()
        if self.task and not self.task.done():
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)

    def metadata(self):
        return {"server_writer_dropped_since_start": self.dropped,
                "server_writer_pending": len(self.queue) + int(self.task is not None and not self.task.done())}


def server_sync_journal(app):
    existing = getattr(app.state, "sync_journal", None)
    if existing is None or existing.pool is not app.state.pool:
        existing = ServerSyncJournal(app.state.pool)
        app.state.sync_journal = existing
    return existing


def export_metadata(rows, version, writer):
    return {"schema_version": 2, "retention_days": 7, "max_events": 2000,
            "possibly_truncated": len(rows) == 2000,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "latest_server_version": version,
            "client_batch_interval_ms": 15000, "ink_server_sample_interval_ms": 5000,
            **writer.metadata()}
