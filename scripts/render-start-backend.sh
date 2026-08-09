#!/usr/bin/env bash
# All-in-one Nest API: HTTP + collection signing on one process (budget deploy).
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

echo "[render] applying database migrations..."
"$ROOT/scripts/render-migrate.sh"

role="${SERVICE_ROLE:-all}"
signing="${COLLECTION_SIGNING_ENABLED:-true}"
dispatch="${COLLECTION_DISPATCH_MODE:-poll}"
echo "[render] starting all-in-one API (SERVICE_ROLE=${role}, COLLECTION_SIGNING_ENABLED=${signing}, COLLECTION_DISPATCH_MODE=${dispatch})..."
exec node dist/main.js
