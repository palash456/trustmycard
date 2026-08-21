#!/bin/sh
set -eu

# Install production dependencies only. Prisma Client engines are copied from the
# build stage after generate — skip postinstall scripts that expect the CLI/schema.
npm-retry.sh npm ci --omit=dev --ignore-scripts

# Prisma CLI + TypeScript are dev/build-only. Runtime gets @prisma/client from prod
# install; migrate deploy uses prisma 6.x copied from the build stage in Dockerfile.backend.
rm -rf node_modules/prisma node_modules/typescript

npm cache clean --force
