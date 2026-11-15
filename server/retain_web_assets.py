"""Keep a small rolling window of immutable, public frontend assets.

An open tab must be able to request lazy chunks from its original build even
after the current container is replaced. This is separate from board media.
"""
import hashlib
import json
import re
import shutil
from pathlib import Path

HASHED = re.compile(r".+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)?$")


def retain(web: Path, retained: Path, limit: int = 3) -> None:
    assets = retained / "assets"
    manifests = retained / "manifests"
    assets.mkdir(parents=True, exist_ok=True)
    manifests.mkdir(parents=True, exist_ok=True)
    build = hashlib.sha256((web / "index.html").read_bytes()).hexdigest()
    names = sorted(p.name for p in (web / "assets").iterdir()
                   if p.is_file() and HASHED.fullmatch(p.name))
    for name in names:
        target = assets / name
        if not target.exists():
            temp = assets / (name + ".tmp")
            shutil.copyfile(web / "assets" / name, temp)
            temp.replace(target)
    manifest = manifests / (build + ".json")
    temp = manifests / (build + ".tmp")
    temp.write_text(json.dumps(names), encoding="utf-8")
    temp.replace(manifest)
    versions = sorted(manifests.glob("*.json"), key=lambda p: p.stat().st_mtime_ns, reverse=True)
    keep = set()
    for version in versions[:limit]:
        keep.update(json.loads(version.read_text(encoding="utf-8")))
    for version in versions[limit:]:
        version.unlink()
    for item in assets.iterdir():
        if item.is_file() and HASHED.fullmatch(item.name) and item.name not in keep:
            item.unlink()


if __name__ == "__main__":
    retain(Path("/srv/web"), Path("/data/web-releases"))
