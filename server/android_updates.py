"""Public, cached catalog of actually published, signed Android releases."""
from __future__ import annotations

import asyncio
import hashlib
import shutil
import tempfile
import threading
from pathlib import Path
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
from fastapi.responses import FileResponse

REPOSITORY = "Vue-Jay/interactive-board-next"
RELEASES = f"https://api.github.com/repos/{REPOSITORY}/releases?per_page=20"
LATEST_RELEASE = f"https://api.github.com/repos/{REPOSITORY}/releases/latest"
PUBLIC_RELEASES = f"https://github.com/{REPOSITORY}/releases/"
ASSET_NAMES = ("Lektrus-Android.apk", "Lektrus-Android.apk.sha256")
ASSET_HOSTS = {"release-assets.githubusercontent.com", "objects.githubusercontent.com"}
RESPONSE_DEADLINE = 5.0  # Older native clients time out at 6.5 seconds.
CATALOG_TTL = 120  # Bound publication latency without exhausting the REST quota.
MIRROR_POLL = 60
VERSION = re.compile(r"(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})")
DEFAULT_MINIMUM = "1.0.0"
logger = logging.getLogger(__name__)
# Verified public, signed release with both APK and SHA-256 assets uploaded.
# Cold starts can still offer this known release during GitHub outages. It is
# not a substitute for the live catalog, which discovers every newer release.
LAST_VERIFIED_RELEASE = {
    "version": "1.0.4852",
    "download_url": f"https://github.com/{REPOSITORY}/releases/download/android-v1.0.4852/Lektrus-Android.apk",
    "size_bytes": 15_116_332,
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


def fetch_releases(known_version=None):
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
        candidate = select_android_release([latest])
        floor = version_key(known_version)
        if candidate and (floor is None or version_key(candidate["version"]) >= floor):
            return [latest]
        # GitHub's "latest" can lag a newly published release or point at an
        # older tag. Compare the full catalog before accepting a downgrade.
        releases = fetch_api_json(RELEASES)
        if not isinstance(releases, list):
            raise ValueError("Invalid release catalog")
        selected = select_android_release(releases)
        if selected and floor and version_key(selected["version"]) < floor:
            public = fetch_public_release()
            public_selected = select_android_release(public)
            if not public_selected:
                raise ValueError("Cannot independently confirm older Android catalog")
            # Both sources may legitimately agree after a release withdrawal.
            return releases + public
        return releases
    except (OSError, ValueError, TypeError, HTTPProtocolError) as error:
        logger.warning("Android REST catalog unavailable: %s%s", type(error).__name__,
                       f" HTTP {error.code}" if isinstance(error, HTTPError) else "")
        return fetch_public_release()


class AndroidUpdateCatalog:
    def __init__(self, loader=None, clock=time.monotonic, fallback=None):
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
            known = self.cached or self.fallback
            if self.loader is None:
                releases = await asyncio.to_thread(fetch_releases, known["version"] if known else None)
            else:
                releases = await asyncio.to_thread(self.loader)
            if not isinstance(releases, list):
                raise ValueError("Invalid release catalog")
            self.cached = select_android_release(releases)
            self.known_empty = self.cached is None
            self.stale = False
            self.refresh_after = self.clock() + (CATALOG_TTL if self.cached else 60)
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
    return await site_release()


# The public download is served as bytes by Lektrus, never redirected to GitHub.
# One bounded, checksum-verified mirror is shared by all users and survives
# Amvera rebuilds. The release catalog and immutable signed CI artifacts remain
# the source of truth; legacy updater clients keep their original JSON contract.
APK_LIMIT = 100 * 1024 * 1024
CHECKSUM = re.compile(r"([a-fA-F0-9]{64})[ \t]+\*?Lektrus-Android\.apk\s*")
mirror_lock = threading.RLock()


def release_directory():
    return Path(os.getenv("LEKTRUS_ANDROID_RELEASE_DIR",
                          str(Path(os.getenv("LEKTRUS_ASSETS_DIR", "/srv/lektrus-assets")) / ".android-releases")))


def open_release_asset(url):
    opener = build_opener(NoRedirect())
    for _ in range(5):
        parsed = urlsplit(url)
        if (parsed.scheme != "https" or parsed.hostname not in ASSET_HOSTS | {"github.com"}
                or parsed.username or parsed.password or parsed.port not in (None, 443)):
            raise ValueError("Unofficial release asset host")
        try:
            response = opener.open(Request(url, headers={"User-Agent": "Lektrus-APK-Mirror"}), timeout=20)
        except HTTPError as error:
            if error.code not in (301, 302, 303, 307, 308):
                raise
            with error:
                url = error.headers.get("Location", "")
            continue
        if response.status != 200:
            response.close()
            raise ValueError("Release asset unavailable")
        return response
    raise ValueError("Too many release redirects")


def cached_release(folder, version):
    apk = folder / version / ASSET_NAMES[0]
    checksum = folder / version / ASSET_NAMES[1]
    try:
        size = apk.stat().st_size
        if not 0 < size <= APK_LIMIT or checksum.stat().st_size > 1024:
            return None
        if not CHECKSUM.fullmatch(checksum.read_text(encoding="ascii").strip()):
            return None
        return apk, checksum, size
    except (OSError, UnicodeError):
        return None


def prune_release_cache(root, current_version):
    """Retain the current complete APK and at most one earlier complete APK."""
    complete = sorted(
        (entry.name for entry in root.iterdir()
         if not entry.is_symlink() and entry.is_dir() and version_key(entry.name)
         and cached_release(root, entry.name)),
        key=version_key, reverse=True,
    )
    # A request racing a new catalog refresh cannot evict a newer mirror.
    current = max([current_version, *complete], key=version_key)
    previous = next((version for version in complete if version_key(version) < version_key(current)), None)
    keep = {current, previous}
    for entry in root.iterdir():
        if entry.name in keep or not version_key(entry.name) or entry.is_symlink() or not entry.is_dir():
            continue
        try:
            shutil.rmtree(entry)
        except OSError as error:
            logger.warning("Cannot remove obsolete Android APK %s: %s", entry.name, type(error).__name__)
    return keep


def mirror_release(release, root=None, opener=open_release_asset):
    version = release["version"]
    size = release["size_bytes"]
    if version_key(version) is None or type(size) is not int or not 0 < size <= APK_LIMIT:
        raise ValueError("Invalid Android release")
    base = PUBLIC_RELEASES + "download/android-v" + version + "/"
    if release["download_url"] != base + ASSET_NAMES[0]:
        raise ValueError("Invalid Android release source")
    root = Path(root) if root is not None else release_directory()
    with mirror_lock:
        existing = cached_release(root, version)
        if existing and existing[2] == size:
            if version not in prune_release_cache(root, version):
                raise ValueError("Android APK superseded")
            return existing
        target = root / version
        target.mkdir(parents=True, exist_ok=True, mode=0o700)
        # Read and verify the small checksum before transferring the APK.
        with opener(base + ASSET_NAMES[1]) as source:
            raw = source.read(1025)
        if len(raw) > 1024:
            raise ValueError("Oversized APK checksum")
        match = CHECKSUM.fullmatch(raw.decode("ascii").strip())
        if not match:
            raise ValueError("Malformed APK checksum")
        expected = match[1].lower()
        digest = hashlib.sha256()
        count = 0
        with tempfile.TemporaryDirectory(prefix=".partial-", dir=target) as temp:
            partial = Path(temp) / ASSET_NAMES[0]
            with opener(base + ASSET_NAMES[0]) as source, partial.open("wb") as output:
                while chunk := source.read(256 * 1024):
                    count += len(chunk)
                    if count > size or count > APK_LIMIT:
                        raise ValueError("Unexpected APK length")
                    digest.update(chunk)
                    output.write(chunk)
            if count != size or digest.hexdigest() != expected:
                raise ValueError("APK checksum or size mismatch")
            sidecar = Path(temp) / ASSET_NAMES[1]
            sidecar.write_text(expected + "  " + ASSET_NAMES[0] + "\n", encoding="ascii")
            # Publish only complete verified files; failed downloads never replace
            # an existing good version. The current release is always retained.
            os.replace(partial, target / ASSET_NAMES[0])
            os.replace(sidecar, target / ASSET_NAMES[1])
        if version not in prune_release_cache(root, version):
            raise ValueError("Android APK superseded")
        return target / ASSET_NAMES[0], target / ASSET_NAMES[1], size


def newest_mirrored_release():
    root = release_directory()
    try:
        versions = sorted((p.name for p in root.iterdir() if p.is_dir() and version_key(p.name)),
                          key=version_key, reverse=True)
    except OSError:
        return None
    for version in versions:
        found = cached_release(root, version)
        if found:
            return {"version": version,
                    "download_url": PUBLIC_RELEASES + "download/android-v" + version + "/" + ASSET_NAMES[0],
                    "size_bytes": found[2]}
    return None


def previous_published_release(current_version, releases):
    """Find the preceding complete stable release, even if versions were skipped."""
    current = version_key(current_version)
    if current is None or not isinstance(releases, list):
        raise ValueError("Invalid Android release history")
    candidates = [select_android_release([entry]) for entry in releases]
    earlier = [entry for entry in candidates
               if entry and version_key(entry["version"]) < current]
    return max(earlier, key=lambda entry: version_key(entry["version"]), default=None)


def synchronize_release_pair(release, root=None, opener=open_release_asset, loader=None):
    """Populate both current and previous published versions, including on a cold disk."""
    root = Path(root) if root is not None else release_directory()
    # Never delete the old pair until the new current APK is fully verified.
    mirror_release(release, root=root, opener=opener)
    previous = previous_published_release(
        release["version"], loader() if loader is not None else fetch_api_json(RELEASES))
    if previous:
        mirror_release(previous, root=root, opener=opener)
    return previous["version"] if previous else None


async def run_android_release_mirror():
    """Warm the dedicated persistent Amvera cache without delaying app startup."""
    synced_version = None
    previous_version = None
    while True:
        try:
            release = await site_release()
            root = release_directory()
            version = release["version"]
            if not release.get("catalog_stale"):
                if (version != synced_version or not cached_release(root, version)
                        or (previous_version and not cached_release(root, previous_version))):
                    previous_version = await asyncio.to_thread(synchronize_release_pair, release)
                    synced_version = version
            elif not cached_release(root, version):
                # During an upstream outage, do not guess the preceding version.
                await asyncio.to_thread(mirror_release, release)
        except (HTTPException, OSError, ValueError, UnicodeError, HTTPProtocolError) as error:
            logger.warning("Android APK mirror sync deferred: %s", type(error).__name__)
        await asyncio.sleep(MIRROR_POLL)


async def site_release():
    release = await catalog.get()
    if release.get("catalog_stale"):
        local = await asyncio.to_thread(newest_mirrored_release)
        if local and version_key(local["version"]) > version_key(release["version"]):
            release = {**apply_policy(local, os.getenv("LEKTRUS_ANDROID_MINIMUM_VERSION", DEFAULT_MINIMUM).strip()),
                       "catalog_stale": True}
    return release


@router.api_route("/api/v1/mobile/android-apk/{version}/{filename}", methods=["GET", "HEAD"])
async def android_apk(version: str, filename: str):
    if filename not in ASSET_NAMES or (version != "latest" and version_key(version) is None):
        raise HTTPException(404, "Файл не найден")
    release = await site_release()
    try:
        if version != "latest" and version != release["version"]:
            # A client can fetch the checksum just before a newer publication.
            # Allow the retained, already verified previous APK, never fetch an
            # arbitrary requested version or evict the current mirror.
            previous = await asyncio.to_thread(cached_release, release_directory(), version)
            if not previous or version_key(version) >= version_key(release["version"]):
                raise HTTPException(409, "Версия изменилась. Проверьте обновления ещё раз.")
            apk, checksum, _ = previous
        else:
            apk, checksum, _ = await asyncio.to_thread(mirror_release, release)
    except (OSError, ValueError, UnicodeError, HTTPProtocolError) as error:
        logger.warning("Android APK mirror unavailable: %s", type(error).__name__)
        raise HTTPException(503, "APK временно недоступен. Повторите попытку.") from None
    return FileResponse(apk if filename == ASSET_NAMES[0] else checksum,
                        media_type="application/vnd.android.package-archive" if filename == ASSET_NAMES[0] else "text/plain",
                        filename=filename, headers={"Cache-Control": "no-cache" if version == "latest" else "public, max-age=86400, immutable",
                                                    "X-Content-Type-Options": "nosniff"})
