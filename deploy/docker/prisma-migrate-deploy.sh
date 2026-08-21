#!/bin/sh
set -eu

# Use the Prisma CLI copied from the build stage (6.x). Do not use `npx prisma` here —
# it can resolve to Prisma 7+, which rejects url/directUrl in schema.prisma.
cd /app/backend
exec node ./node_modules/prisma/build/index.js migrate deploy "$@"
