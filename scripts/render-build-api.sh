#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
# Render sets NODE_ENV=production; devDependencies (@nestjs/cli, typescript, prisma) are required at build time.
npm ci --include=dev
# Shared is built outside the frontend workspace on this service; install its compiler + types locally.
npm install --prefix "$ROOT/frontend/shared" --include=dev
npm run build --prefix "$ROOT/frontend/shared"
npx prisma generate
npm run build
