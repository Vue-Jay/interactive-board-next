"""Public, cached catalog of actually published, signed Android releases."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from http.client import HTTPException as HTTPProtocolError
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen

from fastapi import APIRouter, HTTPException, Response

REPOSITORY = "Vue-Jay/interactive-board-next"
RELEASES = f"https://api.github.com/repos/{REPOSITORY}/releases?per_page=20"
LATEST_RELEASE = f"https://api.github.com/repos/{REPOSITORY}/releases/latest"
PUBLIC_RELEASES = f"https://github.com/{REPOSITORY}/releases/"
ASSET_NAMES = ("Lektrus-Android.apk", "Lektrus-Android.apk.sha256")
ASSET_HOSTS = {"release-assets.githubusercontent.com", "objects.githubusercontent.com"}
RESPONSE_DEADLINE = 5.0  # Older native clients time out at 6.5 seconds.
VERSION = re.compile(r"(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})")
DEFAULT_MINIMUM = "1.0.0"
logger = logging.getLogger(__name__)
# Verified public, signed release with both APK and SHA-256 assets uploaded.
# Cold starts can still offer this known release during GitHub outages. It is
# not a substitute for the live catalog, which discovers every newer release.
LAST_VERIFIED_RELEASE = {
    "version": "1.0.4710",
    "download_url": f"https://github.com/{REPOSITORY}/releases/download/android-v1.0.4710/Lektrus-Android.apk",
    "size_bytes": 14_728_878,
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


def fetch_api_json(url):
    request = Request(url, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "Lektrus-Android-Update-Catalog",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    with urlopen(request, timeout=3) as response:
        raw = response.read(2_000_001)
    if len(raw) > 2_000_000:
        raise ValueError("Release catalog too large")
    return json.loads(raw)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def head_asset(url, opener):
    request = Request(url, method="HEAD", headers={"User-Agent": "Lektrus-Android-Update-Catalog"})
    try:
        response = opener.open(request, timeout=3)
    except HTTPError as error:
        response = error  # Inspect the status and Location, without following it.
    with response:
        return response.status, response.headers


def public_asset(name, head):
    """Resolve the official latest link, validating every redirect; never GET the APK."""
    latest = PUBLIC_RELEASES + "latest/download/" + name
    status, headers = head(latest)
    if status not in (301, 302, 303, 307, 308):
        raise ValueError("Official latest asset did not redirect")
    tagged = headers.get("Location", "")
    match = re.fullmatch(re.escape(PUBLIC_RELEASES + "download/android-v") +
                         r"([^/]+)/" + re.escape(name), tagged)
    if not match or version_key(match[1]) is None:
        raise ValueError("Invalid official Android tag")
    version = match[1]
    status, headers = head(tagged)
    redirected_to_asset = False
    for _ in range(3):
        if status not in (301, 302, 303, 307, 308):
            break
        raw_location = headers.get("Location", "")
        location = urlsplit(raw_location)
        if (location.scheme != "https" or location.hostname not in ASSET_HOSTS or
                location.username or location.password or location.port not in (None, 443)):
            raise ValueError("Unofficial Android asset host")
        redirected_to_asset = True
        status, headers = head(raw_location)
    if status != 200 or not redirected_to_asset:
        raise ValueError("Official Android asset unavailable")
    size = int(headers.get("Content-Length", "0"))
    if size <= 0 or (name.endswith(".sha256") and size > 1024):
        raise ValueError("Invalid official Android asset length")
    return version, {"name": name, "browser_download_url": tagged, "state": "uploaded", "size": size}


def fetch_public_release():
    # The public GitHub release download route does not use the REST API quota.
    # Both asset URLs must resolve to the same stable tag (including publication races).
    def fetch(name):
        opener = build_opener(NoRedirect())
        return public_asset(name, lambda url: head_asset(url, opener))

    with ThreadPoolExecutor(max_workers=2) as pool:
        apk, checksum = pool.map(fetch, ASSET_NAMES)
    if apk[0] != checksum[0]:
        raise ValueError("Android assets refer to different releases")
    return [{"tag_name": "android-v" + apk[0], "draft": False, "prerelease": False,
             "assets": [apk[1], checksum[1]]}]


def fetch_releases():
    try:
        # One small release record is sufficient for routine checks. If another
        # platform is marked latest, search the full list for Android releases.
        try:
            latest = fetch_api_json(LATEST_RELEASE)
        except HTTPError as error:
            if error.code != 404:
                raise
            # A missing latest release is not evidence of an outage: distinguish
            # an actually empty catalog before offering a previously known APK.
            latest = None
        if select_android_release([latest]):
            return [latest]
        releases = fetch_api_json(RELEASES)
        if not isinstance(releases, list):
            raise ValueError("Invalid release catalog")
        return releases
    except (OSError, ValueError, TypeError, HTTPProtocolError) as error:
        logger.warning("Android REST catalog unavailable: %s%s", type(error).__name__,
                       f" HTTP {error.code}" if isinstance(error, HTTPError) else "")
        return fetch_public_release()


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
        self.refresh_task = None

    async def refresh(self):
        try:
            releases = await asyncio.to_thread(self.loader)
            if not isinstance(releases, list):
                raise ValueError("Invalid release catalog")
            self.cached = select_android_release(releases)
            self.known_empty = self.cached is None
            self.stale = False
            self.refresh_after = self.clock() + (300 if self.cached else 60)
        except (OSError, ValueError, TypeError, HTTPProtocolError) as error:
            logger.warning("Android release catalog refresh failed: %s", type(error).__name__)
            self.stale = True
            self.refresh_after = self.clock() + 60

    async def get(self):
        async with self.lock:
            if self.clock() >= self.refresh_after:
                if self.refresh_task is None or self.refresh_task.done():
                    self.refresh_task = asyncio.create_task(self.refresh())
                task = self.refresh_task
            else:
                task = None
        timed_out = False
        if task is not None:
            try:
                # A slow upstream must not allow the native request to time out.
                # Keep one shared refresh running so the next check gets new data.
                await asyncio.wait_for(asyncio.shield(task), RESPONSE_DEADLINE)
            except asyncio.TimeoutError:
                timed_out = True
        release = self.cached or (None if self.known_empty else self.fallback)
        if release is None:
            raise HTTPException(503, "Каталог обновлений временно недоступен")
        minimum = os.getenv("LEKTRUS_ANDROID_MINIMUM_VERSION", DEFAULT_MINIMUM).strip()
        result = apply_policy(release, minimum)
        if self.stale or timed_out:
            result["catalog_stale"] = True
        return result


router = APIRouter()
catalog = AndroidUpdateCatalog(fallback=LAST_VERIFIED_RELEASE)


@router.get("/api/v1/mobile/android-update")
async def android_update(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return await catalog.get()
