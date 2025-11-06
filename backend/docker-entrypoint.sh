#!/bin/sh
set -e

# Reason: Ensure Prisma Client is generated and migrations are applied against the configured DATABASE_URL
npx prisma generate
# Reason: Use db push to apply schema on fresh Postgres without relying on SQLite migrations
npx prisma db push

exec node dist/index.js


