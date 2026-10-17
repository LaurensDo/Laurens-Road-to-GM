# Road to GM: App

Persönlicher Schach-Trainer als installierbare Web-App (PWA) für iPhone und iPad. Deutsch, hell und dunkel,
offline nutzbar, kein Konto und kein eigener Server. Fortschritt liegt auf dem Gerät und gleicht sich
optional über eine Datei in einem privaten GitHub-Repository zwischen den Geräten ab.

Stand: Version 1.2 (Update-Weg, tolerantes Dateiformat, Prüfsatz, Wiedereinstieg nach Pausen, Auswertung für Claude; davor 1.1: Aufgabensätze mit Ergebnis und Einordnung, Töne, Layouts für iPhone und iPad hoch und quer, letzter
Gegnerzug vor der Aufgabe, Startbild mit Big-Dog-Sprüchen, Marke Big Dog; dazu alles aus Version 1: Heute, Fehler-Trainer mit
Wiederholung, Fortschritt, Einstellungen, Sicherung, Abgleich). Version 1 ist als Tag `v1.0` festgehalten. Die Planung dazu steht in `docs/roadmap-entwurf.md`.
Geplant laut `docs/app-spezifikation.md`: Taktik-Sprint, Stockfish-Prüfer, Gewinn-Drill (Phase 2), Eröffnungs-Lecks,
Partie-Review, automatischer Import (Version 2).

## Aufbau

- `src/lib/` Logik ohne Oberfläche: `judge.ts` (Wertung), `srs.ts` (FSRS-Wiederholung), `queue.ts` (Auswahl),
  `chess.ts` (Regeln mit chessops), `explain.ts` (Erklärtexte), `stats.ts`, `format.ts` (Zahlen und Daten),
  `store.ts` (IndexedDB, Export und Import), `normalize.ts` (ältere Stände ergänzen), `data.ts` (Übungen laden),
  `merge.ts` (Zusammenführen zweier Stände), `sync.ts` (GitHub-Contents-API), `syncRunner.ts` (Auslöser, Status),
  `sets.ts` (Aufgabensätze: laufender Satz, Auswertung und Einordnung), `sound.ts` (Töne, im Browser erzeugt),
  `device.ts` (Einstellungen nur für dieses Gerät, z. B. Ton), `quotes.ts` (Sprüche fürs Startbild),
  `viewport.ts` und `diag.ts` (Startbild auf dem iPad, Anzeige-Info), `updater.ts` (neue Version erkennen und laden),
  `version.ts` (App-Version, Lese-Stufe des Dateiformats), `report.ts` (Auswertung für Claude).
- `src/views/` Oberflächen: `Splash`, `Today`, `Trainer`, `SetResult`, `Progress`, `Settings`, `SoundCard`, `SyncCard`,
  dazu `Segmented` (Umschalter) und `Mark` (Big-Dog-Zeichen).
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
node tools/brand.mjs        # Marke neu erzeugen: Brettfiguren, Startbild-Zeichen, App-Symbole
```

Ende-zu-Ende-Tests (Chromium über Playwright):

```bash
npx vite preview --port 4173 --strictPort &
node tools/e2e.mjs /tmp/e2e        # Sätze, Töne, Offline, Prüfung aller Geräteformate
bash tools/e2e-sync.sh             # Abgleich dreier Geräte gegen einen Mock von GitHub, mit Zurücksetzen und Sicherung
bash tools/e2e-update.sh           # Update-Weg: neue Version erkennen, nicht im Satz neu laden, Hinweis danach
node tools/layouts.mjs /tmp/lay    # Bildschirmfotos aller Ansichten in sechs Geräteformaten
npx vite --port 4175 &  node tools/sound-check.mjs   # Pegelprüfung der Töne, ohne Lautsprecher
```

## Version 1.2: Update-Weg, Dateiformat, Prüfsatz, Wiedereinstieg

**Update-Weg** (`src/lib/updater.ts`). Eine installierte Web-App auf iOS bleibt tagelang im Speicher, der Service Worker holt eine neue
Version zwar im Hintergrund, die Seite läuft aber mit dem alten Code weiter. Deshalb liest die App beim Öffnen und bei der Rückkehr in
den Vordergrund `version.json` (wird beim Build erzeugt, ist bewusst nicht im Offline-Speicher und wird mit `cache: 'no-store'` gelesen).
Ist der Build dort neuer als der laufende, stößt sie den Service Worker an (`registration.update()`), wartet, bis er aktiv ist, und lädt
neu, aber nur auf Heute und Fortschritt. In einem Satz oder in den Einstellungen lädt sie nicht neu: Nach dem Satz erscheint auf Heute
der Hinweis „Neue Version da. Tippen zum Laden.“ Schutz vor Endlosschleifen: Für denselben Build wird pro Sitzung nur einmal neu geladen.
Neue Übungsdaten kommen auf demselben Weg. Die Versionsnummer steht in `package.json`, der Build-Zeitpunkt in den Einstellungen und in
der Anzeige-Info.

**Dateiformat** (`merge.ts`, `version.ts`). Die Sync-Datei trägt `minReader` (Lese-Stufe). Geräte mit niedrigerer Stufe lassen die Datei
unberührt (Meldung „neuere Version“), statt Felder zu verlieren. `schema` bleibt 1, weil Version 1.1 genau das prüft. Unbekannte Felder
oben in der Datei werden mitgeführt und wieder geschrieben (`ext`), `devices` meldet je Gerät die App-Version (höchstens einmal am Tag
geändert). Jede Antwort speichert zusätzlich `lim` (damals geltendes Zeitlimit) und `dv` (Datenstand der Übungen), optional `kind`
(Antwortart; andere Arten als die normale Aufgabe bleiben im Verlauf, gehen aber nicht in den Wiederholungsplan). Neue Datenarten werden
erst geschrieben, wenn alle Geräte in `devices` mindestens 1.2 melden. Reserviert: `snap` (Schnappschuss der Karten für eine spätere
Kompaktierung). Gemessen (Node, 20.000 Antworten, etwa ein Jahr intensiver Nutzung): `replay()` rund 0,4 s, Datei rund 2 MB. Kompaktieren
lohnt ab etwa 10.000 Antworten oder wenn das Zusammenführen auf dem iPhone merklich dauert.

**Prüfsatz** (`analysis/pick_holdout.py`, `analysis/holdout_ids.json`). 60 Übungen sind in `exercises.json` mit `hold: true` markiert und
erscheinen nie im Training (`data.ts` trennt sie ab). Sie sind nach Fehlerart, Phase und Maia-Klasse geschichtet aus der ganzen Datei
gezogen (ab Platz 150, weil vorn schon geübt wurde). Zweck: später ein Monats-Check mit unbekannten Stellungen, der Können statt
Erinnerung misst. Die Liste wächst nur, `build_exercises.py` wendet sie an. Welche davon schon gesehen wurden, steht in der Auswertung.

**Wiedereinstieg** (`queue.ts`). Nach einer Pause von mindestens 4 Tagen beginnt der Tag mit den 5 fälligen Karten, die am sichersten
sitzen (FSRS-Abrufwahrscheinlichkeit). Im Rückstand (mehr als 30 Fällige) kommen höchstens 30 Wiederholungen pro Tag und nur 3 neue
Aufgaben; Heute sagt, über wie viele Tage sich der Rückstand verteilt. Lernschritte nach einem Fehler sind davon nicht betroffen.
Die Serie ist weg, unter Fortschritt stehen die Trainingstage im Monat.

**Auswertung für Claude** (`report.ts`, Einstellungen). Kopiert Zahlen zur Nutzung (Trainingstage je Woche, Minuten je Tag, Sätze und ob
danach ein weiterer folgte, Pausen und Rückkehr, Dauerbrenner, gesehene Prüfstellungen, App-Versionen der Geräte), ohne Partien und Namen.
Sie erscheint nirgends als Ziel oder Anzeige in der App.

## Aufgabensätze (Version 1.1)

Das Training läuft in Sätzen: eine Runde mit 5, 10, 15 oder 20 Aufgaben (Einstellung, Standard 10). Danach folgt eine
Ergebnisseite mit Quote, Tempo und einer **Einordnung nach festen Regeln** (keine KI):

- Richtwert aus den Maia-Werten der Aufgaben: wie viele Spieler deiner Stärke in diesen Stellungen den besten Zug finden.
- Tempo: richtige Antworten innerhalb des Zeitlimits, Hinweis bei vielen zu langsamen. Maßgeblich ist die Note beim Antworten
  (mit dem damals eingestellten Limit), so wie sie auch die Wiederholung plant.
- Muster: Fehler in unter 3 Sekunden gelten als vorschnell.
- Stärke und Schwäche nach Partiephase, Fehlerart und Motiv (ab zwei Aufgaben je Gruppe), Vergleich mit den letzten 5 Sätzen.

Jede Antwort im Verlauf trägt `set: { id, n }`. Dadurch laufen Sätze automatisch mit dem Abgleich auf das andere Gerät, ohne
Änderung am Dateiformat. Nur der laufende Satz liegt lokal (`localStorage`, wird nach 6 Stunden nicht mehr fortgesetzt).
Die Wiederholungsplanung (FSRS) bleibt unverändert, ein Satz zieht nur Aufgaben aus derselben Warteschlange.

## Start: Startbild mit Spruch

Beim Öffnen erscheint ein Startbild mit einem Spruch, als Urheber steht „Big Dog“ (`src/lib/quotes.ts`, 45 Sprüche). Es ist Satire
auf übertriebene Männlichkeit im Stil der Big-Dog- und Sigma-Memes: Die Figur behauptet Härte und Souveränität und entlarvt sich
dabei selbst. Die Sprüche werden gemischt und komplett durchlaufen, bevor sich einer wiederholt (Reihenfolge in `localStorage`,
nur auf dem Gerät). Das Startbild bleibt mindestens so lange, wie man zum Lesen braucht (2,8 s bei kurzen, bis 4 s bei langen
Sprüchen, `readTimeMs`), solange Daten und Stand nicht geladen sind auch länger. Tippen überspringt es. Abschaltbar unter
Einstellungen → Darstellung → „Startbild“.
`Heute` beginnt mit einer dunkelgrünen Fläche (Fortschritt, Kennzahlen, Hauptknopf) statt einer Reihe gleichartiger Karten. Die
Startfarbe steht schon in `index.html`, damit beim Öffnen nichts weiß aufblitzt.

**iPad: fehlender Streifen und iOS-Startbild.** Gemessen auf einem iPad Pro 12,9" (quer): Bildschirm 1366×1024, Fenster der
installierten App 1366×992, es fehlen 32 Punkte oben. Das Startbild wird auf Tablets um diesen Streifen nach oben verlängert
(`src/lib/viewport.ts`) und deckt so den ganzen Bildschirm ab. Die Figur hat eine feste Stelle, das Zitat steht darunter. Davor zeigt
iOS ein eigenes Startbild (`apple-touch-startup-image`, `public/launch/`, erzeugt mit `tools/make-launch-images.mjs` aus dem echten
Startbild), damit der Übergang ohne Sprung bleibt. **Wichtig:** iOS liest das Startbild nur beim Hinzufügen zum Home-Bildschirm.
Nach Änderungen die App vom Home-Bildschirm entfernen und neu hinzufügen (der Fortschritt kommt über den Abgleich zurück). Weitere
Geräte: Eintrag in `DEVICES` im Skript und eine `<link>`-Zeile in `index.html`. Bisher nur iPad Pro 12,9".

**Anzeige-Info** (Einstellungen, ganz unten): Fenstergröße, sichtbarer Bereich, Sicherheitsränder, Modus und ein Verlauf der
Fenstergröße seit dem Start. Eine kleine Messung im `<head>` von `index.html` schreibt schon vor Stil und App mit (Fenster, außen, Position, Zeitpunkte, erstes Zeichnen) und erscheint ebenfalls dort. Zur Fehlersuche bei Darstellungsproblemen auf dem iPad (z. B. Startbild im Querformat nicht mittig:
im Testbrowser ist es in jeder Größe exakt mittig, das Verhalten von iPadOS ist von hier nicht nachstellbar).

## Marke: Big Dog

App-Symbol und Startbild zeigen den Bulldoggen-König (schwarz, heller Rand, goldene Krone und Stachelhalsband). Auf dem Brett
ist nur der König (mit Krone) in Weiß und Schwarz eine Bulldogge, alle übrigen Figuren inklusive Bauer bleiben klassisch
(cburnett). Der Bulldoggen-Bauer war zu schwer vom König zu unterscheiden, vor allem unter Zeitdruck. Alles entsteht aus einer Quelle: `tools/brand.mjs` schreibt `src/assets/pieces/{wK,bK}.svg`,
`src/assets/brand/king.svg` und `public/icons/*`. Die Entwürfe und Alternativen liegen in `design/logo-optionen/`.
Nach einer Änderung auch die iOS-Startbilder neu erzeugen (`tools/make-launch-images.mjs`). Ein neues Symbol auf dem
Home-Bildschirm erscheint erst, wenn die App dort neu hinzugefügt wird.

## Letzter Zug des Gegners

Vor jeder Aufgabe zeigt das Brett erst die Stellung davor, spielt dann den letzten Gegnerzug (mit Zugton, Hervorhebung und
Tag „Gegner: 26.Ne5+“) und gibt erst danach frei. **Die Zeit läuft erst ab der Freigabe.** Abschaltbar unter Training
(„Letzter Zug des Gegners“). Die Daten stehen in `exercises.json` als `prev` (Figurenstellung davor, Zug als UCI und SAN) und
stammen aus den Rohpartien (`analysis/build_exercises.py`, braucht `data/games_raw.jsonl`).

## Töne

Die Töne entstehen im Browser (Web Audio): Rauschstöße und Sinustöne, keine Dateien. Das ist lizenzfrei und funktioniert offline.
Die Holzklänge von lichess („Standard“) stehen laut `COPYING.md` unter „nicht frei“, die freien Reihen (AGPL) klingen nach
Science-Fiction. Töne: Figur anklicken, Zug, Schlagzug, unzulässiger Zug, richtig, richtig aber langsam, falsch, Uhr (Start,
Ticks in den letzten 3 Sekunden, Ablauf), Auswahl im Menü, Satz geschafft. **Nie zwei Töne gleichzeitig:** `sound.ts` enthält einen kleinen Mixer. Jeder Ton hat einen Rang und eine Regel
(unterbrechen, einreihen oder verwerfen). Ergebnis-Töne reihen sich hinter dem Zugton ein, Klick-Töne werden verschluckt,
solange etwas klingt, ein Zugton unterbricht leisere Töne mit kurzem Ausblenden. Das ist als reine Funktion getestet,
auch mit Zufallsfolgen (`tests/sound.test.ts`). Lautstärke, Uhr-Ton und Stummschalter gelten nur
für das jeweilige Gerät (`device.ts`) und werden nicht abgeglichen. In den Einstellungen unter „Töne anhören“ lässt sich jeder
Ton einzeln abspielen.

## Abgleich zwischen iPhone und iPad

Jedes Gerät hält den vollständigen Stand lokal und arbeitet offline. Der Abgleich ist optional und läuft
ohne eigenen Server über **eine Datei** (`road-to-gm/state.json`) in einem **privaten** GitHub-Repository
(Contents-API, Token mit Recht „Contents: Read and write“ nur für dieses Repository).

- **Zusammenführen statt überschreiben:** Das Antwort-Protokoll beider Geräte wird vereinigt (Schlüssel
  `id|ts`), die Wiederholungs-Karten werden daraus mit FSRS neu berechnet. Ausgeblendete Aufgaben und
  Einstellungen gelten nach „zuletzt geändert gewinnt“, der Bonus pro Tag nach Maximum.
  Zurücksetzen setzt eine Epoche; ältere Einträge werden auf allen Geräten verworfen. Wann die Epoche festgelegt wurde,
  steht in `epochTs`, und die jüngere Festlegung gilt: Das Wiederherstellen einer Sicherung legt deren Epoche neu fest und
  holt so den Stand nach einem Zurücksetzen auf allen Geräten zurück.
- **Auslöser:** App-Start, 15 s nach einer Änderung, Verlassen der App, Wechsel in den Vordergrund (mindestens 30 s
  Abstand), Wieder-online. iOS erlaubt keinen Abgleich im Hintergrund.
- **Schutz:** Öffentliche Repositories werden abgelehnt. Eine nicht lesbare Datei wird nie überschrieben.
  Bei gleichzeitigem Schreiben (409/422) wird neu gelesen und erneut zusammengeführt. Antworten von GitHub werden nie aus
  dem Browser-Cache gelesen (`cache: 'no-store'`): GitHub erlaubt 60 s Cache, der Abgleich sähe sonst alte Stände.
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
