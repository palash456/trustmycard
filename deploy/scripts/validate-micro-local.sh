#!/usr/bin/env bash
# Smoke-test micro topology locally (bundled Postgres/Redis, backend + wallet only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MANIFEST_SRC="$ROOT/deploy/manifest.production.micro.local.example.json"
MANIFEST_DST="$ROOT/deploy/manifest.production.json"
MANIFEST_BACKUP=""

cleanup() {
  if [[ -n "$MANIFEST_BACKUP" && -f "$MANIFEST_BACKUP" ]]; then
    mv -f "$MANIFEST_BACKUP" "$MANIFEST_DST"
  fi
}
trap cleanup EXIT

if [[ -f "$MANIFEST_DST" ]]; then
  MANIFEST_BACKUP="$(mktemp)"
  cp "$MANIFEST_DST" "$MANIFEST_BACKUP"
fi
cp "$MANIFEST_SRC" "$MANIFEST_DST"

echo "[validate-micro-local] unit checks"
node "$ROOT/deploy/test/micro-topology.test.mjs"

echo "[validate-micro-local] dry-run"
"$ROOT/deploy.sh" production --dry-run --topology=micro --provider=local

if [[ "${SKIP_DEPLOY:-}" == "1" ]]; then
  echo "[validate-micro-local] SKIP_DEPLOY=1 — skipping docker deploy"
  exit 0
fi

echo "[validate-micro-local] deploy micro stack (reuse images when possible)"
export TMC_HOST_API_PORT=4004
export TMC_HOST_WALLET_PORT=3004
"$ROOT/deploy.sh" production --topology=micro --provider=local --skip-build

echo "[validate-micro-local] ok"
