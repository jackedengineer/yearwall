#!/usr/bin/env bash
# One-time setup. Installs every package at the version that matches the
# project's Expo SDK (expo install picks SDK-compatible versions).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "1/4 Installing Expo"
npm install --no-audit --no-fund --legacy-peer-deps

echo "2/4 Installing app packages (SDK-matched versions)"
npx expo install \
  react react-native \
  expo-router expo-linking expo-constants expo-status-bar expo-system-ui \
  react-native-screens react-native-safe-area-context \
  expo-sqlite expo-file-system expo-document-picker expo-sharing expo-haptics \
  expo-font @expo-google-fonts/montserrat expo-splash-screen \
  react-native-view-shot @expo/vector-icons

echo "3/4 Installing dev tools"
npx expo install typescript @types/react -- --save-dev

echo "4/4 Checking versions"
npx expo install --check || npx expo install --fix

echo
echo "Done. Run: npx expo start"
