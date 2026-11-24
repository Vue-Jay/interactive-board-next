#!/bin/bash
set -euo pipefail

# Amvera mounts /data at runtime. It can initially be owned by root.
install -d -m 0700 -o lektrus -g lektrus /data/assets
# APK cache is separate from private user attachments and persists across deploys.
if ! install -d -m 0700 -o lektrus -g lektrus /data/android-releases; then
  echo "Android APK cache unavailable" >&2
fi
# Only generated public build files are copied here, never user assets. An
# unavailable/full cache must not prevent the new application from starting.
if install -d -m 0700 -o lektrus -g lektrus /data/web-releases; then
  gosu lektrus python /srv/lektrus/retain_web_assets.py || echo "Public chunk retention unavailable" >&2
fi

gosu lektrus uvicorn app:app --host 127.0.0.1 --port 8000 --workers 1 &
api=$!
gosu lektrus caddy run --config /srv/lektrus/Caddyfile --adapter caddyfile &
proxy=$!

shutdown() {
  kill -TERM "$api" "$proxy" 2>/dev/null || true
  wait "$api" "$proxy" 2>/dev/null || true
}

trap 'shutdown; exit 0' TERM INT
status=0
wait -n "$api" "$proxy" || status=$?
shutdown
exit "$status"
