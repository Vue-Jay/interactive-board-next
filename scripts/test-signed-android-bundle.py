"""Prove the signed Android artifact contains the intended web build."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZipFile

MANIFEST = "lektrus-build.json"
PREFIX = "assets/public/"
CAP_GENERATED = {"cordova.js", "cordova_plugins.js"}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def commit_id(value):
    if not re.fullmatch(r"[0-9a-f]{40}", value):
        raise ValueError("Expected full Git commit SHA")
    return value

def check_inventory(files):
    if "index.html" not in files or not any(
        re.fullmatch(r"assets/BoardApp-[^/]+\.js", name) for name in files
    ):
        raise ValueError("Missing application entry or board bundle")
    if any(not name or name.startswith("/") or ".." in name.split("/")
           or not re.fullmatch(r"[0-9a-f]{64}", sha)
           for name, sha in files.items()):
        raise ValueError("Invalid build inventory")

def create_manifest(dist, commit):
    root = Path(dist)
    files = {
        path.relative_to(root).as_posix(): digest(path.read_bytes())
        for path in sorted(root.rglob("*"))
        if path.is_file() and path != root / MANIFEST
    }
    check_inventory(files)
    data = {"commit": commit_id(commit), "files": files}
    (root / MANIFEST).write_text(json.dumps(data, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Recorded {len(files)} web files from {commit}")

def verify(apk, commit, dist=None):
    with ZipFile(apk) as archive:
        names = [name for name in archive.namelist()
                 if name.startswith(PREFIX) and not name.endswith("/")]
        if len(names) != len(set(names)):
            raise ValueError("Duplicate web assets in APK")
        manifest = json.loads(archive.read(PREFIX + MANIFEST))
        if manifest.get("commit") != commit_id(commit):
            raise ValueError("APK was not built from the intended commit")
        files = manifest["files"]
        check_inventory(files)
        actual = {name[len(PREFIX):] for name in names}
        expected = set(files) | {MANIFEST}
        if expected - actual or actual - expected - CAP_GENERATED:
            raise ValueError("Missing or stale web assets inside signed APK")
        if dist is not None:
            root = Path(dist)
            if (root / MANIFEST).read_bytes() != archive.read(PREFIX + MANIFEST):
                raise ValueError("APK manifest differs from the current build")
            disk_files = {path.relative_to(root).as_posix() for path in root.rglob("*")
                          if path.is_file()} - {MANIFEST}
            if disk_files != set(files):
                raise ValueError("Build inventory differs from dist")
        for name, sha in files.items():
            if digest(archive.read(PREFIX + name)) != sha:
                raise ValueError(f"APK asset hash mismatch: {name}")
            if dist is not None and digest((Path(dist) / name).read_bytes()) != sha:
                raise ValueError(f"Build asset hash mismatch: {name}")
        print(f"Verified {len(files)} signed APK web assets from {commit}")

def self_test():
    from tempfile import TemporaryDirectory
    with TemporaryDirectory() as temp:
        root = Path(temp)
        dist = root / "dist"
        (dist / "assets").mkdir(parents=True)
        (dist / "index.html").write_text("entry")
        (dist / "assets/BoardApp-example.js").write_text("live sync")
        commit = "a" * 40
        create_manifest(dist, commit)
        apk = root / "test.apk"
        def pack(changed=None, extra=False):
            with ZipFile(apk, "w") as z:
                for p in dist.rglob("*"):
                    if p.is_file():
                        name = p.relative_to(dist).as_posix()
                        z.writestr(PREFIX + name, b"stale" if name == changed else p.read_bytes())
                z.writestr(PREFIX + "cordova.js", "")
                if extra:
                    z.writestr(PREFIX + "assets/BoardApp-old.js", "old")
        def reject(fn):
            try:
                fn()
            except ValueError:
                return
            raise AssertionError("Invalid APK accepted")
        pack()
        verify(apk, commit, dist)
        verify(apk, commit)
        reject(lambda: verify(apk, "b" * 40))
        pack(changed="assets/BoardApp-example.js")
        reject(lambda: verify(apk, commit))
        pack(extra=True)
        reject(lambda: verify(apk, commit))
        pack()
        (dist / "index.html").write_text("different build")
        reject(lambda: verify(apk, commit, dist))
    print("APK source and asset verification self-test passed")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    make = sub.add_parser("manifest")
    make.add_argument("dist")
    make.add_argument("commit")
    check = sub.add_parser("verify")
    check.add_argument("apk")
    check.add_argument("commit")
    check.add_argument("--dist")
    sub.add_parser("self-test")
    args = parser.parse_args()
    if args.command == "manifest":
        create_manifest(args.dist, args.commit)
    elif args.command == "verify":
        verify(args.apk, args.commit, args.dist)
    else:
        self_test()
