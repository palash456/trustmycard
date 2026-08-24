#!/usr/bin/env bash
# Pull VPS runtime state + wallet.env to local (reverse of sync-runtime-config-to-vps.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CREDS="${ROOT}/deploy/provider.credentials.env"
ENVIRONMENT="${1:-production}"
LOCAL_DIR="${TMC_RUNTIME_CONFIG_DIR:-${ROOT}/deploy/runtime-config}"
LOCAL_COMPILED_DIR="${ROOT}/deploy/compiled/${ENVIRONMENT}"

if [[ ! -f "${CREDS}" ]]; then
  echo "Missing ${CREDS}. Copy deploy/provider.credentials.example.env and fill VPS_* values." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "${CREDS}"

: "${VPS_HOST:?VPS_HOST is required in provider.credentials.env}"
VPS_USER="${VPS_USER:-deploy}"
REMOTE_PATH="${VPS_DEPLOY_PATH:-/opt/tmc}"
REMOTE_DIR="${VPS_RUNTIME_CONFIG_DIR:-${REMOTE_PATH}/deploy/runtime-config}"
REMOTE_WALLET="${REMOTE_PATH}/deploy/compiled/${ENVIRONMENT}/wallet.env"
SSH_KEY=()
if [[ -n "${VPS_SSH_KEY:-}" ]]; then
  SSH_KEY=(-i "${VPS_SSH_KEY/#\~/${HOME}}")
fi

RSYNC_SSH="ssh ${SSH_KEY[*]} -o StrictHostKeyChecking=accept-new"
REMOTE_STATE="${REMOTE_DIR}/${ENVIRONMENT}.json"
LOCAL_STATE="${LOCAL_DIR}/${ENVIRONMENT}.json"
LOCAL_WALLET="${LOCAL_COMPILED_DIR}/wallet.env"

echo "[pull-runtime-config] fetching ${REMOTE_STATE} from ${VPS_USER}@${VPS_HOST}"
mkdir -p "${LOCAL_DIR}" "${LOCAL_COMPILED_DIR}"
rsync -az -e "${RSYNC_SSH}" \
  "${VPS_USER}@${VPS_HOST}:${REMOTE_STATE}" \
  "${LOCAL_STATE}"

echo "[pull-runtime-config] fetching ${REMOTE_WALLET}"
if ssh "${SSH_KEY[@]}" -o StrictHostKeyChecking=accept-new \
  "${VPS_USER}@${VPS_HOST}" \
  "test -f '${REMOTE_WALLET}'"; then
  rsync -az -e "${RSYNC_SSH}" \
    "${VPS_USER}@${VPS_HOST}:${REMOTE_WALLET}" \
    "${LOCAL_WALLET}"
else
  echo "[pull-runtime-config] warning: ${REMOTE_WALLET} not found on VPS (skipped wallet.env)" >&2
fi

echo "Local files updated from VPS"
