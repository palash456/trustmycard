#!/usr/bin/env bash
# Run BullMQ worker in background + HTTP API in foreground (budget single-service deploy).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

missing=()
[[ -z "${DATABASE_URL:-}" ]] && missing+=("DATABASE_URL")
[[ -z "${REDIS_URL:-}" ]] && missing+=("REDIS_URL")
if ((${#missing[@]} > 0)); then
  echo "[render] ERROR: Set on tmc-backend in Render dashboard: ${missing[*]}" >&2
  echo "[render]   DATABASE_URL = Neon Postgres connection string" >&2
  echo "[render]   REDIS_URL    = Upstash Redis URL (rediss://...)" >&2
  exit 1
fi

WORKER_PID=""

cleanup() {
  if [[ -n "$WORKER_PID" ]]; then
    kill "$WORKER_PID" 2>/dev/null || true
    wait "$WORKER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT TERM INT

echo "[render] starting collection worker..."
SERVICE_ROLE=worker \
  COLLECTION_SIGNING_ENABLED=true \
  COLLECTION_WORKERS_ENABLED=true \
  node dist/worker.js &
WORKER_PID=$!

echo "[render] starting HTTP API (pid ${WORKER_PID} worker)..."
exec env \
  SERVICE_ROLE=api \
  COLLECTION_SIGNING_ENABLED=false \
  COLLECTION_WORKERS_ENABLED=false \
  node dist/main.js
