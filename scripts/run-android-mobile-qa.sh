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
  for package in com.android.chrome com.google.android.webview com.android.webview; do
    echo "WebView candidate: $package"
    adb shell dumpsys package "$package" | grep -E 'versionName=|versionCode=' || true
  done
  sha256sum "$apk"
} > "$out/android-runtime-version.txt" 2>&1
free -m > "$out/host-memory-before.txt"
adb shell cat /proc/meminfo > "$out/guest-memory-before.txt"
# Suppress only isolated-emulator background ANRs; foreground app ANRs
# remain visible and are still functional failures.
adb shell settings put global anr_show_background 0
adb install -r "$apk"
if [ "$actual_api" -lt 30 ]; then
  export LEKTRUS_QA_LEGACY_WEBVIEW=1
  # Android 7 can start Appium Settings but the driver's legacy ps-based
  # readiness check does not always find it. The emulator is already booted.
  if [ "$actual_api" -lt 26 ]; then
    export LEKTRUS_QA_SKIP_DEVICE_INIT=1
  fi
  # Establish independent native launch evidence before starting automation.
  adb shell am start -W -n ru.lektrus.board.dev/ru.lektrus.board.MainActivity > "$out/native-launch.txt"
  sleep 8
  adb shell dumpsys window > "$out/native-launch-window.txt"
  adb exec-out screencap -p > "$out/native-launch.png"
  adb shell am force-stop ru.lektrus.board.dev
  # Official 2.42 supports Chrome 68–70 but reports JSON Wire status; the
  # isolated adapter translates only its actual successful readiness reply.
  # Leave newer engines on autodetection.
  chrome_version=$(adb shell dumpsys package com.android.chrome | sed -n 's/^[[:space:]]*versionName=\([0-9]*\).*/\1/p' | head -1 | tr -d '\r')
  if [ "$actual_api" -lt 29 ] && [ "$chrome_version" = 69 ]; then
    mkdir -p "$RUNNER_TEMP/legacy-chromedriver"
    curl --fail --silent --show-error --location --retry 3 https://chromedriver.storage.googleapis.com/2.42/chromedriver_linux64.zip -o "$RUNNER_TEMP/legacy-chromedriver/driver.zip"
    unzip -oq "$RUNNER_TEMP/legacy-chromedriver/driver.zip" -d "$RUNNER_TEMP/legacy-chromedriver"
    export LEKTRUS_QA_REAL_CHROMEDRIVER="$RUNNER_TEMP/legacy-chromedriver/chromedriver"
    chmod +x scripts/legacy-chromedriver-adapter.mjs
    export LEKTRUS_QA_CHROMEDRIVER="$PWD/scripts/legacy-chromedriver-adapter.mjs"
    "$LEKTRUS_QA_CHROMEDRIVER" --version
  fi
fi
adb logcat -v threadtime -b all > "$out/android-logcat.txt" 2>&1 &
logcat_pid=$!
"$RUNNER_TEMP/appium/node_modules/.bin/appium" --address 127.0.0.1 --port 4723 \
  --allow-insecure=uiautomator2:chromedriver_autodownload > "$out/appium.log" 2>&1 &
appium_pid=$!
trap 'kill "$logcat_pid" "$appium_pid" 2>/dev/null || true' EXIT

qa_result=0
python3 scripts/test-native-mobile-runtime.py android --suite "$suite" --app "$apk" --output "$out" || qa_result=$?
if [ "$qa_result" -ne 0 ]; then
  timeout 10s adb shell ps > "$out/android-processes-after.txt" 2>&1 || true
  timeout 20s adb shell dumpsys activity exit-info ru.lektrus.board.dev > "$out/android-exit-info.txt" 2>&1 || true
  free -m > "$out/host-memory-after.txt"
  timeout 10s adb shell cat /proc/meminfo > "$out/guest-memory-after.txt" 2>&1 || true
  sudo dmesg --color=never | grep -Ei 'oom|out of memory|killed process|segfault|qemu|emulator|kvm' > "$out/host-emulator-kernel.txt" || true
fi
exit "$qa_result"
