from pathlib import Path

from retain_web_assets import retain


def test_retains_last_three_releases_and_shared_assets(tmp_path: Path):
    web = tmp_path / "web"
    retained = tmp_path / "retained"
    assets = web / "assets"
    assets.mkdir(parents=True)
    for version in range(4):
        (web / "index.html").write_text(f"build {version}")
        for old in assets.iterdir():
            old.unlink()
        (assets / f"index-AbCd123{version}.js").write_text(str(version))
        (assets / "shared-12345678.css").write_text("shared")
        (assets / "not-hashed.js").write_text("not retained")
        retain(web, retained)
    assert {p.name for p in (retained / "assets").iterdir()} == {
        "index-AbCd1231.js", "index-AbCd1232.js", "index-AbCd1233.js", "shared-12345678.css"
    }
    assert len(list((retained / "manifests").glob("*.json"))) == 3
    assert (retained / "assets" / "index-AbCd1231.js").read_text() == "1"
    retain(web, retained)
    assert len(list((retained / "manifests").glob("*.json"))) == 3
