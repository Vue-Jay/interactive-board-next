#!/bin/bash
set -euo pipefail

# Amvera mounts /data at runtime. It can initially be owned by root.
install -d -m 0700 -o lektrus -g lektrus /data/assets

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
