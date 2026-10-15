# Road to GM: App

Persönlicher Schach-Trainer als installierbare Web-App (PWA) für das iPhone. Deutsch, hell und dunkel,
offline nutzbar, kein Konto und kein eigener Server. Fortschritt liegt auf dem Gerät.

Stand: Version 1 (Heute, Fehler-Trainer mit Wiederholung, Fortschritt, Einstellungen, Sicherung).
Geplant laut `docs/app-spezifikation.md`: Taktik-Sprint, Stockfish-Prüfer, Gewinn-Drill (1.1), Eröffnungs-Lecks,
Partie-Review, automatischer Import (2).

## Aufbau

- `src/lib/` Logik ohne Oberfläche: `judge.ts` (Wertung), `srs.ts` (FSRS-Wiederholung), `queue.ts` (Auswahl),
  `chess.ts` (Regeln mit chessops), `stats.ts`, `store.ts` (IndexedDB, Export und Import).
- `src/views/` Oberflächen: `Today`, `Trainer`, `Progress`, `Settings`.
- `public/data/exercises.json` und `meta.json`: Übungen und Diagnose-Werte, erzeugt von `analysis/build_exercises.py`.
- Brett: [chessground](https://github.com/lichess-org/chessground), Regeln: [chessops](https://github.com/niklasf/chessops),
  Wiederholung: [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs). Alles GPL beziehungsweise MIT, das Repo ist öffentlich.

## Befehle

```bash
npm install
npm run dev          # lokal mit Neuladen
npm test             # Unit-Tests (Wertung, Wiederholung, Warteschlange, Schach-Regeln)
npm run typecheck
npm run build        # Produktions-Build nach dist/
node tools/make-icons.mjs   # App-Symbole neu erzeugen
```

Ende-zu-Ende-Test im Handy-Format (Chromium über Playwright):

```bash
npx vite preview --port 4173 &
node tools/e2e.mjs /tmp/e2e
```

## Neue Übungen veröffentlichen

```bash
python analysis/solutions.py        # tiefe Lösungen (Stockfish), fortsetzbar
python analysis/build_exercises.py  # -> app/public/data/exercises.json
bash app/deploy.sh                  # Tests, Build, Veröffentlichung auf den Branch gh-pages
```

GitHub Pages: Repository, Settings, Pages, Source "Deploy from a branch", Branch `gh-pages`, Ordner `/ (root)`.
Adresse: https://laurensdo.github.io/Laurens-Road-to-GM/

Der Fortschritt hängt an den Übungs-IDs (Hash aus Partie und Stellung). Neue Daten ändern bestehende IDs nicht.
