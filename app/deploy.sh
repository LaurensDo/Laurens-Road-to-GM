#!/usr/bin/env bash
# Baut die App und veröffentlicht sie als Branch gh-pages (GitHub Pages: "Deploy from a branch", Ordner "/ (root)").
# Aufruf: bash app/deploy.sh
# Vorher bei neuen Daten: python analysis/build_exercises.py
set -euo pipefail
cd "$(dirname "$0")"
REMOTE_URL="$(git remote get-url origin)"
[ -d node_modules ] || npm ci
npm test --silent
npm run build
TMP="$(mktemp -d)"
cp -r dist/. "$TMP"/
touch "$TMP/.nojekyll"
(
  cd "$TMP"
  git init -q -b gh-pages
  git add -A
  git -c user.name="Road to GM" -c user.email="noreply@example.com" commit -q -m "Deploy $(date -u '+%F %T') UTC"
  git push -q --force "$REMOTE_URL" gh-pages
)
rm -rf "$TMP"
echo "Veröffentlicht auf Branch gh-pages. Seite: https://laurensdo.github.io/Laurens-Road-to-GM/"
