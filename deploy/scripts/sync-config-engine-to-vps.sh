#!/usr/bin/env bash
# Hot-sync config engine + core to the VPS (volume-mounted into backend — no image rebuild).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CREDS="${ROOT}/deploy/provider.credentials.env"

if [[ ! -f "${CREDS}" ]]; then
  echo "Missing ${CREDS}. Copy deploy/provider.credentials.example.env and fill VPS_* values." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "${CREDS}"

: "${VPS_HOST:?VPS_HOST is required in provider.credentials.env}"
VPS_USER="${VPS_USER:-deploy}"
REMOTE_PATH="${VPS_DEPLOY_PATH:-/opt/tmc}"
SSH_KEY=()
if [[ -n "${VPS_SSH_KEY:-}" ]]; then
  SSH_KEY=(-i "${VPS_SSH_KEY/#\~/${HOME}}")
fi

RSYNC_SSH="ssh ${SSH_KEY[*]} -o StrictHostKeyChecking=accept-new"

echo "[sync-config-engine] uploading deploy/config-engine + deploy/core + compose to ${VPS_USER}@${VPS_HOST}:${REMOTE_PATH}/deploy/"
rsync -az -e "${RSYNC_SSH}" \
  "${ROOT}/deploy/config-engine/" \
  "${VPS_USER}@${VPS_HOST}:${REMOTE_PATH}/deploy/config-engine/"
rsync -az -e "${RSYNC_SSH}" \
  "${ROOT}/deploy/core/" \
  "${VPS_USER}@${VPS_HOST}:${REMOTE_PATH}/deploy/core/"
rsync -az -e "${RSYNC_SSH}" \
  "${ROOT}/deploy/compose/docker-compose.micro.yml" \
  "${VPS_USER}@${VPS_HOST}:${REMOTE_PATH}/deploy/compose/docker-compose.micro.yml"
rsync -az -e "${RSYNC_SSH}" \
  "${ROOT}/deploy/scripts/" \
  "${VPS_USER}@${VPS_HOST}:${REMOTE_PATH}/deploy/scripts/"

echo "[sync-config-engine] ensuring full stack is on the same compose network"
ssh "${SSH_KEY[@]}" -o StrictHostKeyChecking=accept-new \
  "${VPS_USER}@${VPS_HOST}" \
  "chmod +x ${REMOTE_PATH}/deploy/scripts/reload-production-wallet.sh && \
   cd ${REMOTE_PATH} && TMC_COMPILED_ENV_BACKEND=../compiled/production/backend.env TMC_COMPILED_ENV_WALLET=../compiled/production/wallet.env \
   docker compose -p tmc-production-micro \
    -f deploy/compose/docker-compose.base.yml \
    -f deploy/compose/docker-compose.micro.yml \
    -f deploy/compose/docker-compose.external-data.yml \
    -f deploy/compose/docker-compose.micro-edge.yml \
    up -d"

echo "[sync-config-engine] complete — retry Production config in admin"
