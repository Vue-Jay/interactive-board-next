import asyncio
import threading
from urllib.error import HTTPError
from urllib.parse import urlsplit

import pytest
from fastapi import HTTPException
import android_updates
from android_updates import AndroidUpdateCatalog, LAST_VERIFIED_RELEASE, apply_policy, select_android_release


def release(version, **overrides):
    tag = f"android-v{version}"
    base = f"https://github.com/Vue-Jay/interactive-board-next/releases/download/{tag}/"
    return {
        "tag_name": tag, "draft": False, "prerelease": False,
        "assets": [
            {"name": name, "browser_download_url": base + name, "state": "uploaded", "size": size}
            for name, size in [("Lektrus-Android.apk", 15_000_000), ("Lektrus-Android.apk.sha256", 91)]
        ], **overrides,
    }


def test_only_published_complete_official_releases():
    invalid = release("1.0.5000")
    invalid["assets"][0]["browser_download_url"] = "https://other.example/file.apk"
    selected = select_android_release([
        release("1.0.4669"), release("1.0.99"), release("1.0.4671", draft=True),
        release("1.0.4672", prerelease=True), release("1.0.4673", assets=[]),
        invalid, {"tag_name": "windows-v1.0.9999"}, release("1.0.01"),
    ])
    assert selected["version"] == "1.0.4669"
    assert selected["size_bytes"] == 15_000_000
    assert selected["download_url"].endswith("/android-v1.0.4669/Lektrus-Android.apk")
    assert select_android_release([invalid]) is None


def test_policy_never_requires_unpublished_version():
    selected = select_android_release([release("1.0.4669")])
    assert apply_policy(selected, "1.0.4600")["minimum_version"] == "1.0.4600"
    assert apply_policy(selected, "1.0.4670")["minimum_version"] == "1.0.0"
    assert apply_policy(selected, "invalid")["minimum_version"] == "1.0.0"


def test_skipped_releases_select_newest_complete_apk_directly():
    selected = select_android_release([release("1.0.4691"), release("1.0.4706"),
                                      release("1.0.4710"), release("1.0.4711", draft=True)])
    assert selected["version"] == "1.0.4710"
    assert apply_policy(selected, "1.0.4700")["download_url"].endswith("android-v1.0.4710/Lektrus-Android.apk")


def test_catalog_cache_refresh_and_fail_open(monkeypatch):
    now = [100.0]
    calls = []
    def loader():
        calls.append(now[0])
        if now[0] >= 400:
            raise OSError("upstream unavailable")
        return [release("1.0.4669")]

    async def scenario():
        catalog = AndroidUpdateCatalog(loader=loader, clock=lambda: now[0])
        monkeypatch.setenv("LEKTRUS_ANDROID_MINIMUM_VERSION", "1.0.4600")
        first, second = await asyncio.gather(catalog.get(), catalog.get())
        assert first == second and len(calls) == 1
        assert first["minimum_version"] == "1.0.4600"
        now[0] = 400
        for _ in range(2):
            assert await catalog.get() == {**first, "catalog_stale": True}
        assert len(calls) == 2
    asyncio.run(scenario())


def test_cold_start_fallback_then_live_recovery(monkeypatch):
    now = [100.0]
    def loader():
        if now[0] < 160 or now[0] >= 460:
            raise OSError("upstream unavailable")
        return [release("1.0.4853")]

    async def scenario():
        monkeypatch.setenv("LEKTRUS_ANDROID_MINIMUM_VERSION", "1.0.0")
        catalog = AndroidUpdateCatalog(loader=loader, clock=lambda: now[0], fallback=LAST_VERIFIED_RELEASE)
        cold = await catalog.get()
        assert cold["version"] == LAST_VERIFIED_RELEASE["version"] and cold["catalog_stale"] is True
        now[0] = 160
        live = await catalog.get()
        assert live["version"] == "1.0.4853" and "catalog_stale" not in live
        now[0] = 460
        assert (await catalog.get())["version"] == "1.0.4853"
    asyncio.run(scenario())


def test_latest_api_and_non_android_latest(monkeypatch):
    calls = []
    def load(url):
        calls.append(url)
        if url == android_updates.LATEST_RELEASE:
            return release("1.0.4712")
        pytest.fail("Routine check must not download the full catalog")
    monkeypatch.setattr(android_updates, "fetch_api_json", load)
    assert select_android_release(android_updates.fetch_releases())["version"] == "1.0.4712"
    assert calls == [android_updates.LATEST_RELEASE]
    monkeypatch.setattr(android_updates, "fetch_api_json", lambda url: {"tag_name": "windows-v1"}
                        if url == android_updates.LATEST_RELEASE else [release("1.0.4712")])
    assert select_android_release(android_updates.fetch_releases())["version"] == "1.0.4712"


def test_rate_limited_api_uses_independent_public_source(monkeypatch):
    def limited(url):
        raise HTTPError(url, 429, "Rate limited", {}, None)
    monkeypatch.setattr(android_updates, "fetch_api_json", limited)
    monkeypatch.setattr(android_updates, "fetch_public_release", lambda: [release("1.0.4712")])
    assert select_android_release(android_updates.fetch_releases())["version"] == "1.0.4712"


def test_missing_latest_checks_empty_catalog_before_using_fallback(monkeypatch):
    def load(url):
        if url == android_updates.LATEST_RELEASE:
            raise HTTPError(url, 404, "No latest release", {}, None)
        return []
    monkeypatch.setattr(android_updates, "fetch_api_json", load)
    monkeypatch.setattr(android_updates, "fetch_public_release", lambda: pytest.fail("Catalog is confirmed empty"))
    assert android_updates.fetch_releases() == []


def fake_asset_head(version="1.0.4712", checksum_version=None, CDN="release-assets.githubusercontent.com", missing=False):
    def route(url, opener):
        parsed = urlsplit(url)
        name = parsed.path.rsplit("/", 1)[-1]
        if "/latest/" in url:
            tag = checksum_version if name.endswith(".sha256") and checksum_version else version
            return 302, {"Location": android_updates.PUBLIC_RELEASES + f"download/android-v{tag}/{name}"}
        if parsed.hostname == "github.com":
            return 302, {"Location": f"https://{CDN}/{name}"}
        if missing and name.endswith(".sha256"):
            return 404, {}
        return 200, {"Content-Length": "86" if name.endswith(".sha256") else "14728878"}
    return route


def test_public_source_validates_both_assets(monkeypatch):
    monkeypatch.setattr(android_updates, "head_asset", fake_asset_head())
    selected = select_android_release(android_updates.fetch_public_release())
    assert selected["version"] == "1.0.4712" and selected["size_bytes"] == 14728878


@pytest.mark.parametrize("options", [
    {"checksum_version": "1.0.4713"}, {"CDN": "other.example"}, {"missing": True}, {"version": "invalid"},
])
def test_public_source_rejects_unsafe_or_incomplete_release(monkeypatch, options):
    monkeypatch.setattr(android_updates, "head_asset", fake_asset_head(**options))
    with pytest.raises(ValueError):
        android_updates.fetch_public_release()


def test_head_asset_does_not_download_body():
    class Response:
        status = 200
        headers = {"Content-Length": "14728878"}
        def __enter__(self): return self
        def __exit__(self, *args): pass
    class Opener:
        def open(self, request, timeout):
            assert request.get_method() == "HEAD"
            return Response()
    assert android_updates.head_asset("https://github.com/file.apk", Opener()) == (200, Response.headers)


def test_slow_catalog_returns_cached_immediately_at_deadline_and_refreshes_once(monkeypatch):
    monkeypatch.setattr(android_updates, "RESPONSE_DEADLINE", 0.02)
    release_loader = threading.Event()
    calls = []

    def loader():
        calls.append(True)
        assert release_loader.wait(2)
        return [release("1.0.4712")]

    async def scenario():
        catalog = AndroidUpdateCatalog(loader=loader, fallback=LAST_VERIFIED_RELEASE)
        try:
            first, second = await asyncio.gather(catalog.get(), catalog.get())
            assert first == second and first["catalog_stale"] is True
            assert first["version"] == LAST_VERIFIED_RELEASE["version"]
            assert len(calls) == 1
        finally:
            release_loader.set()
        await catalog.refresh_task
        assert (await catalog.get())["version"] == "1.0.4712"
        assert "catalog_stale" not in await catalog.get()

    asyncio.run(scenario())


def test_empty_successful_catalog_never_offers_removed_release():
    now = [100.0]
    def loader():
        if now[0] >= 160:
            raise OSError("upstream unavailable")
        return []

    async def scenario():
        catalog = AndroidUpdateCatalog(loader=loader, clock=lambda: now[0], fallback=LAST_VERIFIED_RELEASE)
        for moment in (100, 160):
            now[0] = moment
            with pytest.raises(HTTPException) as error:
                await catalog.get()
            assert error.value.status_code == 503
    asyncio.run(scenario())


def test_first_party_mirror_validates_and_reuses_bytes(tmp_path):
    import hashlib
    from io import BytesIO
    data = b"test signed release bytes"
    selected = select_android_release([release("1.0.5001")])
    selected["size_bytes"] = len(data)
    checksum = hashlib.sha256(data).hexdigest()
    calls = []
    def opener(url):
        calls.append(url)
        return BytesIO((checksum + "  Lektrus-Android.apk\n").encode() if url.endswith(".sha256") else data)
    apk, sha, size = android_updates.mirror_release(selected, root=tmp_path, opener=opener)
    assert apk.read_bytes() == data and size == len(data)
    assert sha.read_text().startswith(checksum)
    assert android_updates.mirror_release(selected, root=tmp_path, opener=opener) == (apk, sha, size)
    assert len(calls) == 2
    assert not list(tmp_path.rglob(".partial-*"))


@pytest.mark.parametrize("bad_data", [b"bad", b"wrong same size!"])
def test_first_party_mirror_rejects_corruption(tmp_path, bad_data):
    import hashlib
    from io import BytesIO
    data = b"valid APK bytes!"
    selected = select_android_release([release("1.0.5002")])
    selected["size_bytes"] = len(data)
    checksum = hashlib.sha256(data).hexdigest()
    def opener(url):
        return BytesIO((checksum + "  Lektrus-Android.apk\n").encode() if url.endswith(".sha256") else bad_data)
    with pytest.raises(ValueError):
        android_updates.mirror_release(selected, root=tmp_path, opener=opener)
    assert not list(tmp_path.rglob("*.apk"))


def test_site_serves_apk_not_redirect(tmp_path, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    data = b"APK file"
    apk = tmp_path / "Lektrus-Android.apk"
    checksum = tmp_path / "Lektrus-Android.apk.sha256"
    apk.write_bytes(data)
    checksum.write_text("checksum")
    async def current():
        return {"version": "1.0.5001"}
    monkeypatch.setattr(android_updates, "site_release", current)
    monkeypatch.setattr(android_updates, "mirror_release", lambda release: (apk, checksum, len(data)))
    app = FastAPI()
    app.include_router(android_updates.router)
    client = TestClient(app)
    prefix = "/api/v1/mobile/android-apk/"
    result = client.get(prefix + "latest/Lektrus-Android.apk", follow_redirects=False)
    assert result.status_code == 200 and result.content == data
    assert result.headers["content-type"] == "application/vnd.android.package-archive"
    assert "attachment" in result.headers["content-disposition"]
    assert client.head(prefix + "1.0.5001/Lektrus-Android.apk").headers["content-length"] == str(len(data))
    assert client.get(prefix + "1.0.5001/Lektrus-Android.apk.sha256").text == "checksum"
    assert client.get(prefix + "1.0.4000/Lektrus-Android.apk").status_code == 409
    assert client.get(prefix + "latest/evil.apk").status_code == 404


def test_release_cache_keeps_two_and_only_prunes_after_verified_download(tmp_path):
    import hashlib
    from io import BytesIO
    versions = ["1.0.5001", "1.0.5002", "1.0.5003", "1.0.5004"]
    payloads = {version: ("APK " + version).encode() for version in versions}

    def selected(version):
        result = select_android_release([release(version)])
        result["size_bytes"] = len(payloads[version])
        return result

    def opener(url):
        version = url.split("/android-v")[1].split("/")[0]
        data = payloads[version]
        checksum = hashlib.sha256(data).hexdigest()
        if url.endswith(".sha256"):
            return BytesIO((checksum + "  Lektrus-Android.apk\n").encode())
        return BytesIO(b"broken" if version == versions[-1] else data)

    unrelated = tmp_path / "do-not-delete"
    unrelated.mkdir()
    (unrelated / "sentinel").write_text("keep")
    for version in versions[:3]:
        android_updates.mirror_release(selected(version), root=tmp_path, opener=opener)
    retained = lambda: sorted(p.parent.name for p in tmp_path.glob("*/Lektrus-Android.apk"))
    assert retained() == versions[1:3]
    assert not (tmp_path / versions[0]).exists()
    with pytest.raises(ValueError):
        android_updates.mirror_release(selected(versions[3]), root=tmp_path, opener=opener)
    assert retained() == versions[1:3]
    assert unrelated.joinpath("sentinel").read_text() == "keep"
    # A stale request for an older APK cannot evict either newer verified file.
    with pytest.raises(ValueError, match="superseded"):
        android_updates.mirror_release(selected(versions[0]), root=tmp_path, opener=opener)
    assert retained() == versions[1:3]
    # A cache hit also cleans an obsolete incomplete directory after a failure.
    android_updates.mirror_release(selected(versions[2]), root=tmp_path, opener=opener)
    assert not (tmp_path / versions[3]).exists()


def test_initial_sync_populates_previous_published_version(tmp_path):
    import hashlib
    from io import BytesIO
    current = release("1.0.5010")
    prior = release("1.0.5007")
    older = release("1.0.5001")
    data = b"verified test APK"
    for entry in [current, prior, older]:
        entry["assets"][0]["size"] = len(data)
    requests = []
    def opener(url):
        requests.append(url)
        return BytesIO((hashlib.sha256(data).hexdigest() + "  Lektrus-Android.apk\n").encode()
                       if url.endswith(".sha256") else data)
    history = [older, current, prior, release("1.0.5009", draft=True), release("1.0.5008", assets=[])]
    assert android_updates.synchronize_release_pair(
        select_android_release([current]), root=tmp_path, opener=opener, loader=lambda: history
    ) == "1.0.5007"
    assert sorted(p.parent.name for p in tmp_path.glob("*/Lektrus-Android.apk")) == ["1.0.5007", "1.0.5010"]
    assert len(requests) == 4
    assert all("5001" not in url and "5009" not in url for url in requests)


def test_older_latest_recovers_newer_published_release(monkeypatch):
    calls = []
    def load(url):
        calls.append(url)
        return release("1.0.4849") if url == android_updates.LATEST_RELEASE else [release("1.0.4852"), release("1.0.4849")]
    monkeypatch.setattr(android_updates, "fetch_api_json", load)
    assert select_android_release(android_updates.fetch_releases("1.0.4852"))["version"] == "1.0.4852"
    assert calls == [android_updates.LATEST_RELEASE, android_updates.RELEASES]


def test_older_rest_catalog_checks_independent_public_release(monkeypatch):
    monkeypatch.setattr(android_updates, "fetch_api_json", lambda url: release("1.0.4849")
                        if url == android_updates.LATEST_RELEASE else [release("1.0.4849")])
    monkeypatch.setattr(android_updates, "fetch_public_release", lambda: [release("1.0.4852")])
    assert select_android_release(android_updates.fetch_releases("1.0.4852"))["version"] == "1.0.4852"


def test_fresh_catalog_discovers_release_within_two_minutes():
    now = [100.0]
    version = ["1.0.4849"]
    calls = []
    def loader():
        calls.append(now[0])
        return [release(version[0])]
    async def scenario():
        c = AndroidUpdateCatalog(loader=loader, clock=lambda: now[0])
        assert (await c.get())["version"] == "1.0.4849"
        version[0] = "1.0.4852"
        now[0] += android_updates.CATALOG_TTL - 1
        assert (await c.get())["version"] == "1.0.4849"
        now[0] += 1
        assert (await c.get())["version"] == "1.0.4852"
        assert len(calls) == 2
    asyncio.run(scenario())


def test_previous_verified_apk_survives_catalog_change(tmp_path, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    import hashlib
    from io import BytesIO
    old = select_android_release([release("1.0.4849")])
    raw = b"previous APK"
    old["size_bytes"] = len(raw)
    checksum = hashlib.sha256(raw).hexdigest()
    def opener(url):
        return BytesIO((checksum + "  Lektrus-Android.apk\n").encode() if url.endswith(".sha256") else raw)
    android_updates.mirror_release(old, root=tmp_path, opener=opener)
    monkeypatch.setattr(android_updates, "release_directory", lambda: tmp_path)
    async def current():
        return {"version": "1.0.4852"}
    monkeypatch.setattr(android_updates, "site_release", current)
    def forbidden(_):
        pytest.fail("Previously verified APK must not be downloaded again")
    monkeypatch.setattr(android_updates, "mirror_release", forbidden)
    app = FastAPI()
    app.include_router(android_updates.router)
    client = TestClient(app)
    prefix = "/api/v1/mobile/android-apk/"
    assert client.get(prefix + "1.0.4849/Lektrus-Android.apk").content == raw
    assert client.get(prefix + "1.0.4849/Lektrus-Android.apk.sha256").text.startswith(checksum)
    assert client.get(prefix + "1.0.4848/Lektrus-Android.apk").status_code == 409
