# Phase 0: Diagnose

Pipeline, die alle Blitz-Partien (3 bis 5 Minuten) von lichess und chess.com lädt, mit Stockfish bewertet und daraus den Diagnose-Report baut.

## Voraussetzungen

- Python 3.11+ mit `chess` (`pip install chess`)
- Stockfish im `PATH` oder unter `/usr/games/stockfish`

## Ablauf

```bash
python analysis/fetch_games.py --lichess Poquitonator --chesscom laurens3495   # ~4 min
python analysis/analyze_games.py --since 2025-01-01 --workers 4                 # ~1 h, fortsetzbar
python analysis/report.py                                                       # Kennzahlen -> data/report.json
python analysis/build_report.py                                                 # Seite -> data/diagnose.html
```

`data/` ist nicht im Repo (persönliche Partiedaten, Zwischenergebnisse).

## Was gemessen wird

- **Gewinnwahrscheinlichkeit** pro Stellung aus der Stockfish-Bewertung (Formel von lichess).
- **Verlust pro Zug** = Rückgang der Gewinnwahrscheinlichkeit aus Sicht des Ziehenden.
  Ungenauigkeit ab 10, Fehler ab 20, Patzer ab 30 Prozentpunkten.
- **Fehlerart** (ab 20 Punkten): Matt übersehen, Figur eingestellt, gegnerische Taktik übersehen
  (Materialverlust in der Widerlegung), Gegnerfehler nicht bestraft, positioneller Fehler.
- **Motive** in der Widerlegung: Gabel, Fesselung, Spieß, Abzug, Grundreihenmatt, Mattangriff.
- **Uhr** aus den `%clk`-Angaben: Restzeit, Bedenkzeit, Zeitnot (unter 20 s bei 3 min, unter 30 s bei 5 min).
- **Kritikalität**: Abstand zwischen bestem und zweitbestem Zug.
- **Vergleich**: Dieselben Kennzahlen für die Gegner in denselben Partien (gleiches Niveau).
