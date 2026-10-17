#!/usr/bin/env bash
# Prüft den Update-Weg: Eine installierte Version bemerkt eine neuere (version.json), holt sie über den Service Worker und lädt
# neu, aber nicht mitten in einem Satz (dort erscheint danach ein Hinweis zum Antippen).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=dist-e2e-update
npx vite build --outDir "$OUT" --emptyOutDir >/dev/null
npx vite preview --outDir "$OUT" --port 4176 --strictPort >/tmp/preview-update.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
sleep 3
node tools/e2e-update.mjs "${1:-/tmp/e2e-update}" "$OUT"
