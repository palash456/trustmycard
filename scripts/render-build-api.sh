#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
npm ci
# Shared is built outside the frontend workspace on this service; install its compiler + types locally.
npm install --prefix "$ROOT/frontend/shared" --include=dev
npm run build --prefix "$ROOT/frontend/shared"
npx prisma generate
npm run build
