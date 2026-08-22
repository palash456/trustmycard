#!/usr/bin/env bash
# Native local development setup (no Docker).
# Installs and starts PostgreSQL + Redis on the host for npm run start:dev.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_USER="${TMC_POSTGRES_USER:-trustmycard}"
PG_PASSWORD="${TMC_POSTGRES_PASSWORD:-trustmycard_local_deploy}"
PG_DB="${TMC_POSTGRES_DB:-trustmycard}"

echo "[local-dev] Trust My Card — native Postgres + Redis setup"
echo "[local-dev] Repo: $ROOT"
echo ""

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[local-dev] This helper targets macOS (Homebrew). On Linux, install postgres + redis via your distro."
  echo "[local-dev] Then create user/db matching env/profiles/development/backend.env.example"
  exit 0
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "[local-dev] Homebrew not found. Install from https://brew.sh then re-run this script."
  exit 1
fi

echo "[local-dev] Installing PostgreSQL 16 and Redis (if missing)…"
brew install postgresql@16 redis 2>/dev/null || true

echo "[local-dev] Starting services…"
brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
brew services start redis 2>/dev/null || true

PG_BIN="$(brew --prefix postgresql@16 2>/dev/null)/bin"
if [[ ! -d "$PG_BIN" ]]; then
  PG_BIN="$(brew --prefix postgresql 2>/dev/null)/bin"
fi

if [[ -x "$PG_BIN/createuser" ]]; then
  echo "[local-dev] Creating Postgres role and database (if needed)…"
  "$PG_BIN/createuser" "$PG_USER" 2>/dev/null || true
  "$PG_BIN/psql" postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='$PG_USER'" | grep -q 1 || \
    "$PG_BIN/createuser" "$PG_USER" 2>/dev/null || true
  if [[ -n "$PG_PASSWORD" ]]; then
    "$PG_BIN/psql" postgres -c "ALTER USER $PG_USER WITH PASSWORD '$PG_PASSWORD';" 2>/dev/null || true
  fi
  "$PG_BIN/createdb" -O "$PG_USER" "$PG_DB" 2>/dev/null || true
else
  echo "[local-dev] Could not find psql binaries — create user '$PG_USER' and database '$PG_DB' manually."
fi

echo ""
echo "[local-dev] Expected connection (see env/profiles/development/backend.env.example):"
echo "  DATABASE_URL=postgresql://${PG_USER}:${PG_PASSWORD}@localhost:5432/${PG_DB}?schema=public"
echo "  REDIS_URL=redis://127.0.0.1:6379/0"
echo ""
echo "[local-dev] Next steps:"
echo "  cd backend && npm run prisma:push"
echo "  cd backend && npm run start:dev"
echo "  cd frontend && npm run dev:website && npm run dev:admin"
