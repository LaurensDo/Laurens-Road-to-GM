#!/usr/bin/env bash
# Sichert data/ (Rohpartien, Stockfish-Analysen, Maia, Lösungen, Widerlegungen, Bewertungen, Gewinnstellungen) in ein PRIVATES Repo.
# Wichtig: Das Repo muss privat sein, die Dateien enthalten Partien, Gegnernamen und Auswertungen.
#
# Einmalig: auf GitHub ein leeres privates Repo anlegen (Standard: LaurensDo/road-to-gm-data) und der Claude-GitHub-App Zugriff geben.
# Aufruf im Repo-Hauptordner:   bash analysis/backup_data.sh
# Anderes Ziel:                 REPO_URL=https://github.com/<name>/<repo> bash analysis/backup_data.sh
set -euo pipefail
REPO_URL="${REPO_URL:-https://github.com/LaurensDo/road-to-gm-data}"
BRANCH="${BRANCH:-main}"
SRC="$(cd "$(dirname "$0")/.." && pwd)/data"
[ -d "$SRC" ] || { echo "Kein Ordner data/ gefunden"; exit 1; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git clone --quiet "$REPO_URL" "$TMP/repo"
cd "$TMP/repo"
git checkout --quiet "$BRANCH" 2>/dev/null || git checkout --quiet -b "$BRANCH"
rm -rf data
mkdir data
# alles außer Protokollen und Zwischendateien
(cd "$SRC" && tar --exclude='*.log' --exclude='__pycache__' -cf - .) | tar -xf - -C data
cat > README.md <<'EOT'
# Road to GM: Datensicherung (privat)

Rohdaten und Rechenergebnisse der Analysen aus dem öffentlichen Repo LaurensDo/Laurens-Road-to-GM (Ordner `analysis/`).
Dieses Repo muss privat bleiben: Es enthält Partien mit Gegnernamen und persönliche Auswertungen.

Wiederherstellen (im Hauptordner von Laurens-Road-to-GM): `bash analysis/restore_data.sh`
Sichern (nach neuen Rechnungen): `bash analysis/backup_data.sh`
EOT
git add -A
if git diff --cached --quiet; then
  echo "Nichts Neues zu sichern."
  exit 0
fi
git -c user.name="Road to GM" -c user.email="noreply@example.com" commit --quiet -m "Datensicherung $(date -u '+%F %T') UTC"
git push --quiet origin "$BRANCH"
echo "Gesichert: $(find data -type f | wc -l) Dateien, $(du -sh data | cut -f1) in $REPO_URL"
