#!/usr/bin/env bash
set -euo pipefail

# The emulator action executes its script input as individual shell commands.
# Keep the session, process IDs, diagnostics and real exit status in one shell.
suite=${1:?Expected native QA suite}
expected_api=${2:-}
apk="$PWD/android/app/build/outputs/apk/debug/app-debug.apk"
out="$PWD/artifacts/mobile-qa"
mkdir -p "$out"
actual_api=$(adb shell getprop ro.build.version.sdk | tr -d '\r')
if [ -n "$expected_api" ] && [ "$actual_api" != "$expected_api" ]; then
  echo "Expected Android API $expected_api, got $actual_api" >&2
  exit 1
fi
{
  echo "Android API: $actual_api"
  adb shell getprop ro.build.version.release
  adb shell getprop ro.build.fingerprint
  adb shell dumpsys webviewupdate || true
  sha256sum "$apk"
} > "$out/android-runtime-version.txt" 2>&1
free -m > "$out/host-memory-before.txt"
adb shell cat /proc/meminfo > "$out/guest-memory-before.txt"
# Suppress only isolated-emulator background ANRs; foreground app ANRs
# remain visible and are still functional failures.
adb shell settings put global anr_show_background 0
adb install -r "$apk"
adb logcat -v threadtime -b all > "$out/android-logcat.txt" 2>&1 &
logcat_pid=$!
"$RUNNER_TEMP/appium/node_modules/.bin/appium" --address 127.0.0.1 --port 4723 \
  --allow-insecure=uiautomator2:chromedriver_autodownload > "$out/appium.log" 2>&1 &
appium_pid=$!
trap 'kill "$logcat_pid" "$appium_pid" 2>/dev/null || true' EXIT

qa_result=0
python3 scripts/test-native-mobile-runtime.py android --suite "$suite" --app "$apk" --output "$out" || qa_result=$?
if [ "$qa_result" -ne 0 ]; then
  timeout 20s adb shell dumpsys activity exit-info ru.lektrus.board.dev > "$out/android-exit-info.txt" 2>&1 || true
  free -m > "$out/host-memory-after.txt"
  timeout 10s adb shell cat /proc/meminfo > "$out/guest-memory-after.txt" 2>&1 || true
  sudo dmesg --color=never | grep -Ei 'oom|out of memory|killed process|segfault|qemu|emulator|kvm' > "$out/host-emulator-kernel.txt" || true
fi
exit "$qa_result"
