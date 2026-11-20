import asyncio
import pytest
from fastapi import HTTPException
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
        return [release("1.0.4710")]

    async def scenario():
        monkeypatch.setenv("LEKTRUS_ANDROID_MINIMUM_VERSION", "1.0.0")
        catalog = AndroidUpdateCatalog(loader=loader, clock=lambda: now[0], fallback=LAST_VERIFIED_RELEASE)
        cold = await catalog.get()
        assert cold["version"] == "1.0.4706" and cold["catalog_stale"] is True
        now[0] = 160
        live = await catalog.get()
        assert live["version"] == "1.0.4710" and "catalog_stale" not in live
        now[0] = 460
        assert (await catalog.get())["version"] == "1.0.4710"
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
