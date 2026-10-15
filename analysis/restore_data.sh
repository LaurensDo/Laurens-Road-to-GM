#!/usr/bin/env bash
# Stellt die Datendateien aus dem Branch data-backup wieder her (nach einem Zurücksetzen der Umgebung).
#
# Aufruf im Repo-Hauptordner:
#     bash analysis/restore_data.sh
#
# Danach liegen Partien, Engine-Analyse, Endspiel- und Maia-Ergebnisse wieder in data/.
# Die Berichte lassen sich danach mit analysis/report.py, write_findings.py und build_report.py neu bauen.
set -euo pipefail
git fetch --depth 1 origin data-backup
mkdir -p data
git archive FETCH_HEAD data | tar -x
gunzip -f data/*.gz
echo "Fertig: $(ls data | wc -l) Dateien in data/"
