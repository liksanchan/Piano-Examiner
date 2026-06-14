#!/bin/sh
set -e

node scripts/prepare-data-dirs.mjs

echo "Applying database schema…"
npx drizzle-kit push

echo "Starting Piano Examiner on port ${PORT:-3000}…"
exec npm start
