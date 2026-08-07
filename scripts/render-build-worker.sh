#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export SERVICE_ROLE=worker
export COLLECTION_SIGNING_ENABLED=true
export COLLECTION_WORKERS_ENABLED=true
"$ROOT/scripts/render-build-api.sh"
