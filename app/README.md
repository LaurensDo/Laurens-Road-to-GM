# Road to GM: App

Persönlicher Schach-Trainer als installierbare Web-App (PWA) für iPhone und iPad. Deutsch, hell und dunkel,
offline nutzbar, kein Konto und kein eigener Server. Fortschritt liegt auf dem Gerät und gleicht sich
optional über eine Datei in einem privaten GitHub-Repository zwischen den Geräten ab.

Stand: Version 1.1 (Aufgabensätze mit Ergebnis und Einordnung, Töne, Layouts für iPhone und iPad hoch und quer; dazu alles aus Version 1: Heute, Fehler-Trainer mit Wiederholung, Fortschritt, Einstellungen, Sicherung, Abgleich). Version 1 entspricht dem Commit `edcae70`.
Geplant laut `docs/app-spezifikation.md`: Taktik-Sprint, Stockfish-Prüfer, Gewinn-Drill (1.1), Eröffnungs-Lecks,
Partie-Review, automatischer Import (2).

## Aufbau

- `src/lib/` Logik ohne Oberfläche: `judge.ts` (Wertung), `srs.ts` (FSRS-Wiederholung), `queue.ts` (Auswahl),
  `chess.ts` (Regeln mit chessops), `stats.ts`, `store.ts` (IndexedDB, Export und Import),
  `merge.ts` (Zusammenführen zweier Stände), `sync.ts` (GitHub-Contents-API), `syncRunner.ts` (Auslöser, Status),
  `sets.ts` (Aufgabensätze: laufender Satz, Auswertung und Einordnung), `sound.ts` (Töne, im Browser erzeugt),
  `device.ts` (Einstellungen nur für dieses Gerät, z. B. Ton).
- `src/views/` Oberflächen: `Today`, `Trainer`, `SetResult`, `Progress`, `Settings`, `SoundCard`, `SyncCard`.
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

Ende-zu-Ende-Tests (Chromium über Playwright):

```bash
npx vite preview --port 4173 --strictPort &
node tools/e2e.mjs /tmp/e2e        # Sätze, Töne, Offline, Prüfung aller Geräteformate
bash tools/e2e-sync.sh             # Abgleich dreier Geräte gegen einen Mock von GitHub
node tools/layouts.mjs /tmp/lay    # Bildschirmfotos aller Ansichten in sechs Geräteformaten
npx vite --port 4175 &  node tools/sound-check.mjs   # Pegelprüfung der Töne, ohne Lautsprecher
```

## Aufgabensätze (Version 1.1)

Das Training läuft in Sätzen: eine Runde mit 5, 10, 15 oder 20 Aufgaben (Einstellung, Standard 10). Danach folgt eine
Ergebnisseite mit Quote, Tempo und einer **Einordnung nach festen Regeln** (keine KI):

- Richtwert aus den Maia-Werten der Aufgaben: wie viele Spieler deiner Stärke in diesen Stellungen den besten Zug finden.
- Tempo: richtige Antworten innerhalb des Zeitlimits, Hinweis bei vielen zu langsamen.
- Muster: Fehler in unter 3 Sekunden gelten als vorschnell.
- Stärke und Schwäche nach Partiephase, Fehlerart und Motiv (ab zwei Aufgaben je Gruppe), Vergleich mit den letzten 5 Sätzen.

Jede Antwort im Verlauf trägt `set: { id, n }`. Dadurch laufen Sätze automatisch mit dem Abgleich auf das andere Gerät, ohne
Änderung am Dateiformat. Nur der laufende Satz liegt lokal (`localStorage`, wird nach 6 Stunden nicht mehr fortgesetzt).
Die Wiederholungsplanung (FSRS) bleibt unverändert, ein Satz zieht nur Aufgaben aus derselben Warteschlange.

## Töne

Die Töne entstehen im Browser (Web Audio): Rauschstöße und Sinustöne, keine Dateien. Das ist lizenzfrei und funktioniert offline.
Die Holzklänge von lichess („Standard“) stehen laut `COPYING.md` unter „nicht frei“, die freien Reihen (AGPL) klingen nach
Science-Fiction. Töne: Figur anklicken, Zug, Schlagzug, unzulässiger Zug, richtig, richtig aber langsam, falsch, Uhr (Start,
Ticks in den letzten 3 Sekunden, Ablauf), Auswahl im Menü, Satz geschafft. Lautstärke, Uhr-Ton und Stummschalter gelten nur
für das jeweilige Gerät (`device.ts`) und werden nicht abgeglichen. In den Einstellungen unter „Töne anhören“ lässt sich jeder
Ton einzeln abspielen.

## Abgleich zwischen iPhone und iPad

Jedes Gerät hält den vollständigen Stand lokal und arbeitet offline. Der Abgleich ist optional und läuft
ohne eigenen Server über **eine Datei** (`road-to-gm/state.json`) in einem **privaten** GitHub-Repository
(Contents-API, Token mit Recht „Contents: Read and write“ nur für dieses Repository).

- **Zusammenführen statt überschreiben:** Das Antwort-Protokoll beider Geräte wird vereinigt (Schlüssel
  `id|ts`), die Wiederholungs-Karten werden daraus mit FSRS neu berechnet. Ausgeblendete Aufgaben und
  Einstellungen gelten nach „zuletzt geändert gewinnt“, der Bonus pro Tag nach Maximum.
  Zurücksetzen setzt eine Epoche; ältere Einträge anderer Geräte werden verworfen.
- **Auslöser:** App-Start, 15 s nach einer Änderung, Wechsel in den Vordergrund (mindestens 30 s Abstand),
  Wieder-online. iOS erlaubt keinen Abgleich im Hintergrund.
- **Schutz:** Öffentliche Repositories werden abgelehnt. Eine nicht lesbare Datei wird nie überschrieben.
  Bei gleichzeitigem Schreiben (409/422) wird neu gelesen und erneut zusammengeführt.
- **Token:** liegt nur im lokalen Speicher des Geräts (`road-to-gm-sync-config-v1`), nie in der Sicherung
  und nie in der Sync-Datei. Zweites Gerät: „Einrichtungscode“ (`rtgm1.…`) per Zwischenablage übertragen.
- **Test:** `VITE_SYNC_API` setzt die API-Adresse nur zur Build-Zeit (für den Mock).

## Neue Übungen veröffentlichen

```bash
python analysis/solutions.py        # tiefe Lösungen (Stockfish), fortsetzbar
python analysis/build_exercises.py  # -> app/public/data/exercises.json
bash app/deploy.sh                  # Tests, Build, Veröffentlichung auf den Branch gh-pages
```

GitHub Pages: Repository, Settings, Pages, Source "Deploy from a branch", Branch `gh-pages`, Ordner `/ (root)`.
Adresse: https://laurensdo.github.io/Laurens-Road-to-GM/

`app/public/data/` ist im Repo eingecheckt (nur Stellungen, Lösungen und Partie-Links, keine Gegnernamen),
damit sich die App ohne die privaten Rohdaten bauen lässt. Der Ordner `data/` im Wurzelverzeichnis (Partien,
Zwischenergebnisse) bleibt ausgeschlossen.

Der Fortschritt hängt an den Übungs-IDs (Hash aus Partie und Stellung). Neue Daten ändern bestehende IDs nicht.
