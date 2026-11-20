"""Public, cached catalog of actually published, signed Android releases."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Response

REPOSITORY = "Vue-Jay/interactive-board-next"
RELEASES = f"https://api.github.com/repos/{REPOSITORY}/releases?per_page=20"
VERSION = re.compile(r"(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})")
DEFAULT_MINIMUM = "1.0.0"
logger = logging.getLogger(__name__)
# Verified public, signed release with both APK and SHA-256 assets uploaded.
# Cold starts can still offer this known release during GitHub outages. It is
# not a substitute for the live catalog, which discovers every newer release.
LAST_VERIFIED_RELEASE = {
    "version": "1.0.4706",
    "download_url": f"https://github.com/{REPOSITORY}/releases/download/android-v1.0.4706/Lektrus-Android.apk",
    "size_bytes": 14_727_547,
}


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
    def __init__(self, loader=fetch_releases, clock=time.monotonic, fallback=None):
        self.loader = loader
        self.clock = clock
        self.cached = None
        self.fallback = fallback
        self.known_empty = False
        self.stale = False
        self.refresh_after = 0
        self.lock = asyncio.Lock()

    async def get(self):
        async with self.lock:
            if self.clock() >= self.refresh_after:
                try:
                    releases = await asyncio.to_thread(self.loader)
                    if not isinstance(releases, list):
                        raise ValueError("Invalid release catalog")
                    self.cached = select_android_release(releases)
                    self.known_empty = self.cached is None
                    self.stale = False
                    self.refresh_after = self.clock() + (300 if self.cached else 60)
                except (OSError, ValueError, TypeError) as error:
                    # A failed refresh is not evidence that a published release
                    # disappeared. Keep the last confirmed entry and retry soon.
                    logger.warning("Android release catalog refresh failed: %s", type(error).__name__)
                    self.stale = True
                    self.refresh_after = self.clock() + 60
            release = self.cached or (None if self.known_empty else self.fallback)
            if release is None:
                raise HTTPException(503, "Каталог обновлений временно недоступен")
            minimum = os.getenv("LEKTRUS_ANDROID_MINIMUM_VERSION", DEFAULT_MINIMUM).strip()
            result = apply_policy(release, minimum)
            if self.stale:
                result["catalog_stale"] = True
            return result


router = APIRouter()
catalog = AndroidUpdateCatalog(fallback=LAST_VERIFIED_RELEASE)


@router.get("/api/v1/mobile/android-update")
async def android_update(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return await catalog.get()
