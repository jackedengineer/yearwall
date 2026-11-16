#!/usr/bin/env bash
# Type-checks the data layer and runs its tests against a real SQLite database
# (Node's built-in node:sqlite, Node 22.5+). No app packages needed.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf .test-build
npx --no-install tsc -p scripts/tsconfig.test.json 2>/dev/null || tsc -p scripts/tsconfig.test.json
node --no-warnings scripts/data.test.mjs
