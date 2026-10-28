# Road to GM: App

Persönlicher Schach-Trainer als installierbare Web-App (PWA) für iPhone und iPad. Deutsch, hell und dunkel,
offline nutzbar, kein Konto und kein eigener Server. Fortschritt liegt auf dem Gerät und gleicht sich
optional über eine Datei in einem privaten GitHub-Repository zwischen den Geräten ab.

Stand: Version 1.3 (faires Urteil über alle Züge, ehrlicher Richtwert, Erstversuch-Quote, Widerlegung nach Fehlern; davor 1.2: Update-Weg, tolerantes Dateiformat, Prüfsatz, Wiedereinstieg nach Pausen, Auswertung für Claude; davor 1.1: Aufgabensätze mit Ergebnis und Einordnung, Töne, Layouts für iPhone und iPad hoch und quer, letzter
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
node tools/e2e-judge.mjs /tmp/j    # faires Urteil und Widerlegung mit den echten Übungsdaten
node tools/e2e-endgame.mjs /tmp/eg  # Endspiel: Startknopf, 15 s, exakte Wertung, Fehler aus der Partie mit Widerlegung
node tools/e2e-win.mjs /tmp/w       # "Sicher gewinnen": Zielzeit, jeder sichere Zug zählt, Wortlaut, Mischung
node tools/e2e-variation.mjs /tmp/v # Variantenansicht: festes Brett, Auswahl, Bewertungsbalken, Tastatur, Wischen, alle Formate
node tools/e2e-games.mjs /tmp/g    # Partien holen (chess.com und lichess nachgebaut), Karten auf Heute und Fortschritt, Offline, Ausschalten
node tools/layouts.mjs /tmp/lay    # Bildschirmfotos aller Ansichten in sechs Geräteformaten
npx vite --port 4175 &  node tools/sound-check.mjs   # Pegelprüfung der Töne, ohne Lautsprecher
```

## Version 1.13.1: Auswertung über beide Geräte, Schutz des Speichers

- **Auswertung über alle Geräte.** „Auswertung kopieren“ gleicht vorher ab (höchstens 10 s), rechnet dann aus dem zusammengeführten Stand und sagt, was drin ist: „Sie umfasst alle 2 abgeglichenen Geräte“ oder „Achtung: Sie enthält nur dieses Gerät“. Im Text steht `abgleich` (aktiv, letzter Abgleich, Fehler, umfasst). Das Kopieren läuft unter iOS mit verzögertem Inhalt (ClipboardItem mit Versprechen), weil Safari sonst nach dem Abgleich nicht mehr kopieren dürfte.
- **Dauerbrenner mit deinen Zügen** (`zuege`: „Nc7 falsch“, „Re8 bester“): Derselbe falsche Zug immer wieder ist ein blinder Fleck, wechselnde knapp daneben eher eine strenge Wertung.
- **Speicher nie leer überschreiben** (`store.ts`). Konnte die App ihren Stand beim Start nicht lesen, startete sie früher leer, und das nächste Speichern überschrieb den echten Stand. Jetzt: zwei weitere Versuche, sonst eine Meldung („App ganz schließen und neu öffnen, es wurde nichts überschrieben“). Unlesbarer Inhalt wird unter einem eigenen Schlüssel aufgehoben.

## Version 1.13: Heute auf einen Blick

- **Je Art ein Knopf mit einer Zahl:** „Fehler-Training starten · 54 offen“ statt der Reihe Satz/Fällig/Lernen/Neu. Die Zahl ist alles, was heute noch dran ist (Wiederholungen, Lernschritte und neue zusammen), die Satzgröße steht in den Einstellungen. Ein pausierter Satz zeigt seinen Stand als Punktreihe im Knopf („weiter“, ●●●●○○○○○○ 4 von 10).
- **Heute erledigt als Zeichenreihe:** je Satz eine Reihe mit einem Zeichen pro Aufgabe (● richtig, ○ zu langsam, × falsch, · offen), darunter eine Zeile mit Aufgaben, Quote und Ø Zeit. Die Bedeutung steckt in der Form, die Farbe hilft nur, deshalb bleibt es auch bei Rot-Grün-Schwäche und im Dunkelmodus lesbar (`src/views/Dots.tsx`).
- **Startbild:** fängt Tipps auch beim Ausblenden ab, ein Tipp zum Überspringen landet nicht mehr auf dem Knopf darunter.

## Version 1.12: Durchsicht von 1.8 bis 1.11

Drei unabhängige Prüfungen (Logik, Bedienung im Browser auf iPhone- und iPad-Größe, Daten) und die Korrekturen daraus:

- **Kosten des Fehlzugs richtig gerechnet** (`analysis/why.py`). Die Zeile „du verlierst …“ wurde ab der Stellung nach deinem Zug gerechnet, was dein Zug selbst geschlagen hatte, fehlte: 135 Zeilen nannten einen Verlust, wo es ein Abtausch war („Lxh6 … du verlierst einen Läufer“), 164 übertrieben. Jetzt zählt die Rechnung ab der Stellung vor dem Zug, ein Abtausch erscheint nicht mehr als Verlust.
- **Umwandlung ist kein Damengewinn.** „Du gewinnst die Dame für einen Bauern“ hieß früher: Du wandelst um. Jetzt: „bekommst du eine neue Dame“, beim Gegner „der Gegner bekommt eine neue Dame“. Umgewandelte Figuren werden Feld für Feld verfolgt.
- **Gewinn muss halten.** Ein Gewinn zählt nur, wenn die Linie ihn bis zum Ende behält (kein „gewinnst du einen Springer“, der nach einem Zwischenschach zurückgeht), und ein Schlag am Linienende nur, wenn die beste Antwort nichts zurückholt. Im Remis-Endspiel entfällt „gewinnst du …“, dort geht es ums Halten. Motive fehlen nicht mehr, wenn der letzte Zug des Gegners eine Rochade war.
- **Endspiele exakt** (`build_exercises.py`). 17 Endspiel-Stellungen steckten als Stockfish-Übung im Fehler-Training (einige werteten verlierende Züge als richtig). Sie sind jetzt Endspiel-Aufgaben mit Tablebase-Wertung, dein Lernstand bleibt erhalten; die zwei im Prüfsatz bleiben unverändert. Eine Übung entfällt, weil dein Partiezug laut Tablebase gar kein Fehler war.
- **Pausierter Satz bleibt.** Jede Art hat ihren eigenen Platz für den laufenden Satz: Wer Fehler-Training pausiert und kurz ins Endspiel schaut, kann danach dort weitermachen.
- **„5 weitere neue Aufgaben“ gilt nur für die Art, in der du tippst** (`bonusBy` in der Sync-Datei, ältere Versionen reichen es weiter).
- **Einstellungen im Abgleich:** Bei gleichem Zeitpunkt entscheiden beide Geräte gleich. Ein älteres Gerät setzt neuere Felder (Zeitlimits je Art) nicht mehr auf die Vorgabe zurück. Nie geänderte Einstellungen bekommen die aktuellen Vorgaben (Fehler-Training 20 s statt früher 10 s).
- **Kleinere Korrekturen:** Die Zeitplanung des Tages rechnet nur mit Fehler-Aufgaben. Ein alter Filter „Sicher gewinnen“ leert das Fehler-Training nicht mehr. Die Satzauswertung zählt Endspiele nicht doppelt und nennt den Filter nur im Fehler-Training, und sie nennt das Limit, das beim Antworten galt. Nach einer richtigen Umwandlung steht die neue Figur auf dem Brett. „Für heute erledigt“ nennt die Art und was in den anderen noch offen ist. Fortschritt: Satz-Kurve nur Fehler-Training (andere Arten als Zeile), Fehlerarten ohne „Sicher gewinnen“ und „Endspiel“. Die Auswertung für Claude enthält die Warteschlangen aller Arten.
- **Abdeckung danach:** Fehler-Training 824 von 1.182 Aufgaben mit Motiv oder Gewinn, 557 mit den Kosten des Partiezugs. Es sind weniger als vorher, weil unsichere Aussagen jetzt wegfallen.

## Version 1.11: Idee zum besten Zug

- **Warum der Zug richtig ist** (`analysis/why.py`, `src/lib/why.ts`). Für jede Aufgabe wertet der Motiv-Erkenner von lichess (derselbe, mit dem lichess seine Puzzles taggt) die beste Linie aus: Der letzte Zug des Gegners ist der „Fehler“, die beste Linie die Lösung. Dazu kommt, was die Linie bringt (Matt in N oder Material in Worten: „die Qualität“, „einen Springer für einen Bauern“), vorsichtig gerechnet: Ein Schlag zählt erst nach der Antwort des Gegners. Für deinen Partiezug und die wahrscheinlichen Fehlzüge steht, was die Widerlegung kostet.
- **Auf der Ergebnisseite** (nur nach deiner Antwort): eine hervorgehobene Zeile „Idee: Gabel, Fesselung. Nach 23.Sd5 Dd8 24.Sxc7 gewinnst du die Qualität.“ Bei deinem Fehlzug: „Nach 23.Lxf7 folgt Kxf7 24.Sg5+, und du verlierst einen Läufer.“ Ohne greifbare Taktik sagt sie das ehrlich: bei eigenen Patzern „Keine eigene Taktik: Wichtig ist, nichts einzustellen“ (mit der Drohung des Gegners), sonst „Hier geht es um die Stellung“. Bei „Sicher gewinnen“ entfällt sie, dort zählt Tempo.
- **Abdeckung.** Fehler-Training: Bei 868 von 1.200 Aufgaben gibt es ein Motiv oder einen Gewinn (vorher bei 503 ein Motiv), bei 654 die Kosten des Partiezugs.

## Version 1.10: Endspiel

- **Der Befund.** In 271 deiner Partien gab es Endspiele mit höchstens 7 Steinen. Von 132 Gewinnstellungen hast du 88 gewonnen: 36-mal wurde aus Gewinn Remis, 8-mal Verlust, und 17 von 33 Remisstellungen gingen verloren. Am häufigsten in Turm- und Leichtfigurenendspielen, und 58 % dieser Züge fielen in Zeitnot.
- **Die Aufgabe** (`Exercise.tb`, `analysis/endgame_positions.py`). Deine Stellungen mit Gewinn oder Remis, exakt bewertet mit der lichess-Tablebase: Für jeden legalen Zug ist bekannt, ob er gewinnt, remisiert oder verliert. Richtig ist jeder Zug, der das Ergebnis hält (`judge.ts`), der schnellste Gewinn heißt „bester Zug“. Ausgewählt sind Stellungen, in denen etwas zu entscheiden war (mindestens ein Zug hält, mindestens zwei verspielen, höchstens 60 % der Züge sind richtig), deine eigenen Fehler zuerst, höchstens vier je Partie.
- **Im Training.** Dritter Startknopf „Endspiel starten“ auf Heute, eigener Satz, eigene Warteschlange, Zeitlimit 15 s (Einstellungen). Die Aufforderung nennt das Ziel („Gewinnstellung: Finde einen Zug, der gewinnt“ oder „Remisstellung: … hält“), die Ergebnisseite sagt „hält den Gewinn“, „nur noch Remis“ oder „verliert“ und was in der Partie passiert ist („aus Gewinn wurde Remis“). Dein Fehler aus der Partie wird mit der besten Antwort des Gegners vorgeführt, der Balken fällt dabei von Gewinn (100) auf Remis (50) oder Verlust (0). Die Variante zeigt die beste Linie der Tablebase.
- **Später:** „Zu Ende spielen“ gegen die Tablebase (sie verteidigt perfekt) und eine Analyse danach. Die Tablebase erlaubt Abfragen direkt aus dem Browser (CORS), braucht dann aber Internet.

## Version 1.9: zwei Spielmodi, keine Mischung im Satz

Mit 10 Sekunden Zeit kosten schon ein bis zwei Sekunden Nachsehen, welche Art Aufgabe gerade dran ist. Deshalb wählt man die Art vorher:

- **Heute hat zwei Startknöpfe:** *Fehler-Training starten* und *Sicher gewinnen starten*, jeder mit eigenen Zahlen (Satz, Fällig, Lernen, Neu). Ein Satz enthält nur eine Art (`ActiveSet.mode`, `queue.ts`: `pickNext`/`counts` mit Art). Die Mischung „jede fünfte neue Aufgabe“ aus 1.7 entfällt. Die Kopfzeile im Satz nennt die Art („Fehler-Training · Aufgabe 3 von 10“), die Zeit läuft mit dem Limit der Art (20 s bzw. 10 s, getrennt einstellbar).
- **Getrennt geführt:** eigene Obergrenze neuer Aufgaben pro Tag je Art, eigene Wiederholungen und Rückstandsdeckel; die Zeitrechnung des Tagesziels (1.6) gilt für das Fehler-Training. Die Filter aus den Einstellungen (Phase, Fehlerart, Motiv) gelten nur dort, „Sicher gewinnen“ nimmt immer alle Stellungen und ist nicht mehr als Fehlerart wählbar. Der Vergleich mit den letzten Sätzen und die Liste „Heute erledigt“ nennen die Art.
- **Ein liegengebliebener Satz** lässt sich nur über den Knopf seiner Art fortsetzen („… weiter (3 von 10)“); der Knopf der anderen Art startet einen neuen Satz.

## Version 1.8: zwei Arten von Aufgaben, je mit eigener Zeit

- **Zwei Arten, klar benannt** (`src/lib/limit.ts`): *Fehler-Training* (Stellungen mit einem Fehler aus deinen Partien, meist schwierige Situationen im Mittelspiel, gesucht ist der beste Zug) und *Sicher gewinnen* (klar gewonnene Stellungen, gesucht ist irgendein sicherer Zug, schnell). Die Aufforderung unter dem Brett beginnt mit dem Namen der Art, die Auswertung unter Fortschritt hat die Karte „Nach Art der Aufgabe“, und die Satzauswertung nennt jede Art mit ihrer eigenen Zeile und Zielzeit.
- **Standardzeiten, einstellbar** (`Settings.timeLimit`, `Settings.winLimit`, in den Einstellungen unter Training): Fehler-Training 20 s, Sicher gewinnen 10 s, jeweils 5 s bis 30 s oder aus. Die Werte gehen wie alle Einstellungen über den Abgleich. Bestehende Werte bleiben, die neue Einstellung bekommt auf bestehenden Geräten den Standard 10 s. Der Wert `limit` in den Daten von „Sicher gewinnen“ wird nicht mehr gelesen.
- **Sicherung der Rohdaten.** `analysis/backup_data.sh` und `analysis/restore_data.sh`: `data/` liegt jetzt zusätzlich in einem privaten Repo (LaurensDo/road-to-gm-data), siehe `analysis/README.md`.

## Version 1.7: „Sicher gewinnen“

- **Der Befund.** Von 791 Partien, in denen du mindestens 90 % Gewinnchance hattest, hast du 17 % noch verloren, 101 davon auf Zeit. Zu langes Nachdenken in einer gewonnenen Stellung kostet mehr als ein nicht ganz bester Zug. Die App übte bisher nur das Gegenteil, den besten Zug zu finden.
- **Die Aufgabe** (`Exercise.win`). Stellung aus deinen Partien, in der du klar gewonnen stehst (`analysis/win_positions.py`: dein Zug, Zug 12 bis 55, mindestens 90 %, mindestens 5 s gebraucht oder unter 40 s auf der Uhr, nicht im Schach, höchstens zwei je Partie). Behalten wird sie nur, wenn mindestens drei Züge den Vorteil sicher halten (Gewinnchance mindestens 80 %, höchstens drei Viertel aller legalen), aber auch mindestens vier Züge ihn klar verspielen. Richtig ist **jeder** Zug, der die Gewinnstellung hält, unabhängig von der Einstellung „Gleichwertige Züge“ (`judge.ts`). Knapp darunter (bis 15 Punkte) ist „spielbar“, tiefer „falsch“. Zielzeit 5 Sekunden statt des normalen Limits (ab 1.8: eigene Einstellung, Standard 10 s).
- **Im Training.** (Bis 1.8: jede fünfte neue Aufgabe, ab 1.9 eigener Satz mit eigenem Startknopf.) Jede fünfte neue Aufgabe ist eine solche Stellung (`queue.ts`: `WIN_EVERY`, die dritte, achte, … aller je gesehenen, unabhängig davon, wie viele du schon hast). Sie laufen wie normale Aufgaben durch den Wiederholungsplan, bekommen den Tag „Klar gewonnen“ und die Aufforderung „Zieh einen sicheren Zug, ohne zu grübeln“. Die Ergebnisseite nennt, ob dein Zug die Gewinnstellung hält, und die weiteren sicheren Züge. Der Filter „Fehlerart“ in den Einstellungen kennt sie als „Sicher gewinnen“.
- **Statistik.** Der Vergleich eines Satzes mit dem Richtwert (Spieler deiner Stärke) zählt nur Aufgaben, die einen Richtwert haben. „Sicher gewinnen“ ist leichter und hätte die Quote sonst angehoben. Für diese Aufgaben gibt es keinen Richtwert und keine gerechneten Bewertungen je Halbzug; der Bewertungsbalken bleibt bei ihnen auf dem Wert der Linie.
- **Tipp-Fehler behoben.** Chessground merkt sich die Lage des Bretts und las sie nur beim Scrollen oder bei Größenänderung des Bretts neu. Rutschte das Brett von einer Aufgabe zur nächsten um eine Zeile (zweizeilige Kopfzeile durch viele Tags, z. B. „Klar gewonnen“), traf ein Tipp das Nachbarfeld. Jetzt liest das Brett die Lage nach jeder Layoutänderung neu (`refreshBoardBounds`), und eine neue Aufgabe beginnt oben auf der Seite.
- **Rechnung.** `python analysis/win_positions.py` (Stockfish, etwa eine Stunde), danach `python analysis/build_exercises.py`. Ändern sich die Schwellen, `data/win_positions.jsonl` löschen und neu rechnen.

## Version 1.6: Fehler später wiederholen, Tagesziel in Minuten, vorläufiges Urteil

- **Falsche Aufgaben kommen frühestens nach zehn Minuten wieder** (`srs.ts`, Lern- und Wiederholungsschritt 10 Minuten statt 1 und 5). Vorher kam ein Fehler im nächsten Satz zurück, wenn die Lösung noch im Kurzzeitgedächtnis stand. Das übt das Merken, nicht das Finden. Jetzt liegt Zeit und mindestens ein Satz dazwischen, bei kurzen Sitzungen meist der nächste Tag. Der Wiederholungsplan wird aus dem Verlauf neu berechnet, bereits gespeicherte Antworten behalten ihre Noten.
- **Ein Ziel: die Minuten** (`queue.ts`: `taskSeconds`, `MIN_NEW`). „Neue Aufgaben pro Tag“ ist jetzt eine Obergrenze. Die App schätzt aus deinen letzten Antworten (Median der Zeit je Aufgabe ohne die Zeit in Varianten, solange weniger als 20 vorliegen: 30 s), wie viele Aufgaben in dein Tagesziel passen, und gibt weniger neue frei, wenn Wiederholungen den Platz füllen (mindestens 3). Am Rückstandstag gilt wie bisher der Deckel.
- **Uhr-Karte: vorläufiges Urteil ab 20 Partien** (`basis.ts`: `compareRange`, `PRELIM_MIN`). Davor stand nichts bis zur Mindestmenge von 120. Jetzt vergleicht die Karte schon ab 20 Partien mit dem Bereich deiner Monatswerte und sagt es dazu („Vorläufig …“). Ab 120 Partien gilt wie bisher der Zufallsbereich der Stichproben.

## Version 1.5.1/1.5.2: lichess-Partien vollständig

lichess hängt bei Partien, die nicht mit einem Zug enden (Zeit, Aufgabe), die Uhr beim Ende als zusätzlichen Eintrag an `clocks`. 1.4 und 1.5
haben diese Partien verworfen (Zahl der Uhren ≠ Zahl der Züge) und nur Mattpartien gezählt: vom 15. bis 19.10. 4 von 25 Bullet-Partien,
ausgerechnet ohne die Zeitverluste. Jetzt wird der Eintrag abgeschnitten. Der Nachbau in `tools/mock-games.mjs` liefert ihn jetzt auch. Weil lichess schrittweise ab der letzten
gespeicherten Partie geholt wird, kämen die verworfenen nie nach: 1.5.2 merkt sich den Stand der Leselogik (`parser`) und holt bei älterem
Bestand die lichess-Partien einmal ab dem Stichtag neu, sofort beim Öffnen (außer das Holen ist ausgeschaltet).

## Version 1.5: Variantenansicht und Bewertungsbalken

- **Feste Leiste.** „Variante ansehen“ öffnet unten eine Leiste, die stehen bleibt: Auswahl der Variante, Zugliste mit Zugnummern (seitlich scrollbar, der aktive Zug wandert in die Mitte), ◀ ▶, die Gewinnchance der Stellung und „Fertig“ (zurück zu „Weiter“). Im Hochformat bleibt das Brett oben stehen (`position: sticky`, nur im einspaltigen Layout; im Querformat steht es ohnehin neben dem Text). Zusätzlich: Pfeiltasten (iPad mit Tastatur) und Wischen auf dem Brett.
- **Mehrere Varianten** (`src/lib/variation.ts`). Zur Auswahl stehen der beste Zug, alle gleichwertigen Linien aus den fünf gespeicherten (nach der Einstellung „Gleichwertige Züge“, wie in der Wertung), dein Zug und der Zug aus der Partie, soweit dazu eine Variante gespeichert ist (Linie oder Widerlegung). Gleichwertige Züge außerhalb der fünf besten haben keine Variante und stehen weiter nur als Text da (208 Übungen).
- **Bewertungsbalken** (`EvalBar`). Links neben dem Brett, im Seitenrand. Er zeigt die Gewinnchance des Spielers, der in der Übung am Zug ist (unten, also immer aus deiner Sicht), für die Stellung, die das Brett zeigt. Nach einem falschen Zug fällt er gleich auf den Wert deines Zuges und folgt der vorgeführten Widerlegung, danach steht er wieder auf dem Wert der Stellung. Einstellung „Bewertungsbalken“ (nur dieses Gerät): *Nach dem Zug* (Standard), *Auch in der Aufgabe*, *Aus*. In der Aufgabe ist er aus gutem Grund standardmäßig aus: Er verriete, ob in der Stellung etwas los ist.
- **Daten.** `analysis/ply_evals.py` rechnet einmalig mit Stockfish (150.000 Knoten je Stellung) die Gewinnchance nach jedem Halbzug der besten und der gleichwertigen Linien und der Widerlegungen. `build_exercises.py` legt sie als `ev` an die Linien und als drittes Element an die Widerlegungen (`[Zug, Folgezüge, ev]`), Halbzug 1 stammt aus den tiefen Werten. Fehlen sie (ältere Daten, schwächere Linien), bleibt der Balken auf dem Wert der Linie stehen. Ehrlich gesagt: Entlang einer besten Linie ist die Bewertung ungefähr konstant (das ist es, was „beste Linie“ heißt, sie schwankt nur um wenige Punkte); sichtbar verändert sie sich beim eigenen Fehler, beim Wechsel der Variante und in Abtauschfolgen.
- **Zeit.** Die Zeit in der Variantenansicht steckt weiter in `dur` (zählt zum Tagesziel) und steht zusätzlich als `pv` am Eintrag. „Auswertung für Claude“ nennt unter `varianten14Tage`, bei wie vielen Antworten sie geöffnet wurde und wie viele Minuten darin steckten, damit „Aufgaben pro 15 Minuten“ nicht verzerrt gelesen wird.

## Version 1.4: die Uhr-Schleife (Partien holen und auswerten)

Die App sieht jetzt deine echten Partien, damit die Übungen und die Uhr zusammenkommen. Schwerpunkt ist 3+0, Bullet läuft getrennt.

- **Holen** (`src/lib/gamesStore.ts`). Beim Öffnen und beim Zurückkehren in die App, höchstens alle zehn Minuten, dazu die Knöpfe „Jetzt holen“ (Heute, Einstellungen) und „Alles neu holen“. chess.com: Monatsarchiv von `chesscom` ab dem 15.10.2026; vergangene, vollständige Monate werden nicht noch einmal geholt. lichess: `/api/games/user/<name>?since=…&clocks=true&perfType=bullet,blitz` als NDJSON. Beide Seiten erlauben den Zugriff aus dem Browser (CORS). Die Archivverzögerung bei chess.com liegt unter einer Minute (gemessen am 17.10.2026). Nur Bullet und Blitz in Standardschach. Die Namen der Gegner werden nie gelesen oder gespeichert.
- **Speicher.** IndexedDB `road-to-gm-games-v1`, nur auf dem jeweiligen Gerät. Die Partien laufen nicht über den Abgleich, jedes Gerät holt selbst. Die Sicherung enthält sie nicht. In den Einstellungen unter „Deine Partien“ lassen sich das automatische Holen ausschalten und die Benutzernamen ändern (`device.ts`: `games`, `chesscom`, `lichess`).
- **Heute: „Deine Partien“.** Oben die eine Regel (aus `public/data/regel.json`), dann „3+0 seit gestern“ mit Zug 30 im Budget und auf Zeit verloren mit Mehrmaterial, eine eigene Bullet-Zeile (Vorsprung vor Zug 20) und die letzten fünf Blitzpartien. Jede Partie zeigt zwei Marken, ✓ im Budget, ○ knapp darunter, – Partie war vorher zu Ende, nie ein rotes Kreuz. Aufgeklappt: Uhr vor Zug 30, die längste Denkpause mit Mini-Brett und der Link zur Partie. Die Fokus-Karte ist darunter einklappbar („Dein Fokus laut Diagnose“, ohne die Regel).
- **Fortschritt: „Uhr in deinen Partien“** (`ClockCard`). Eigene Zeit von Zug 16 bis 29, Vorsprung vor Zug 30, Denkpausen über 10 s je Partie, Budget-Quoten, jeweils neben der eingefrorenen Basis (`public/data/uhr-basis.json`, erzeugt mit `node tools/make-baseline.mjs` aus den Partien vor dem 15.10.; die Rohdaten liegen nicht im Repo). Ein Urteil („besser / im normalen Bereich / schlechter“) gibt es erst ab 120 3+0-Partien mit Uhr vor Zug 30, Bullet ab 600. Der normale Bereich ist das, was der Zufall bei dieser Zahl von Partien erklärt (`basis.ts`). Darunter laufender Durchschnitt über 20 Partien mit dem Streifen der Monatswerte.
- **Definitionen** (`src/lib/gameStats.ts`, mit Tests in `tests/games.test.ts`). „Uhr vor Zug N“ ist die Restzeit nach dem eigenen Zug N−1. Denkpause: mindestens 10 s auf einem eigenen Zug 15 bis 35 (Inkrement abgezogen). Budget in 3+0: Uhr vor Zug 20 mindestens 2:00, vor Zug 30 mindestens 1:20, bei anderer Grundzeit entsprechend skaliert, ohne Inkrement. Qualitätsbremse: Material, das nach einem Zug unter 2 s bei mindestens 30 s Restzeit binnen zwei Halbzügen verloren geht.
- **Die Regel** liegt als öffentliche Datei `data/regel.json` und ändert sich nur, wenn du es willst. Ein iOS-Kurzbefehl kann sie mit „Inhalte von URL abrufen“ lesen und beim Öffnen von chess.com oder lichess als Mitteilung zeigen.
- **Nicht gebaut (bewusst):** „In lichess-Analyse öffnen“ (iOS blockiert das Fenster nach einem Netzwerkaufruf) und Denkpausen vormerken (`kind: 'mark'`). Beides gehört zu Schritt 5, wenn es einen Ort gibt, an dem die vorgemerkten Stellungen landen.

## Version 1.3: faires Urteil, ehrlicher Richtwert, Widerlegung

**Faires Urteil** (`analysis/all_moves.py`, `judge.ts`). Bis 1.2 kannte jede Übung nur die fünf besten Züge. In 240 von 1.200 Übungen
lagen alle fünf innerhalb von 10 Punkten: Jeder andere gute Zug wurde als „falsch“ gewertet und kam nach einer Minute wieder. Jetzt
bewertet Stockfish für jede Übung alle legalen Züge (zuerst schnell, nahe an der Grenze „10 Punkte hinter dem besten“ genauer; Übungen,
in denen schon der fünfte Zug weit zurückliegt, entfallen, weil alle anderen sicher schlechter sind). Gespeichert sind alle Züge bis 40
Punkte hinter dem besten (`more`, SAN und Gewinnchance). Was in keiner Liste steht, liegt mindestens `COVER_WP` (30) Punkte zurück und
gilt als falsch. Die Ergebnisanzeige nennt zum eigenen Zug Gewinnchance und Abstand („Auch gut: …“, „3 Punkte weniger als der beste“).
Alte Antworten behalten ihr damaliges Urteil (Absicht: Der Wiederholungsplan wird aus dem Verlauf berechnet und muss auf beiden Geräten
gleich ausfallen; nachträgliches Umwerten mit Daten, die ein Gerät noch nicht hat, würde sie auseinanderlaufen lassen).

**Richtwert** (`analysis/maia_ok.py`, `skill.ts`). Der Maia-Richtwert zählte bisher nur den einen besten Zug und schmeichelte damit jeder
Quote. Jetzt speichert die Datei die ganze Maia-Verteilung und rechnet daraus `maia.ok`: die Wahrscheinlichkeit, dass ein Spieler deiner
Stärke einen Zug findet, den die App als richtig wertet (`ok0` für „Nur der beste“). Die Einordnung der Sätze und die neue Karte
„Erster Versuch an neuen Aufgaben“ unter Fortschritt vergleichen damit. Die Karte zählt nur den ersten Versuch je Aufgabe (spätere
messen auch Erinnerung), nimmt ein Fenster der letzten 50, zeigt den normalen Bereich (95 %, aus den Wahrscheinlichkeiten der einzelnen
Stellungen) und urteilt erst ab 20 Aufgaben mit drei Wörtern: über dem Richtwert, im normalen Bereich, unter dem Richtwert. Nie rot.

**Widerlegung und Drohung** (`analysis/refutations.py`). Nach einem falschen Zug führt das Brett vor, wie der Gegner ihn bestraft (seine
Antwort und die folgenden zwei Züge, Tippen überspringt), danach erscheinen die Pfeile. Bei Fehlern, die eine Drohung übersehen
(Figur eingestellt, Taktik übersehen, Matt übersehen), zeigt ein blasser Pfeil, was der Gegner gedroht hat (Nullzug-Analyse, nur bei
echter Drohung). Widerlegungen gibt es für den Partiezug und die bis zu zwei wahrscheinlichsten Fehlzüge laut Maia; für jeden anderen
falschen Zug zeigt die App weiter nur die Gewinnchance. Der Hinweis „Derselbe Zug wie in der Partie“ erscheint, wenn man den Fehler aus
der Partie wiederholt.

**Motive** (`explain.ts`). Motive wurden vorher nicht unterschieden: „Matt in 1“ konnte heißen, dass man selbst mattsetzen konnte oder
gematt wurde. Jetzt: „Der Gegner droht: Matt in 2“, „Der Gegner nutzt aus: Gabel“ und, wo es nichts auszunutzen gab („Gegnerfehler nicht
bestraft“), „In der besten Fortsetzung steckt: Hängende Figur“ (`missed` aus dem Diagnose-Lauf).

**Reihenfolge neuer Übungen** (`order_by_priority`). Die Datei ist nicht mehr nach dem Verlust von früher sortiert (vorn lagen die
gröbsten Fehler, hinten feinere Stellungsfehler). Vorn liegen jüngere Partien, Leichtsinn, hängende Figur und Gabel, Mittelspiel von
Zug 15 bis 35. Zeitnot-Stellungen bekommen keinen Bonus. In jedem Block von zehn: höchstens ein „Gegnerfehler nicht bestraft“, höchstens zwei
„Positioneller Fehler“ ohne Motiv, mindestens drei der Maia-Klasse „Nächste Stufe“. Datenstand 2 (`dv: 2`).

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
