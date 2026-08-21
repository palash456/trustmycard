#!/bin/sh
set -eu

npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
npm config set maxsockets 3

attempt=1
max=3
while [ "$attempt" -le "$max" ]; do
  if "$@"; then
    exit 0
  fi
  if [ "$attempt" -eq "$max" ]; then
    break
  fi
  echo "[npm-retry] attempt ${attempt}/${max} failed, retrying in $((attempt * 5))s…" >&2
  sleep $((attempt * 5))
  attempt=$((attempt + 1))
done

exit 1
