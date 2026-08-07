#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
npm ci
npm run build --prefix ../frontend/shared
npx prisma generate
npm run build
