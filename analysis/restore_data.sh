#!/usr/bin/env bash
# Stellt data/ wieder her (nach einem Zurücksetzen der Umgebung).
#
# 1. Aus dem PRIVATEN Repo (vollständig: Rohpartien mit Namen, Lösungen, Maia, Widerlegungen, Bewertungen, Gewinnstellungen):
#        bash analysis/restore_data.sh
#    In einer neuen Claude-Sitzung muss das Repo dafür angehängt sein (add_repo) oder der Zugriff per Token möglich sein.
#    Anderes Repo: REPO_URL=https://github.com/<name>/<repo> bash analysis/restore_data.sh
# 2. Aus dem öffentlichen Zweig data-backup (nur der Stand vom 15.10.2026, ohne Gegnernamen, ohne Lösungen):
#        SOURCE=public bash analysis/restore_data.sh
#
# Danach lassen sich die Berichte mit analysis/report.py, write_findings.py und build_report.py neu bauen.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "${SOURCE:-private}" = "public" ]; then
  git fetch --depth 1 origin data-backup
  mkdir -p data
  git archive FETCH_HEAD data | tar -x
  gunzip -f data/*.gz
else
  REPO_URL="${REPO_URL:-https://github.com/LaurensDo/road-to-gm-data}"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  git clone --quiet --depth 1 "$REPO_URL" "$TMP/repo"
  [ -d "$TMP/repo/data" ] || { echo "Im Repo liegt kein Ordner data/"; exit 1; }
  mkdir -p data
  cp -R "$TMP/repo/data/." data/
fi
echo "Fertig: $(find data -type f | wc -l) Dateien in data/"
