#!/usr/bin/env bash
# One-time setup. package.json pins every package to the version that matches
# the project's Expo SDK, so this installs them and checks they still match.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "1/2 Installing packages"
npm install --no-audit --no-fund

echo "2/2 Checking versions against the Expo SDK"
npx expo install --check || npx expo install --fix

echo
echo "Done. Run: npx expo start"
