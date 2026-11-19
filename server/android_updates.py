"""Public, cached catalog of actually published, signed Android releases."""
from __future__ import annotations

import asyncio
import json
import os
import re
import time
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Response

REPOSITORY = "Vue-Jay/interactive-board-next"
RELEASES = f"https://api.github.com/repos/{REPOSITORY}/releases?per_page=20"
VERSION = re.compile(r"(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})")
DEFAULT_MINIMUM = "1.0.0"


def version_key(value):
    if not isinstance(value, str) or not VERSION.fullmatch(value):
        return None
    return tuple(map(int, value.split(".")))


def select_android_release(releases):
    """Only stable releases with the exact two official release assets qualify."""
    candidates = []
    if not isinstance(releases, list):
        return None
    for release in releases:
        if not isinstance(release, dict) or release.get("draft") is not False or release.get("prerelease") is not False:
            continue
        tag = release.get("tag_name")
        if not isinstance(tag, str) or not tag.startswith("android-v"):
            continue
        version = tag[9:]
        key = version_key(version)
        if key is None:
            continue
        base = f"https://github.com/{REPOSITORY}/releases/download/{tag}/"
        assets = release.get("assets")
        if not isinstance(assets, list):
            continue
        official = {
            asset["name"]: asset for asset in assets
            if isinstance(asset, dict) and isinstance(asset.get("name"), str)
            and asset.get("state") == "uploaded"
            and asset.get("browser_download_url") == base + asset["name"]
            and type(asset.get("size")) is int and asset["size"] > 0
        }
        apk = official.get("Lektrus-Android.apk")
        if not apk or "Lektrus-Android.apk.sha256" not in official:
            continue
        candidates.append((key, {
            "version": version, "download_url": base + "Lektrus-Android.apk",
            "size_bytes": apk["size"],
        }))
    return max(candidates, key=lambda candidate: candidate[0])[1] if candidates else None


def apply_policy(release, minimum):
    """Never require a version that has not actually been published."""
    latest = version_key(release["version"])
    floor = version_key(minimum)
    if floor is None or floor > latest:
        minimum = DEFAULT_MINIMUM
    return {**release, "minimum_version": minimum}


def fetch_releases():
    request = Request(RELEASES, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "Lektrus-Android-Update-Catalog",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    with urlopen(request, timeout=4) as response:
        raw = response.read(2_000_001)
    if len(raw) > 2_000_000:
        raise ValueError("Release catalog too large")
    return json.loads(raw)


class AndroidUpdateCatalog:
    def __init__(self, loader=fetch_releases, clock=time.monotonic):
        self.loader = loader
        self.clock = clock
        self.cached = None
        self.refresh_after = 0
        self.lock = asyncio.Lock()

    async def get(self):
        async with self.lock:
            if self.clock() >= self.refresh_after:
                try:
                    self.cached = select_android_release(await asyncio.to_thread(self.loader))
                except (OSError, ValueError, TypeError):
                    self.cached = None
                self.refresh_after = self.clock() + (300 if self.cached else 60)
            if self.cached is None:
                raise HTTPException(503, "Каталог обновлений временно недоступен")
            minimum = os.getenv("LEKTRUS_ANDROID_MINIMUM_VERSION", DEFAULT_MINIMUM).strip()
            return apply_policy(self.cached, minimum)


router = APIRouter()
catalog = AndroidUpdateCatalog()


@router.get("/api/v1/mobile/android-update")
async def android_update(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return await catalog.get()
