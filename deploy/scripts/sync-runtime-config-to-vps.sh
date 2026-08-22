#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CREDS="${ROOT}/deploy/provider.credentials.env"
ENVIRONMENT="${1:-production}"
LOCAL_DIR="${TMC_RUNTIME_CONFIG_DIR:-${ROOT}/deploy/runtime-config}"

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
SSH_KEY=()
if [[ -n "${VPS_SSH_KEY:-}" ]]; then
  SSH_KEY=(-i "${VPS_SSH_KEY/#\~/${HOME}}")
fi

STATE_FILE="${LOCAL_DIR}/${ENVIRONMENT}.json"
AUDIT_FILE="${LOCAL_DIR}/audit.ndjson"

if [[ ! -f "${STATE_FILE}" ]]; then
  echo "Missing ${STATE_FILE}. Run scripts/config-update.sh init first." >&2
  exit 1
fi

echo "[sync-runtime-config] creating ${REMOTE_DIR} on ${VPS_USER}@${VPS_HOST}"
ssh "${SSH_KEY[@]}" -o StrictHostKeyChecking=accept-new \
  "${VPS_USER}@${VPS_HOST}" \
  "mkdir -p '${REMOTE_DIR}' && chmod 700 '${REMOTE_DIR}'"

echo "[sync-runtime-config] uploading runtime state"
rsync -az -e "ssh ${SSH_KEY[*]} -o StrictHostKeyChecking=accept-new" \
  "${STATE_FILE}" \
  "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/${ENVIRONMENT}.json"

if [[ -f "${AUDIT_FILE}" ]]; then
  echo "[sync-runtime-config] uploading audit log"
  rsync -az -e "ssh ${SSH_KEY[*]} -o StrictHostKeyChecking=accept-new" \
    "${AUDIT_FILE}" \
    "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/audit.ndjson"
fi

ssh "${SSH_KEY[@]}" -o StrictHostKeyChecking=accept-new \
  "${VPS_USER}@${VPS_HOST}" \
  "chmod 600 '${REMOTE_DIR}/${ENVIRONMENT}.json' && \
   if [[ -f '${REMOTE_DIR}/audit.ndjson' ]]; then chmod 640 '${REMOTE_DIR}/audit.ndjson'; fi && \
   chown -R '${VPS_USER}:${VPS_USER}' '${REMOTE_DIR}' 2>/dev/null || true"

echo "[sync-runtime-config] complete (${REMOTE_DIR} on ${VPS_HOST})"
