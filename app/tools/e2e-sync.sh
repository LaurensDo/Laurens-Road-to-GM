#!/usr/bin/env bash
# Baut eine Testversion der App, die statt GitHub einen lokalen Mock anspricht, und startet den Sync-Test.
set -euo pipefail
cd "$(dirname "$0")/.."
VITE_SYNC_API=http://localhost:4180 npx vite build --outDir dist-e2e --emptyOutDir >/dev/null
npx vite preview --outDir dist-e2e --port 4174 >/tmp/preview-e2e.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
sleep 3
node tools/e2e-sync.mjs "${1:-/tmp/e2e-sync}"
