#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ALLOW='(observability/|/test/|docs/|scripts/|errors\.ts|error-message\.ts)'

fail=0

check_pattern() {
  local label="$1"
  local pattern="$2"
  local matches
  matches=$(rg -n "$pattern" backend/src frontend/wallet-sdk/src frontend/admin/src \
    --glob '!**/node_modules/**' 2>/dev/null | rg -v "$ALLOW" || true)
  if [ -n "$matches" ]; then
    echo "FAIL: $label"
    echo "$matches"
    fail=1
  fi
}

check_pattern "String(err) in catch blocks" 'String\(err\)'
check_pattern "err.message ternary anti-pattern" 'err instanceof Error \? err\.message : String\(err\)'

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Logging anti-patterns detected. Use getErrorMessage/serializeError from @trustmycard/shared/observability."
  exit 1
fi

echo "OK: no logging anti-patterns outside allowed paths."
