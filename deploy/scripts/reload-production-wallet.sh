#!/usr/bin/env bash
# Recreate wallet after config-only META_PIXEL_ID update (VPS host or backend container with docker.sock).
set -euo pipefail

ROOT="${TMC_REPO_ROOT:-/opt/tmc}"
cd "${ROOT}"

COMPOSE=(
  docker compose
  -p tmc-production-micro
  -f deploy/compose/docker-compose.base.yml
  -f deploy/compose/docker-compose.micro.yml
  -f deploy/compose/docker-compose.external-data.yml
  -f deploy/compose/docker-compose.micro-edge.yml
)

export TMC_COMPILED_ENV_BACKEND="${TMC_COMPILED_ENV_BACKEND:-../compiled/production/backend.env}"
export TMC_COMPILED_ENV_WALLET="${TMC_COMPILED_ENV_WALLET:-../compiled/production/wallet.env}"

echo "[reload-wallet] recreating wallet with updated compiled env"
"${COMPOSE[@]}" up -d --no-deps --force-recreate wallet

echo "[reload-wallet] waiting for wallet process (up to 90s)"
for _ in $(seq 1 45); do
  if docker compose -p tmc-production-micro ps wallet 2>/dev/null | grep -q "(healthy)"; then
    break
  fi
  if curl -fsS "http://127.0.0.1:${TMC_HOST_WALLET_PORT:-3000}/api/settings/public" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "[reload-wallet] restarting caddy so upstream picks up the new wallet container"
"${COMPOSE[@]}" restart caddy >/dev/null 2>&1 || true

echo "[reload-wallet] done"
