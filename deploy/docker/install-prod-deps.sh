#!/bin/sh
set -eu

# Install production dependencies only. Prisma Client engines are copied from the
# build stage after generate — skip postinstall scripts that expect the CLI/schema.
npm-retry.sh npm ci --omit=dev --ignore-scripts

# Prisma v6 installs the CLI and TypeScript as transitive deps of @prisma/client.
# Runtime only needs @prisma/client plus the generated engines copied from build.
rm -rf node_modules/prisma node_modules/typescript

npm cache clean --force
