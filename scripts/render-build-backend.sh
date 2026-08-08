#!/usr/bin/env bash
# Build Nest API + worker artifacts (single Render web service).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/render-build-api.sh"
