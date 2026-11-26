"""Verify the official site's actual post-publication update delivery.

Only public read-only requests. The same signed APK tested in CI is the
expected byte source; never accept an older catalog, a redirect or an HTML
download page. A deployed build marker is checked separately.
"""
import argparse
import hashlib
import io
import json
import re
import time
from pathlib import Path
from urllib.request import HTTPRedirectHandler, Request, build_opener

ORIGIN = "https://lektrus.ru"
APK_NAME = "Lektrus-Android.apk"
MAX_APK = 100 * 1024 * 1024


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def open_site(path):
    if not path.startswith("/") or path.startswith("//"):
        raise ValueError("Invalid site path")
    url = ORIGIN + path
    response = build_opener(NoRedirect()).open(
        Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "Lektrus-release-verify/1"}),
        timeout=30,
    )
    if response.status != 200 or response.geturl() != url:
        response.close()
        raise ValueError("Unexpected response from official site")
    return response


def read_small(open_path, path):
    with open_path(path) as response:
        payload = response.read(65537)
        if len(payload) > 65536:
            raise ValueError("Oversized metadata")
        return payload


def stream_digest(source, expected_size):
    digest = hashlib.sha256()
    size = 0
    while True:
        block = source.read(256 * 1024)
        if not block:
            break
        size += len(block)
        if size > expected_size:
            raise ValueError("APK exceeds expected size")
        digest.update(block)
    if size != expected_size:
        raise ValueError("Incorrect APK size")
    return digest.hexdigest()


def verify_site(version, size, sha, marker, open_path=open_site):
    if not re.fullmatch(r"1\.0\.[0-9]+", version) or not 0 < size <= MAX_APK:
        raise ValueError("Invalid expected release")
    deployed = json.loads(read_small(open_path, "/deployment-check.json"))
    if deployed != marker:
        raise ValueError("New web deployment marker is not visible yet")
    health = json.loads(read_small(open_path, "/api/v1/health"))
    if health.get("ok") is not True:
        raise ValueError("Production API is not healthy")
    catalog = json.loads(read_small(open_path, "/api/v1/mobile/android-update"))
    if catalog.get("version") != version or catalog.get("catalog_stale") is True or catalog.get("size_bytes") != size:
        raise ValueError(f"Unexpected live catalog version/size: {catalog.get('version')}/{catalog.get('size_bytes')}")
    prefix = "/api/v1/mobile/android-apk/" + version + "/"
    checksum = read_small(open_path, prefix + APK_NAME + ".sha256").decode("ascii").strip()
    if not re.fullmatch(re.escape(sha) + r"[ \t]+\*?" + re.escape(APK_NAME), checksum):
        raise ValueError("Live checksum differs from signed artifact")
    with open_path(prefix + APK_NAME) as apk:
        if stream_digest(apk, size) != sha:
            raise ValueError("Live APK differs from the signed artifact")
    print(f"Verified deployed marker {marker['marker']}; healthy API; catalog {version}; {size} bytes; SHA-256 {sha}", flush=True)


def self_test():
    version = "1.0.4853"
    raw = b"test APK bytes"
    sha = hashlib.sha256(raw).hexdigest()
    marker = {"marker": "test"}
    prefix = "/api/v1/mobile/android-apk/" + version + "/"
    payloads = {
        "/deployment-check.json": json.dumps(marker).encode(),
        "/api/v1/health": b'{"ok":true}',
        "/api/v1/mobile/android-update": json.dumps({"version": version, "size_bytes": len(raw)}).encode(),
        prefix + APK_NAME + ".sha256": (sha + "  " + APK_NAME + "\n").encode(),
        prefix + APK_NAME: raw,
    }
    def open_mock(path):
        return io.BytesIO(payloads[path])
    verify_site(version, len(raw), sha, marker, open_mock)
    for path, replacement in (
        ("/deployment-check.json", b'{"marker":"old"}'),
        ("/api/v1/health", b'{"ok":false}'),
        ("/api/v1/mobile/android-update", b'{"version":"1.0.4852"}'),
        ("/api/v1/mobile/android-update", json.dumps({"version": version, "size_bytes": len(raw), "catalog_stale": True}).encode()),
        (prefix + APK_NAME + ".sha256", b"incorrect"),
        (prefix + APK_NAME, b"x" * len(raw)),
        (prefix + APK_NAME, b"short"),
    ):
        original = payloads[path]
        payloads[path] = replacement
        try:
            verify_site(version, len(raw), sha, marker, open_mock)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid deployment accepted")
        finally:
            payloads[path] = original
    print("Release delivery verification self-test passed", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--version")
    parser.add_argument("--apk", type=Path)
    parser.add_argument("--marker", type=Path)
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.version or not args.apk or not args.marker:
        parser.error("version, apk and marker required")
    size = args.apk.stat().st_size
    with args.apk.open("rb") as source:
        sha = stream_digest(source, size)
    marker = json.loads(args.marker.read_text(encoding="utf-8"))
    deadline = time.monotonic() + 420
    while True:
        try:
            verify_site(args.version, size, sha, marker)
            return
        except (OSError, ValueError, UnicodeError) as error:
            if time.monotonic() >= deadline:
                raise RuntimeError("Published release is not available from the official site") from error
            print(f"Delivery not ready: {type(error).__name__}: {error}", flush=True)
            time.sleep(15)


if __name__ == "__main__":
    main()
