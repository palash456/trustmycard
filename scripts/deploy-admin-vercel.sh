#!/usr/bin/env bash
# Deploy @trustmycard/admin to Vercel production (palash456s-projects/admin).
#
# Prerequisites (once):
#   npm i -g vercel
#   vercel login
#   vercel link                         # from repo root (project Root Directory = frontend/admin)
#   vercel pull --yes --environment=production
#
# Vercel env (Production): BACKEND_API_URL=https://api.wallet.futuretrustcards.ct.ws
#   BACKEND_API_RESOLVE_IP=185.246.190.34  (required when API DNS uses nip.io)
#   plus ADMIN_API_KEY, ADMIN_SESSION_SECRET, ADMIN_PANEL_PASSWORD, etc.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_DIR="$ROOT/frontend/admin"

if ! command -v vercel >/dev/null 2>&1; then
  echo "[deploy-admin] Install Vercel CLI: npm i -g vercel" >&2
  exit 1
fi

if [[ ! -f "$ROOT/.vercel/project.json" ]]; then
  echo "[deploy-admin] Project not linked. Run once from repo root:" >&2
  echo "  vercel login && vercel link && vercel pull --yes --environment=production" >&2
  exit 1
fi

if [[ "${SKIP_ADMIN_BUILD:-}" != "1" ]]; then
  echo "[deploy-admin] production build check (frontend workspace)..."
  cd "$ROOT/frontend"
  TMC_ENV=production npm run build:admin
else
  echo "[deploy-admin] skipping local build (SKIP_ADMIN_BUILD=1)"
fi

echo "[deploy-admin] deploying to Vercel production..."
cd "$ROOT"
vercel --prod --yes

echo "[deploy-admin] complete"
