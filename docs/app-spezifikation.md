# Road to GM – App-Spezifikation (Entwurf)

Stand: 16.10.2026 · Status: Version 1 und 1.1 umgesetzt und auf iPhone und iPad im Einsatz, Phase 2 offen. Abschnitte 1 bis 8 beschreiben das Zielbild, umgesetzt ist, was in 9a und 10 steht. Der Entwurf für die Zeit nach 1.1 steht in [roadmap-entwurf.md](roadmap-entwurf.md).

## 1. Was die App ist

Eine installierbare **Web-App für iPhone und iPad** (Safari → „Zum Home-Bildschirm“). Deutsch, hell und dunkel, nach dem ersten Laden offline nutzbar. Kein Konto, kein eigener Server.

Zweck: Die Befunde aus der Diagnose (Phase 0) abtrainieren. Größter Hebel ist die Uhr, danach hängende Figuren und Gabeln, Gewinnstellungen verwerten, ein paar Eröffnungs-Lecks.

## 2. Bereiche

| Bereich | Was du tust | Warum (Diagnose) | Version |
|---|---|---|---|
| **Heute** | Ein Tipp startet einen Aufgabensatz (Standard 10 Aufgaben), Fortschrittsbalken zum Tagesziel (15 min). Geplant: Wechsel mit Taktik-Sprint und Gewinn-Drill. | Training muss ohne Überwindung starten | 1 (Satz), Phase 2 (Wechsel) |
| **Fehler-Trainer** | Stellungen aus deinen eigenen Partien (1.200). Zug auf dem Brett ausführen, Timer läuft (Standard 10 s). Danach Erklärung. Wiederholung nach Plan. | 49 % der Fehler sind trainierbar | 1 |
| **Taktik-Sprint** | Puzzles der lichess-Datenbank auf deinem Niveau, Themen nach deinen Schwächen (hängende Figur, Gabel, Fesselung, Matt in 1 und 2). 3-Minuten-Runden mit Uhr. | Hängende Figuren 23 pro 100 Partien | Phase 2 |
| **Uhr-Coach** | (a) Gewinn verwerten: Stellung aus deinen Partien mit mindestens 90 % Gewinnchance, du spielst mit 1 Minute gegen Stockfish zu Ende. (b) Zeitbudget-Check: Restzeit bei Zug 20 und 30 gegen das Ziel 2:00 und 1:20. | 101 von 136 verlorenen Gewinnstellungen auf Zeit | Phase 2 |
| **Eröffnungs-Lecks** | Die in der Praxis bestätigten Lecks als Karten: „Welcher Zug?“ Mit Explorer-Zahlen für Spieler deiner Stärke. | 11 von 17 Lecks bestätigt | 2 |
| **Fortschritt** | Kennzahlen im Verlauf: Zeitverluste pro 100 Partien, Restzeit bei Zug 30, hängende Figuren und Gabeln pro 100 Partien, Trefferquote und Tempo im Training. Basis ist die Diagnose vom 15.10.2026. | Wirkung messen statt raten | 1 (Training), 2 (Partien) |

## 3. Fehler-Trainer im Detail

- **Stellung:** FEN, Seite am Zug, Herkunft (Partie-Link, Datum), Phase, Motive (lichess-Themen), Restzeit in der Partie, Zeit, die du damals gebraucht hast.
- **Lösung:** Die besten bis zu 5 Züge mit Gewinnchance (Stockfish, MultiPV). Nicht nur ein „richtiger“ Zug.
- **Wertung:**
  - Richtig: dein Zug liegt höchstens **10 Prozentpunkte** unter dem besten. Gleichwertige Züge zählen also.
  - Richtig, aber zu langsam: gilt als „schwer“ für die Wiederholung.
  - Falsch: Erklärung folgt.
- **Erklärung:** Engine-Variante in Zügen, Motiv, was du damals gezogen hast, wie viele Spieler deiner Stärke den Zug finden (Maia-3), Link zur Partie. Umgesetzt als feste Sätze aus den Daten; eigene Texte von Claude für die wichtigsten Stellungen sind noch offen.
- **Wiederholung:** FSRS (MIT-lizenzierter Algorithmus, auch in Anki). Falsch oder langsam heißt bald wieder, richtig und schnell heißt immer längere Abstände.
- **Filter:** nach Partiephase, Fehlerart und Motiv (umgesetzt). Zeitnot-Fehler und Seite sind noch offen.

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

### Stockfish-Stärke

Stärke ist an drei Stellen unterschiedlich wichtig:

1. **Lösungen der Übungen (wichtigster Hebel):** Die Diagnose lief mit 50.000 Knoten pro Stellung, das ist schnell, aber nicht tief. Für die Übungs-Lösungen rechne ich neu mit mindestens 3 Millionen Knoten und MultiPV 5, dazu mit Stockfish 19 (npm-Paket `stockfish`) oder dem nativen Stockfish 16. Auf den Gewinnchancen der Lösungen beruht, was in der App als richtig zählt.
2. **In der App:** Standard ist die Lite-Version (1,7 MB, immer dabei). Optional in den Einstellungen **„Starke Engine“**: Stockfish 19 mit vollem Netz (≈ 94 MB, einmaliger Download, danach offline), Mehrkern über einen Service-Worker-Trick, Bedenkzeit einstellbar (2 bis 5 s). Ob das auf deinem iPhone flüssig läuft, muss getestet werden. Fällt es durch, bleibt Lite.
   Die große Datei kommt nicht ins Repo: Der Deploy-Workflow lädt sie beim Veröffentlichen aus npm.
3. **Gegner im Gewinn-Drill:** bewusst schwächer (einstellbare Spielstärke), damit Gewinnstellungen realistisch bleiben.

## 5. Daten und neue Partien

- **Start:** Die App kommt mit den vorhandenen Übungen (aus data-backup erzeugt).
- **Neue Partien (Variante A, manuell):** Du sagst im Chat „neue Runde“, Claude importiert, analysiert, erzeugt Übungen und veröffentlicht die Daten. Die App holt sie beim Öffnen.
- **Neue Partien (Variante B, automatisch):** Ein GitHub-Workflow läuft nachts, holt neue Partien von lichess und chess.com, rechnet Stockfish, schreibt neue Übungen. Kostenlos bei öffentlichem Repo. Empfohlen für Version 2.
- **Fortschritt:** liegt lokal auf dem Gerät (IndexedDB) und wird über den Abgleich (nächster Punkt) zwischen den Geräten geteilt. Knopf für Export und Import als Sicherung. Installierte Home-Bildschirm-Apps unterliegen nach heutigem Stand nicht der 7-Tage-Löschregel von Safari, die Sicherung ist trotzdem Pflicht.
- **Abgleich iPhone und iPad (Weg C, umgesetzt):** Eine Datei in einem privaten GitHub-Repository, erreicht über die Contents-API mit einem Token nur für dieses Repository. Kein Server, kein Konto bei Dritten außer GitHub. Die App ist offline-first, der Abgleich holt nach, sobald Netz da ist. Zusammenführung ohne Verlust: Antwort-Protokolle werden vereinigt, Karten daraus neu berechnet. Zurücksetzen gilt für alle Geräte, eine vorher exportierte Sicherung holt den Stand auf allen Geräten zurück. Details in `app/README.md`. Auf iPhone und iPad mit der echten GitHub-API in Betrieb.
- **iOS-Besonderheit:** Die installierte App und Safari haben getrennten Speicher. Erst installieren, dann trainieren. iCloud gleicht Web-Speicher nicht ab, deshalb der Abgleich über GitHub.

## 6. Was die App nicht macht

- Keine Hilfe in laufenden Partien, nur Training und Nachbetrachtung.
- Keine Partien gegen andere Menschen, kein Konto, keine Mehrbenutzer.
- Keine Push-Erinnerungen (iOS braucht dafür einen Server). Erinnerung per Kurzbefehl oder Kalender.
- Kein Ersatz für Game Review auf chess.com, ergänzt es um dein persönliches Profil.

## 7. Technik (am Rande)

- Vite, TypeScript, Preact, Service Worker (offline).
- Brett: [chessground](https://github.com/lichess-org/chessground) (wie lichess, touch-tauglich). Regeln: chessops. Wiederholung: ts-fsrs.
- Geplant (Phase 2): Stockfish-WASM im Web Worker, Puzzle-Teilmenge (rund 3.000) aus der lichess-Puzzle-Datenbank (CC0).
- Open-Source-Lizenzen (GPL) vertragen sich mit einem öffentlichen Repo.

## 8. Festlegungen, die später teuer wären

| Entscheidung | Vorschlag | Alternative |
|---|---|---|
| Wo liegt die App | GitHub Pages, öffentliches Repo | Privat, dann anderer Anbieter (z. B. Cloudflare Pages), etwa 10 min Einrichtung |
| Datenformat der Übungen | MultiPV-Lösung (bis 5 Züge mit Gewinnchance) | Nur ein Lösungszug (einfacher, aber unfair bei gleichwertigen Zügen) |
| Zeitlimit pro Aufgabe | 10 s, einstellbar 5, 10, 20 oder aus | feste Vorgabe |
| Gleichwertige Züge | zählen (bis 10 Prozentpunkte) | nur der beste Zug |
| Stockfish in der App | ja, ab Phase 2 | nein, nur vorberechnete Lösungen |
| Wiederholung | FSRS | einfache feste Abstände |
| Neue Partien | zuerst manuell, ab Version 2 automatisch | dauerhaft manuell |
| Abgleich der Geräte | privates GitHub-Repo, Datei per Contents-API (umgesetzt) | nur manuelle Sicherung; oder eigener Server (Konto, Betrieb) |

Billig zu ändern: Texte, Farben, Reihenfolge der Bereiche, Namen, Anzahl der Aufgaben pro Tag.

## 8a. Perspektive: Partie-Review und Claude-Kommentar (Entwurf, nicht abgestimmt)

Idee: Nach einer Partie sofort eine persönliche Analyse. Aufgeteilt in drei Stufen:

1. **Partie-Review in der App (Empfehlung, Version 2).** Du spielst weiter auf chess.com oder lichess. In der App tippst du auf „Letzte Partie holen“. Die Partien kommen direkt aus den öffentlichen Schnittstellen (am 15.10.2026 geprüft: lichess, chess.com, Endspieldatenbank und Explorer erlauben Abrufe aus dem Browser, CORS ist offen). Stockfish auf dem Handy bewertet die Partie, die App zeigt Zeitverlauf gegen das Zeitbudget, die drei wichtigsten Fehler mit Motiv und legt neue Fehlerstellungen im Trainer an. Läuft nur bei geöffneter App (iOS rechnet nicht im Hintergrund), grob 1 bis 2 Minuten pro Partie (noch zu messen). Kosten: keine.
2. **Claude-Kommentar (Entscheidung später).**
   - Variante A: auf Zuruf im Chat. Die App erzeugt eine Zusammenfassung der Partie zum Einfügen. Keine Zusatzkosten, nicht sofort.
   - Variante B: in der App über die Claude-API. Braucht ein eigenes API-Konto und einen Schlüssel auf dem Gerät, dazu Ausgabenlimit. Grob 1 bis 4 Cent pro Partie je nach Modell (Preisliste vom 06.10.2026, ohne Denk-Token). Der Kommentar bekommt Engine-Linien und Motive als Fakten und formuliert nur. Jeder genannte Zug wird automatisch auf Legalität geprüft, der Kommentar ist als KI-Text gekennzeichnet.
3. **Spielen in der App.** Nur gegen Bots für gezielte Drills (Gewinn-Drill, später evtl. Maia als menschlicher Sparringspartner). Kein Ersatz für chess.com oder lichess: chess.com bietet keine Schnittstelle zum Spielen, lichess hat eine, aber ein Blitz-Client mit Premoves, Wiederverbindung und Uhr wäre ein eigenes großes Projekt.

Schon jetzt festgelegt, damit später nichts umgebaut werden muss:
- Die Analyse ist ein eigenes Modul („Partie analysieren“), das Trainer und Review gemeinsam nutzen.
- Das Datenformat hat ein Feld für Kommentare (pro Partie und pro Stellung).
- Partien werden mit Zügen und Uhrzeiten gespeichert.
- Analyse nur für beendete Partien, nie während einer laufenden.

## 9. Abgestimmte Entscheidungen (15.10.2026)

- Hosting: GitHub Pages mit öffentlichem Repo. ✔
- Gegnernamen aus dem Backup-Branch entfernt. ✔
- Bereiche, Festlegungen aus Abschnitt 8 und Reihenfolge: wie vorgeschlagen. ✔
- Stockfish: Lösungen tiefer neu rechnen (✔, 3 Mio. Knoten, MultiPV 5), in der App Lite plus optional „Starke Engine“ (Phase 2).

- iPad: wird genutzt. Querformat zeigt Brett links und Erklärung rechts, Karten in zwei Spalten. ✔
- Abgleich der Geräte: Weg C (privates GitHub-Repo) von Anfang an. ✔

## 9a. Version 1.1 (umgesetzt)

Feinschliff am bestehenden Umfang, vor Phase 2:

- **Aufgabensätze:** feste Runde (5/10/15/20, Standard 10) mit Ergebnisseite und Einordnung nach festen Regeln. Satz pausieren und fortsetzen, vorzeitig beenden. Verlauf der Sätze unter Fortschritt, heutige Sätze unter Heute. Sätze laufen über den Abgleich auf beide Geräte.
- **Töne:** Figur anklicken, Zug, Schlagzug, unzulässiger Zug, richtig, richtig aber langsam, falsch, Uhr (Start, Ticks in den letzten 3 Sekunden, Ablauf), Auswahl in der Oberfläche, Satz geschafft. Im Browser erzeugt (keine Dateien, keine Lizenzfragen). Nur pro Gerät einstellbar.
- **Layouts:** iPhone quer (Brett links in voller Höhe, Erklärung rechts), iPad hoch (größeres Brett, größere Schrift), iPad quer (Brett links, Erklärung rechts, Karten in zwei Spalten). „Weiter“ steht in einer festen Leiste und ist ohne Scrollen erreichbar.
- **Letzter Gegnerzug vor der Aufgabe:** wird gespielt und hervorgehoben, danach läuft die Zeit (abschaltbar). Entspricht dem Partieverhalten, in dem man immer zuerst den Zug des Gegners sieht. Der Maia-Richtwert wurde mit der echten Zugvorgeschichte der Partie berechnet (bis zu 8 Stellungen davor).
- **Start-Theme:** Startbild mit rotierendem Spruch (45 Satire-Sprüche im Big-Dog-Stil, Urheber „Big Dog“, mindestens 2,8 bis 4 s je nach Länge, Tippen überspringt, abschaltbar, nur pro Gerät) und dunkle Fläche oben auf „Heute“ ohne Begrüßung und Serie. Anzeige-Info in den Einstellungen für Darstellungsprobleme. Auf dem iPad Pro 12,9" fehlen im Fenster 32 Punkte oben (gemessen): Das Startbild gleicht das aus und bekommt ein passendes iOS-Startbild (`apple-touch-startup-image`, nur beim Hinzufügen zum Home-Bildschirm wirksam). Bisher nur für das iPad Pro 12,9"; fürs iPhone fehlt es noch (Modell nötig).
- **Töne ohne Überlagerung:** ein Mixer sorgt dafür, dass immer nur ein Ton klingt (Rang und Regel je Ton).
- **Brett-Markierungen:** gewähltes Feld, erlaubte Zielfelder, Schach und letzter Zug sind jetzt farbig. Das Brett-Thema von chessground war bisher nicht eingebunden.
- **Marke Big Dog:** Bulldoggen-König als App-Symbol und im Startbild, auf dem Brett der König als Bulldogge, der Bauer bleibt klassisch, damit beide unter Zeitdruck sofort zu unterscheiden sind (Quelle `app/tools/brand.mjs`).
- Version 1 ist im Repo als Tag `v1.0` (Commit `edcae70`) festgehalten.

Auf den Geräten bestätigt: Abgleich, Töne, Layouts. Offen aus 1.1: Auf dem iPad quer verrutscht das Startbild beim Öffnen kurz (Ursache noch offen, die Anzeige-Info in den Einstellungen misst es).

## 9b. Version 1.2 (umgesetzt)

Fundament für die Phase 2 aus dem [Roadmap-Entwurf](roadmap-entwurf.md), von dem sich später nichts nachholen lässt:

- **Update-Weg:** Die App bemerkt neue Versionen selbst (`version.json`) und lädt sie auf Heute und Fortschritt, nie in einem Satz. Nach einem Satz erscheint ein Hinweis zum Antippen.
- **Tolerantes Dateiformat:** `minReader`, mitgeführte unbekannte Felder, Geräteliste mit App-Versionen, `lim` und `dv` an jeder Antwort, `kind` für spätere Antwortarten. Version 1.1 kann die Datei weiter lesen.
- **Prüfsatz:** 60 Übungen nur für einen späteren Monats-Check, nie im Training.
- **Wiedereinstieg:** nach Pausen zuerst die sichersten Karten, Rückstand auf 30 Wiederholungen pro Tag begrenzt, dazu 3 neue.
- **Heute:** Fokus-Karte korrigiert (Regel „nicht grübeln“ statt „tauschen und vereinfachen“), Kennzahlen klein unter dem Knopf.
- **Fortschritt:** Trainingstage im Monat statt Serie.
- **Auswertung für Claude:** Knopf in den Einstellungen, nur Zahlen zur Nutzung.

## 9c. Version 1.3 (umgesetzt)

Schritt 2 aus dem [Roadmap-Entwurf](roadmap-entwurf.md): ein Urteil, dem man vertrauen kann.

- **Faires Urteil:** Stockfish hat für jede Übung alle legalen Züge bewertet. In 208 der 1.200 Übungen gab es insgesamt 1.240 weitere gute Züge außerhalb der fünf gespeicherten, die bis dahin als falsch galten. Jetzt zählen sie als richtig, und die Ergebnisanzeige nennt Gewinnchance und Abstand zum besten Zug.
- **Ehrlicher Richtwert:** „Spieler deiner Stärke finden hier einen richtigen Zug in etwa X %“ rechnet mit der ganzen Maia-Verteilung statt nur dem einen besten Zug. Im Mittel 63 % statt 52 %. Sätze und die neue Karte „Erster Versuch an neuen Aufgaben“ vergleichen damit.
- **Widerlegung und Drohung:** Nach einem falschen Zug führt das Brett vor, wie der Gegner ihn bestraft. Bei übersehenen Drohungen zeigt ein blasser Pfeil, was der Gegner vorhatte.
- **Motive:** Unterscheidung zwischen „Der Gegner droht“, „Der Gegner nutzt aus“ und „In der besten Fortsetzung steckt“.
- **Reihenfolge neuer Übungen:** nach Priorität statt nach altem Verlust, mit Mischregeln je zehn Aufgaben.
- **Bewusst anders als im Entwurf:** Alte Antworten werden nicht nachträglich umgewertet (der Wiederholungsplan muss auf beiden Geräten gleich ausfallen). Das Herauslösen der Brett-Komponente aus dem Trainer folgt, wenn sie ein zweiter Modus braucht (Ergebnisseite und ruhige Stellungen), nicht auf Vorrat.

## 9d. Version 1.4 (umgesetzt)

Schritt 3 aus dem [Roadmap-Entwurf](roadmap-entwurf.md): die Uhr-Schleife.

- **Partien holen:** automatisch beim Öffnen (höchstens alle 10 Minuten) und per Knopf, aus dem chess.com-Monatsarchiv und der lichess-Export-Schnittstelle. Nur Bullet und Blitz, ab dem 15.10.2026, ohne Gegnernamen, nur auf dem jeweiligen Gerät in IndexedDB. Abschaltbar in den Einstellungen.
- **Heute:** Die Karte „Deine Partien“ ersetzt die Fokus-Karte: eine Regel, ein positives Fazit („3+0 seit gestern“, Zug 30 im Budget, auf Zeit verloren mit Mehrmaterial), eine Bullet-Zeile, die letzten fünf Blitzpartien mit Budget-Marken, längster Denkpause mit Mini-Brett und Link. Keine roten Kreuze, kein Tagesziel.
- **Fortschritt:** „Uhr in deinen Partien“: eigene Zeit von Zug 16 bis 29, Vorsprung vor Zug 30, Denkpausen, Budget-Quoten, neben einer eingefrorenen Basis (die 299 letzten 3+0-Partien vor dem 15.10.). Ein Urteil erst ab 120 Partien (Bullet: 600), dazu der normale Bereich der Monate.
- **Abweichungen vom Entwurf:** Die Denkpausen der Basis liegen bei 2,62 je Partie statt 2,16 (die App zählt nur Partien, die Zug 30 erreichen, und zieht das Inkrement ab); Basis und App rechnen mit derselben Funktion, der Vergleich bleibt also stimmig. „In lichess-Analyse öffnen“ und das Vormerken von Denkpausen sind nicht gebaut (siehe Roadmap, Schritt 5). Das Archiv von chess.com liefert eine Partie nach unter einer Minute, es braucht keinen Hinweis auf Verzögerung.
- **Privatsphäre:** Der Repo enthält nur die Basis-Kennzahlen (`uhr-basis.json`) und die Regel (`regel.json`), keine Partien, keine Namen. Die Benutzernamen liegen als Geräteeinstellung im Browser.

## 9e. Version 1.5 (umgesetzt)

Einschub „Varianten“ aus dem [Roadmap-Entwurf](roadmap-entwurf.md), auf Wunsch von Laurens.

- **Variantenansicht:** Brett oben fest, untere Leiste mit Variantenauswahl, Zugliste, Vor/Zurück und „Fertig“. Pfeiltasten und Wischen funktionieren auch. Keine Scrollerei beim Durchklicken.
- **Weitere gute Züge:** Auswahl aus bestem Zug, gleichwertigen Linien (soweit unter den fünf gespeicherten), eigenem Zug und Partiezug, jeweils mit Zugliste. Der eigene falsche Zug zeigt seine Widerlegung.
- **Bewertungsbalken:** Gewinnchance aus Sicht des Spielers, nach dem Zug (Standard), auf Wunsch auch in der Aufgabe, oder aus. Nach einem Fehler fällt er sichtbar. Die Werte je Halbzug sind einmalig vorgerechnet, nicht live berechnet.
- **Bewusst nicht:** Live-Stockfish im Browser und freies Ausprobieren von Zügen mit Bewertung (7 bis 10 MB, iOS nur single-threaded, Zahlen würden von den gespeicherten abweichen). Freies Ausprobieren ohne Bewertung wäre ohne Motor möglich, wurde aber nicht beauftragt.
- **Zeit in Varianten:** zählt zur Trainingszeit, wird aber getrennt als `pv` erfasst und in der Auswertung genannt.

## 9f. Version 1.6 (umgesetzt)

Auf Wunsch von Laurens nach dem Gebrauch im Alltag.

- **Fehler später:** Eine falsche Aufgabe kommt frühestens nach zehn Minuten wieder (vorher eine, bei Rückfällen fünf). Begründung: Direkt danach wiederholt man nur, was noch im Kurzzeitgedächtnis ist.
- **Ein Ziel:** Das Tagesziel in Minuten bestimmt, wie viele neue Aufgaben freigegeben werden. „Neue pro Tag“ ist nur noch die Obergrenze.
- **Vorläufiges Urteil:** Uhr-Karte ab 20 Partien, am Bereich der Monatswerte gemessen und als vorläufig gekennzeichnet.
- **lichess-Korrektur (1.5.1/1.5.2):** Partien mit Zeitverlust oder Aufgabe wurden bis dahin verworfen.

## 9g. Version 1.7 (umgesetzt)

Aus der Analyse der eigenen Partien: Gewonnene Stellungen gehen verloren, weil zu lange nachgedacht wird (Spezifikation 4, Roadmap Schritt 5, hier mit „klar gewonnen“ statt „ruhig“ vorgezogen).

- **Sicher gewinnen:** Stellungen aus deinen Partien mit mindestens 90 % Gewinnchance. Richtig ist jeder Zug, der die Gewinnstellung hält (mindestens 80 %), in 5 Sekunden Zielzeit. Jede fünfte neue Aufgabe, durch den normalen Wiederholungsplan, mit eigenem Tag und eigenem Wortlaut. Keine Gewinn- oder Verlustzahlen aus Maia, kein Richtwert.
- **Bewusst anders als im Entwurf (Schritt 5):** keine „ruhigen Stellungen“ aus Denkpausen und kein eigener Pool außerhalb des Wiederholungsplans. Eine Gewinnstellung ist leichter zu definieren (Gewinnchance) als „ruhig“, und der Befund dafür ist klar. Ruhige Stellungen mit mehreren gleich guten Zügen bleiben als mögliche Ergänzung.
- **Prüfen:** Nach 2 Wochen Nutzung zählt die Auswertung für Claude (unter `varianten14Tage` und den Sätzen), ob die Gewinnstellungen die Sätze verlängern, und in den Partien, ob „Zug 30 im Budget“ steigt.

## 9h. Version 1.8 (umgesetzt)

Auf Wunsch von Laurens: Man soll bei jeder Aufgabe wissen, was man trainiert.

- **Zwei benannte Arten:** Fehler-Training (Fehlerstellungen, bester Zug) und Sicher gewinnen (klar gewonnene Stellungen, sicherer Zug, Tempo).
- **Zwei Zeiten:** Fehler-Training 20 s, Sicher gewinnen 10 s als Standard, beide in den Einstellungen änderbar.
- **Getrennt ausgewiesen:** Aufforderung unter dem Brett, Satzauswertung und die Karte „Nach Art der Aufgabe“ unter Fortschritt.
- **Datensicherung** der Rohdaten in einem privaten Repo.

## 9i. Version 1.9 (umgesetzt)

Auf Wunsch von Laurens: zwei Spielmodi. Wer unter 10 Sekunden zieht, kann nicht auch noch nachsehen, welche Art Aufgabe gerade dran ist.

- **Zwei Modi, zwei Startknöpfe auf Heute:** Fehler-Training und Sicher gewinnen. Ein Satz enthält nur eine Art, keine Mischung innerhalb eines Satzes (ersetzt die Mischung aus 9g).
- **Getrennte Warteschlangen:** je Art eigene Fälligkeiten, Obergrenze neuer Aufgaben und Rückstand; Filter nur für das Fehler-Training; Vergleich mit früheren Sätzen nur innerhalb einer Art.
- **Erkennbar:** Kopfzeile im Satz, Ergebnis, Heute und Fortschritt nennen die Art.

## 9j. Version 1.10 (umgesetzt)

- **Endspiel:** dritter Modus mit Stellungen aus deinen Partien (höchstens 7 Steine), exakt bewertet mit der Tablebase. Richtig ist jeder Zug, der das Ergebnis hält. Zeitlimit 15 s, eigener Satz und eigene Warteschlange.
- **Als Nächstes (abgestimmt, nicht gebaut):** nach der Aufgabe die Stellung gegen die Tablebase zu Ende spielen und danach analysieren (online).

## 9k. Version 1.11 (umgesetzt)

- **Idee zum besten Zug:** Motiv der besten Linie (lichess-Tagger), was sie bringt (Matt oder Material in Worten) und was der eigene Fehlzug kostet. Nur Fakten aus Engine-Linien und Material, kein freier Text; wo nichts Greifbares ist, sagt die App das.

## 9l. Version 1.12 (umgesetzt)

- **Durchsicht von 1.8 bis 1.11** mit Korrekturen: Kosten des Fehlzugs ab der Stellung vor dem Zug, Umwandlung als „neue Dame“, Gewinn nur wenn er hält; Endspiel-Stellungen im Fehler-Training durch Tablebase-Aufgaben ersetzt; laufender Satz und „5 weitere neue“ je Art getrennt; Einstellungen im Abgleich deterministisch und ohne Rückfall auf Vorgaben durch ältere Geräte.

## 9m. Version 1.13 (umgesetzt)

- **Heute auf einen Blick:** je Art ein Startknopf mit einer Zahl (heute offen), pausierter Satz als Punktreihe; erledigte Sätze als Zeichenreihe je Aufgabe (richtig, zu langsam, falsch, offen) und eine Summenzeile statt Zahlenblöcken.

## 10. Reihenfolge

1. **Version 1 bis 1.13 (gebaut):** Heute, Fehler-Trainer (mit Wiederholung), Fortschritt (Training), offline, Sicherung, Abgleich, Aufgabensätze, Töne, Layouts für iPhone und iPad.
2. **Phase 2 (Funktionen):** Uhr-Coach mit Gewinn-Drill, Taktik-Sprint, Stockfish-Prüfer.
3. **Version 2:** Eröffnungs-Lecks, automatischer Import, Wochenbericht, Endspiel-Prüfung mit der Syzygy-Datenbank.
