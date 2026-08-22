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
echo "[reload-wallet] done"
