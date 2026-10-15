# Road to GM – App-Spezifikation (Entwurf)

Stand: 15.10.2026 · Status: Entwurf zur Abstimmung, noch kein App-Code

## 1. Was die App ist

Eine installierbare **Web-App für das iPhone** (Safari → „Zum Home-Bildschirm“). Deutsch, hell und dunkel, nach dem ersten Laden offline nutzbar. Kein Konto, kein eigener Server.

Zweck: Die Befunde aus der Diagnose (Phase 0) abtrainieren. Größter Hebel ist die Uhr, danach hängende Figuren und Gabeln, Gewinnstellungen verwerten, ein paar Eröffnungs-Lecks.

## 2. Bereiche

| Bereich | Was du tust | Warum (Diagnose) | Version |
|---|---|---|---|
| **Heute** | Ein Tipp startet die Tagesration (15 min): 5 min Fehler-Trainer, 5 min Taktik-Sprint, 5 min Wechsel (Gewinn verwerten, Eröffnungs-Leck oder Endspiel). Fortschrittsbalken, Serie. | Training muss ohne Überwindung starten | 1 |
| **Fehler-Trainer** | Stellungen aus deinen eigenen Partien (rund 1.230). Zug auf dem Brett ausführen, Timer läuft (Standard 10 s). Danach Erklärung. Wiederholung nach Plan. | 49 % der Fehler sind trainierbar | 1 |
| **Taktik-Sprint** | Puzzles der lichess-Datenbank auf deinem Niveau, Themen nach deinen Schwächen (hängende Figur, Gabel, Fesselung, Matt in 1 und 2). 3-Minuten-Runden mit Uhr. | Hängende Figuren 23 pro 100 Partien | 1.1 |
| **Uhr-Coach** | (a) Gewinn verwerten: Stellung aus deinen Partien mit mindestens 90 % Gewinnchance, du spielst mit 1 Minute gegen Stockfish zu Ende. (b) Zeitbudget-Check: Restzeit bei Zug 20 und 30 gegen das Ziel 2:00 und 1:20. | 101 von 136 verlorenen Gewinnstellungen auf Zeit | 1.1 |
| **Eröffnungs-Lecks** | Die in der Praxis bestätigten Lecks als Karten: „Welcher Zug?“ Mit Explorer-Zahlen für Spieler deiner Stärke. | 11 von 17 Lecks bestätigt | 2 |
| **Fortschritt** | Kennzahlen im Verlauf: Zeitverluste pro 100 Partien, Restzeit bei Zug 30, hängende Figuren und Gabeln pro 100 Partien, Trefferquote und Tempo im Training. Basis ist die Diagnose vom 15.10.2026. | Wirkung messen statt raten | 1 (Training), 2 (Partien) |

## 3. Fehler-Trainer im Detail

- **Stellung:** FEN, Seite am Zug, Herkunft (Partie-Link, Datum), Phase, Motive (lichess-Themen), Restzeit in der Partie, Zeit, die du damals gebraucht hast.
- **Lösung:** Die besten bis zu 5 Züge mit Gewinnchance (Stockfish, MultiPV). Nicht nur ein „richtiger“ Zug.
- **Wertung:**
  - Richtig: dein Zug liegt höchstens **10 Prozentpunkte** unter dem besten. Gleichwertige Züge zählen also.
  - Richtig, aber zu langsam: gilt als „schwer“ für die Wiederholung.
  - Falsch: Erklärung folgt.
- **Erklärung:** Engine-Variante in Zügen, Motiv, was du damals gezogen hast, wie viele Spieler deiner Stärke den Zug finden (Maia-3), Link zur Partie. Texte für die wichtigsten Stellungen schreibt Claude vorab.
- **Wiederholung:** FSRS (MIT-lizenzierter Algorithmus, auch in Anki). Falsch oder langsam heißt bald wieder, richtig und schnell heißt immer längere Abstände.
- **Filter:** nach Phase, Motiv, Zeitnot-Fehler, Seite.

## 4. Stockfish und KI

**Stockfish in der App: möglich.** Stockfish 19 als WebAssembly, Variante *lite, single-threaded*: rund 1,7 MB, läuft ohne Spezial-Einstellungen auf jeder statischen Seite und offline ([nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js), GPL-3.0).

Einsatz in der App:
1. **Prüfer:** Spielst du einen Zug, der nicht in der gespeicherten Lösung steht, bewertet Stockfish ihn auf dem Handy.
2. **Gegner im Gewinn-Drill** mit einstellbarer Stärke.
3. **Knopf „Stellung analysieren“** im Trainer.

Grenzen: Auf dem iPhone langsamer als hier (ein Thread, kleineres Netz). Gut für 1 bis 2 Sekunden pro Stellung, nicht für die Analyse ganzer Partien. Kostet Akku.

**Stockfish außerhalb der App (volle Stärke):** bewertet neue Partien und erzeugt die Übungen, wie in Phase 0.

**KI (Claude) in der App:** keine Live-KI. Dafür bräuchte die App einen API-Schlüssel auf dem Handy und eine Abrechnung. Stattdessen:
- Maia-3 wählt aus und ordnet ein (offline vorberechnet).
- Claude schreibt Erklärungen und den Wochenbericht auf Zuruf im Chat. Sie landen als Text in den Daten der App.
- Optional später: Chat mit Claude in der App, nur mit eigenem API-Schlüssel.

## 5. Daten und neue Partien

- **Start:** Die App kommt mit den vorhandenen Übungen (aus data-backup erzeugt).
- **Neue Partien (Variante A, manuell):** Du sagst im Chat „neue Runde“, Claude importiert, analysiert, erzeugt Übungen und veröffentlicht die Daten. Die App holt sie beim Öffnen.
- **Neue Partien (Variante B, automatisch):** Ein GitHub-Workflow läuft nachts, holt neue Partien von lichess und chess.com, rechnet Stockfish, schreibt neue Übungen. Kostenlos bei öffentlichem Repo. Empfohlen für Version 2.
- **Fortschritt:** liegt auf dem iPhone (IndexedDB). Knopf für Export und Import als Sicherung. Installierte Home-Bildschirm-Apps unterliegen nach heutigem Stand nicht der 7-Tage-Löschregel von Safari, die Sicherung ist trotzdem Pflicht.

## 6. Was die App nicht macht

- Keine Hilfe in laufenden Partien, nur Training und Nachbetrachtung.
- Keine Partien gegen andere Menschen, kein Konto, keine Mehrbenutzer.
- Keine Push-Erinnerungen (iOS braucht dafür einen Server). Erinnerung per Kurzbefehl oder Kalender.
- Kein Ersatz für Game Review auf chess.com, ergänzt es um dein persönliches Profil.

## 7. Technik (am Rande)

- Vite, TypeScript, Preact, Service Worker (offline).
- Brett: [chessground](https://github.com/lichess-org/chessground) (wie lichess, touch-tauglich). Regeln: chessops. Wiederholung: ts-fsrs.
- Stockfish-WASM im Web Worker. Puzzle-Teilmenge (rund 3.000) aus der lichess-Puzzle-Datenbank (CC0).
- Open-Source-Lizenzen (GPL) vertragen sich mit einem öffentlichen Repo.

## 8. Festlegungen, die später teuer wären

| Entscheidung | Vorschlag | Alternative |
|---|---|---|
| Wo liegt die App | GitHub Pages, öffentliches Repo | Privat, dann anderer Anbieter (z. B. Cloudflare Pages), etwa 10 min Einrichtung |
| Datenformat der Übungen | MultiPV-Lösung (bis 5 Züge mit Gewinnchance) | Nur ein Lösungszug (einfacher, aber unfair bei gleichwertigen Zügen) |
| Zeitlimit pro Aufgabe | 10 s, einstellbar 5, 10, 20 oder aus | feste Vorgabe |
| Gleichwertige Züge | zählen (bis 10 Prozentpunkte) | nur der beste Zug |
| Stockfish in der App | ja, ab Version 1.1 | nein, nur vorberechnete Lösungen |
| Wiederholung | FSRS | einfache feste Abstände |
| Neue Partien | zuerst manuell, ab Version 2 automatisch | dauerhaft manuell |

Billig zu ändern: Texte, Farben, Reihenfolge der Bereiche, Namen, Anzahl der Aufgaben pro Tag.

## 9. Reihenfolge

1. **Version 1:** Heute, Fehler-Trainer (mit Wiederholung), Fortschritt (Training), offline, Sicherung.
2. **Version 1.1:** Taktik-Sprint, Stockfish-Prüfer, Gewinn-Drill im Uhr-Coach.
3. **Version 2:** Eröffnungs-Lecks, automatischer Import, Wochenbericht, Endspiel-Prüfung mit der Syzygy-Datenbank.
