"""Read-only integrity audit for the private Lektrus board assets volume.

Verifies: every SQL metadata record maps to a real file with exact length and
SHA-256; all physical files on the private volume are accounted for. Never
prints board or user identifiers, file contents, credentials, or file paths.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from uuid import UUID

import asyncpg

from assets import file_path

@dataclass(frozen=True)
class AuditResult:
    records: int
    valid: int
    missing: int
    wrong_size: int
    wrong_hash: int
    orphan_files: int

    @property
    def ok(self) -> bool:
        return self.records == self.valid and self.orphan_files == 0

def private_root() -> Path:
    name = os.environ.get("LEKTRUS_ASSETS_DIR","").strip()
    if not name or not Path(name).is_absolute():
        raise RuntimeError("LEKTRUS_ASSETS_DIR must be an absolute private directory")
    root = Path(name)
    if not root.is_dir():
        raise RuntimeError("Private asset directory is missing")
    return root.resolve(strict=True)

def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(256*1024),b""):
            digest.update(chunk)
    return digest.hexdigest()

async def audit(pool: asyncpg.Pool, root: Path) -> AuditResult:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT board_id,storage_name,size_bytes,sha256 FROM board_assets"
        )
    valid=missing=wrong_size=wrong_hash=0
    expected: set[Path] = set()
    for row in rows:
        path = file_path(root,row["board_id"],row["storage_name"])
        expected.add(path)
        try:
            size = path.stat().st_size
        except FileNotFoundError:
            missing+=1
            continue
        if not path.is_file():
            missing+=1
            continue
        if size != row["size_bytes"]:
            wrong_size+=1
            continue
        try:
            digest = await asyncio.to_thread(hash_file,path)
        except (OSError,ValueError):
            wrong_hash+=1
            continue
        if digest != row["sha256"]:
            wrong_hash+=1
            continue
        valid+=1
    # Private temp files from interrupted uploads are also reported as orphans.
    orphan = sum(
        1 for path in root.rglob("*") if (path.is_file() or path.is_symlink())
        and path not in expected
    )
    return AuditResult(len(rows),valid,missing,wrong_size,wrong_hash,orphan)

async def main():
    root = private_root()
    database = os.environ.get("DATABASE_URL","")
    if not database:
        raise RuntimeError("DATABASE_URL is required for integrity audit")
    pool = await asyncpg.create_pool(database,min_size=1,max_size=2)
    try:
        result = await audit(pool,root)
    finally:
        await pool.close()
    # The audit intentionally prints aggregate counts only.
    print("Private asset integrity:",asdict(result))
    if not result.ok:
        raise SystemExit("Asset integrity failed; restore from backups before cutover")

if __name__ == "__main__":
    asyncio.run(main())
