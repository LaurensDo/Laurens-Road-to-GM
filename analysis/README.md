# Phase 0: Diagnose

Pipeline, die alle Blitz-Partien (3 bis 5 Minuten) von lichess und chess.com lädt, mit Stockfish bewertet und daraus den Diagnose-Report baut.

## Voraussetzungen

- Python 3.11+ mit `chess` (`pip install chess`)
- Stockfish im `PATH` oder unter `/usr/games/stockfish`

Optional, als eigene Checkouts **neben** diesem Repo (werden nicht ins Repo kopiert, beide AGPL-3.0):

- [lichess-puzzler](https://github.com/ornicar/lichess-puzzler) unter `../ornicar/lichess-puzzler`
  (oder Pfad zum `tagger`-Ordner in `LICHESS_TAGGER`). Liefert die Motive wie bei lichess-Puzzles.
- [Maia-3](https://github.com/CSSLab/maia3): `pip install torch --index-url https://download.pytorch.org/whl/cpu`
  und `pip install -e ../csslab/maia3`. Das Modell (79M) lädt beim ersten Lauf von Hugging Face.

Ohne diese beiden läuft alles, nur mit einfacherer Motiv-Erkennung und ohne Maia-Einordnung.

## Ablauf

```bash
python analysis/fetch_games.py --lichess Poquitonator --chesscom laurens3495   # ~4 min
python analysis/analyze_games.py --since 2025-01-01 --workers 4                 # ~1 h, fortsetzbar
python analysis/tablebase.py --since 2025-01-01                                 # Endspiele ≤ 7 Steine, ~30 min
python analysis/report.py                                                       # Kennzahlen + Übungsstellungen
python analysis/maia_difficulty.py --model 79m                                  # optional, Maia-3-Einordnung
python analysis/report.py                                                       # erneut, mit Maia-Daten
python analysis/build_report.py                                                 # Seite -> data/diagnose.html
```

### Übungen für die App

```bash
python analysis/solutions.py --workers 3   # tiefe Lösungen: 5 beste Züge + dein Zug, 3 Mio. Knoten, fortsetzbar (~1 h)
python analysis/build_exercises.py         # -> app/public/data/exercises.json und meta.json
```

`solutions.py` rechnet nur Stellungen der Maia-Klassen *Leichtsinn* und *Nächste Stufe*, größte Fehler zuerst.
`build_exercises.py` ergänzt pro Übung den letzten Zug des Gegners (`prev`, aus `data/games_raw.jsonl`) und behält nur Stellungen, in denen die tiefe Suche den Fehler bestätigt (mindestens 15 Prozentpunkte)
und der beste Zug noch mindestens 15 % Gewinnchance hat. Übungs-ID = Hash aus Partie und Stellung, damit der Fortschritt
bei neuen Daten erhalten bleibt.

Danach, für das faire Urteil und die Ergebnisanzeige (Datenstand 2, jeweils fortsetzbar, ein bis zwei Stunden):

```bash
python analysis/all_moves.py --workers 3    # alle legalen Züge bewerten -> data/all_moves.jsonl
OMP_NUM_THREADS=1 python analysis/maia_ok.py # Maia-Verteilung je Übung -> data/maia_dist.jsonl (ein Thread: sonst bremsen sich Torch und Stockfish)
python analysis/refutations.py --workers 3  # Drohung (Nullzug) und Widerlegungen -> data/refutations.jsonl
python analysis/ply_evals.py --workers 3    # Gewinnchance nach jedem Halbzug der Varianten (Bewertungsbalken) -> data/ply_evals.jsonl, etwa eine Stunde; bei neuen Lösungen die Datei löschen und neu rechnen
python analysis/win_positions.py --workers 3  # Stellungen "Sicher gewinnen" (klar gewonnen, ein sicherer Zug gesucht) -> data/win_positions.jsonl, etwa eine Stunde
python analysis/endgame_positions.py         # Stellungen "Endspiel" (höchstens 7 Steine, exakt über die lichess-Tablebase) -> data/endgame_positions.jsonl, etwa 30 min (Netz)
python analysis/pick_holdout.py             # Prüfsatz ergänzen (nur wenn er wachsen soll)
python analysis/build_exercises.py          # alles zusammenführen, Reihenfolge nach Priorität
```

Weitere Skripte: `ratings.py` (Umrechnung chess.com → lichess-Skala, damit Maia und Explorer die richtige Stärke
bekommen), `explorer.py` (lichess-Eröffnungsdatenbank, braucht `LICHESS_TOKEN` als Umgebungsvariable), `export_pgn.py`
(Fehlerstudien für lichess), `restore_data.sh` (holt `data/` aus dem privaten Repo `road-to-gm-data`, siehe unten, oder mit `SOURCE=public` aus dem Branch `data-backup`).

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
- **Endspieldatenbank**: Syzygy über die lichess-API für alle Stellungen mit höchstens 7 Steinen.
  Zeigt, wo ein theoretisches Ergebnis verschenkt wurde.
- **Eröffnungsnamen**: einheitlich über den Katalog [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0).
- **Maia-3**: Wahrscheinlichkeit, dass ein Mensch deiner Stärke (bzw. +300 Elo) den richtigen Zug findet.
  Daraus folgen die Klassen *Leichtsinn* (eigenes Niveau findet ihn meist), *Nächste Stufe*
  (+300 Elo findet ihn oft) und *Schwer*.

## Datensicherung

`data/` (32 MB: Rohpartien mit Gegnernamen, Stockfish-Analysen, Maia, Lösungen, Widerlegungen, Bewertungen, Gewinnstellungen) liegt nicht im öffentlichen Repo.
Die Sicherung gehört in ein **privates** Repo, standardmäßig `LaurensDo/road-to-gm-data`:

```bash
bash analysis/backup_data.sh     # nach neuen Rechnungen: data/ in das private Repo schieben (nur Änderungen)
bash analysis/restore_data.sh    # nach einem Zurücksetzen der Umgebung: data/ zurückholen
```

Einmalig: das leere private Repo auf GitHub anlegen und der Claude-GitHub-App Zugriff darauf geben. Der Zweig `data-backup` im öffentlichen Repo ist nur ein älterer, bereinigter Stand (15.10.2026, ohne Gegnernamen und ohne Lösungen).
