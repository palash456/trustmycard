#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"
# Render sets NODE_ENV=production; devDependencies (typescript, @types/node, tailwind, etc.) are required at build time.
npm ci --include=dev
npm run build:shared
TMC_ENV=production npm run build:website
