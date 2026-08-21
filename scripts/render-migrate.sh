#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
export TMC_ENV=production
export SERVICE_ROLE=api
node ./node_modules/prisma/build/index.js migrate deploy
