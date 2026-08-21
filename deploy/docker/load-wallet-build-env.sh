#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"

# Export eligibility NEXT_PUBLIC_* vars from platform.env into the shell env so
# Next.js can inline them into the wallet client bundle during docker build.
eval "$(node "$ROOT/deploy/docker/export-wallet-eligibility-env.cjs" | sed -n '/^export /p')"

exec "$@"
