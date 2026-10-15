# Road to GM – Konzept

Stand: 15.10.2026 · Status: Ideation, noch kein Code

## 1. Kernidee in einem Satz

Eine App, die alle deine Online-Partien (lichess + chess.com) automatisch auswertet, herausfindet **wo genau du deine Punkte verlierst**, daraus ein kurzes tägliches Training aus **deinen eigenen Stellungen** baut und misst, ob es wirkt.

Der Kreislauf: **Diagnose → Rezept → Training → Messung**.

## 2. Was es schon gibt und was fehlt

| Tool | Was es gut kann | Was dir fehlt |
|---|---|---|
| chess.com Game Review + Coach | Einzelpartie-Analyse, Zugklassifizierung, Erklärungen | Immer nur eine Partie, keine Muster über hunderte Partien, nur chess.com-Partien |
| chess.com Insights (Premium) | Statistiken: Eröffnungen, Genauigkeit nach Phase, Tageszeit | Zeigt *was*, nicht *warum*; keine konkrete Trainingskonsequenz |
| chess.com Puzzles / Lessons | Riesige Menge Material | Generisch, nicht aus deinen Fehlern; wird von dir selten genutzt |
| lichess (Analyse, Insights, Puzzle-Dashboard, Explorer) | Gratis; Puzzle-Statistik nach Themen; Eröffnungsdatenbank nach Rating filterbar | Puzzles sind fremde Stellungen; keine Kombination mit chess.com |
| Aimchess | Stärken/Schwächen-Profil aus lichess + chess.com (u. a. Zeitmanagement, Verwertung) | Profil eher grob, Training eher generisch |
| Chessbook / Chessable | Eröffnungsrepertoire mit Spaced Repetition | Fokus auf Auswendiglernen; Repertoire-Pflege kostet viel Zeit |
| OpeningTree | Zeigt deinen eigenen Eröffnungsbaum | Nur Exploration, keine Bewertung, kein Training |
| KI-Coaches (z. B. Take Take Take, ChessHere) | LLM erklärt Engine-Ergebnisse in Alltagssprache | Meist pro Partie, kein langfristiges Profil über beide Plattformen |
| Maia (Forschungsprojekt, Open Source) | Menschenähnliche Engine pro Ratingstufe | Kein Produkt, aber ein wertvoller Baustein |

**Die Lücke, die diese App füllt:**

1. **Plattformübergreifend**: lichess und chess.com als ein Spielerprofil.
2. **Muster statt Einzelpartie**: „Fehler-Fingerabdruck“ über hunderte Partien.
3. **Training aus deinen eigenen Fehlern** mit Spaced Repetition, statt fremder Puzzles.
4. **Uhr-Analyse** für kurze Zeitmodi (Bedenkzeit vs. Schwierigkeit der Stellung).
5. **Wirksamkeit messen**: Sinkt die Fehlerquote bei Motiv X wirklich?

## 3. Einschätzung zu „Eröffnungen“

In kurzen Zeitmodi auf Amateurniveau entscheiden erfahrungsgemäß vor allem taktische Fehler und Zeitnot die Partien, Eröffnungstheorie seltener. Eröffnungen lohnen sich trotzdem, nur anders als klassisch gedacht:

- **Nicht**: Theorie auswendig lernen (Chessable-Stil).
- **Sondern**: **Eröffnungs-Lecks** finden. Das sind die konkreten Stellungen in deinem Repertoire, die du oft erreichst und in denen du regelmäßig schlecht stehst oder viel Zeit verbrauchst. Priorität = Häufigkeit × durchschnittlicher Verlust.
- **Und**: Zeit sparen. In Blitz ist eine sicher und schnell gespielte Eröffnung ein echter Vorsprung auf der Uhr.

Statt nach Bauchgefühl entscheidet die Diagnose: Wenn die Eröffnung 10 % deiner verlorenen Punkte ausmacht, bekommt sie etwa 10 % der Trainingszeit.

## 4. Herzstück: der Punkte-Verlust-Report

Jeder Zug wird mit Stockfish bewertet und in Gewinnwahrscheinlichkeit umgerechnet. Jeder Zug, der viel Gewinnwahrscheinlichkeit kostet, wird entlang mehrerer Dimensionen eingeordnet:

| Dimension | Beispiele | Datenquelle |
|---|---|---|
| Phase | Eröffnung / Mittelspiel / Endspiel | Zugnummer, Material, Eröffnungsdatenbank |
| Fehlertyp | Figur eingestellt, gegnerische Drohung übersehen, eigene Taktik verpasst, Vorteil nicht verwertet, schleichender Positionsverlust | Engine-Varianten + Motiv-Tagger |
| Taktisches Motiv | Gabel, Fesselung, Grundreihe, Abzug, Überlastung … | Motiv-Tagger aus lichess-puzzler (Open Source), angewendet auf die Widerlegung |
| Uhr | Zeitnot (wenig Restzeit), Schnellschuss (< 2 s in kritischer Stellung), zu lange überlegt in einfacher Stellung | Uhrzeiten im PGN (`%clk`) |
| Kontext | Partie Nr. X der Session, direkt nach Niederlage, Tageszeit, Zeitmodus, Farbe | Zeitstempel der Partien |

Das Ergebnis sieht dann etwa so aus (**Zahlen frei erfunden, nur zur Illustration**):

> Von deinen verlorenen Punkten der letzten 6 Monate entfallen 34 % auf übersehene gegnerische Drohungen (vor allem Gabeln mit dem Springer), 22 % auf Zeitnot unter 15 Sekunden, 14 % auf nicht verwertete Gewinnstellungen und 9 % auf die Eröffnung, davon die Hälfte auf eine einzige Abzweigung im Sizilianer.

## 5. Module

### A. Fehler-Trainer (eigene Stellungen, Spaced Repetition)

- Jede kritische Stellung aus deinen Partien wird zur Übung: „Finde den besseren Zug“ oder „Was droht der Gegner?“
- Spaced Repetition wie bei Karteikarten: falsch → morgen wieder, richtig → in 3, 7, 21 Tagen.
- Woodpecker-Prinzip: dieselben Muster so oft wiederholen, bis sie automatisch sitzen.
- Ergänzt durch lichess-Puzzles genau zu deinen schwachen Motiven (die lichess-Puzzle-Datenbank ist frei verfügbar und nach Themen getaggt).
- Blitz-tauglich: Übungen mit Zeitlimit, weil du Muster in Blitz schnell erkennen musst.

### B. Eröffnungs-Lecks

- Dein tatsächlicher Eröffnungsbaum aus allen Partien beider Plattformen.
- Pro Stellung: Häufigkeit, Ergebnis, Bewertung nach ~15 Zügen, Zeitverbrauch.
- Leck-Liste, z. B. „Nach 1.e4 c5 2.Sf3 d6 3.d4 spielst du … – 23 Partien, 35 % Score.“
- Pro Leck eine Empfehlung (Engine plus das, was auf deinem Niveau tatsächlich funktioniert: lichess-Explorer nach Rating gefiltert bzw. Maia) und ein kleiner Drill.
- Kein komplettes Repertoire, nur die größten Lecks stopfen.

### C. Uhr-Coach (für kurze Zeitmodi)

- Zeit pro Zug im Verhältnis zur Schwierigkeit der Stellung (Kritikalität = wie viel schlechter der zweitbeste Zug ist).
- Typische Muster sichtbar machen, z. B. „In bekannten Eröffnungsstellungen überlegst du lange, in kritischen Stellungen ziehst du in unter 2 Sekunden.“
- Fehlerquote nach Restzeit; Vergleich der Zeitmodi (z. B. 3+0 vs. 3+2) mit Empfehlung.

### D. Verwertung & Endspiel

- Wie oft gewinnst du klar gewonnene Stellungen, wie oft rettest du klar verlorene?
- Training: Gewinnstellungen aus deinen eigenen Partien gegen einen menschenähnlichen Bot (Maia auf deinem Niveau) zu Ende spielen.

### E. Tilt & Session-Regeln

- Leistung nach Niederlagen, nach X Partien am Stück, nach Uhrzeit.
- Persönliche Regeln aus deinen Daten, z. B. „Nach 2 Niederlagen in Folge sinkt dein Score deutlich → Pause.“

### F. Coach-Loop: das, was bisher fehlt

Übungen gibt es genug (chess.com Premium). Das Problem ist, dass sie nicht auf dich zugeschnitten sind und es Überwindung kostet, sie zu machen. Deshalb muss Training extrem niedrigschwellig sein:

- **10-Minuten-Tagesration**, fertig zusammengestellt, ohne Auswahl.
- **Warm-up vor dem Blitzen**: 3 eigene Fehlerstellungen.
- **Automatischer Import**: Die Fehler von gestern sind heute Übung.
- **Wochenbericht**: Was hat sich verändert (z. B. „Gabel-Fehler pro 100 Partien gesunken“)?

## 6. Wo KI Sinn macht und wo nicht

| Einsatz | Werkzeug | Begründung |
|---|---|---|
| Stellungen bewerten, beste Züge finden | ✅ Stockfish, ❌ kein LLM | LLMs rechnen Schach unzuverlässig und erfinden Züge. Die Engine ist hier unschlagbar und kostenlos. |
| „Menschliche“ Schwierigkeit: Welchen Fehler macht man auf meinem Niveau typischerweise? | ✅ Maia (neuronales Netz) | Auf Millionen menschlicher Partien je Ratingstufe trainiert. Trennt „Fehler, den fast jeder macht“ von „Fehler, den du vermeiden solltest“. |
| Fehler in Worten erklären | ✅ LLM, aber geerdet | Das LLM bekommt Engine-Varianten, Motiv-Tags, Material und Uhrzeit und formuliert nur. Es bewertet nichts selbst. |
| Wochenbericht & Trainingsplan | ✅ LLM | Aus Statistiken wird ein priorisierter Plan in verständlicher Sprache. |
| Chat mit deinen Daten | ✅ LLM + Datenbankzugriff | „Warum verliere ich gegen das Londoner System?“ → Abfrage, Beispielpartien, Antwort. |
| Fehler kategorisieren | ⚠️ zuerst feste Regeln, LLM nur für Grenzfälle | Regeln sind nachvollziehbar, reproduzierbar und kostenlos. |

Die Kosten bleiben überschaubar: Die Engine läuft lokal, und Erklärungen werden einmal pro Stellung erzeugt und gespeichert.

## 7. Daten: Was benötigt wird

Kein manueller Export nötig. Beide Plattformen haben öffentliche APIs:

- **lichess**: `https://lichess.org/api/games/user/<name>` liefert PGN inkl. Uhrzeiten, Eröffnung und, falls vorhanden, Engine-Bewertungen.
- **chess.com**: `https://api.chess.com/pub/player/<name>/games/archives` liefert monatliche Archive mit PGN inkl. Uhrzeiten.

Beide APIs sind aus der Entwicklungsumgebung erreichbar (getestet am 15.10.2026).

Von dir gebraucht:

1. Benutzernamen auf lichess und chess.com.
2. Hauptzeitmodus (Bullet / Blitz / Rapid) und ungefähres Rating.
3. Realistisches Zeitbudget fürs Training und bevorzugtes Gerät (Handy / Desktop).
4. Optional: deine eigene Vermutung, wo deine Schwächen liegen, zum Abgleich mit den Daten.

## 8. Technik-Skizze (Vorschlag)

- **Analyse-Pipeline**: Python, `python-chess`, Stockfish, später Maia. Speicher: SQLite oder DuckDB.
- **Rechenaufwand**: Mit begrenzter Suchtiefe einige Sekunden pro Partie. Für ~1000 Partien einmalig wenige Stunden, danach nur neue Partien.
- **App**: Web-App als PWA (lässt sich auf dem Handy wie eine App installieren). Brett: `chessground`, das Open-Source-Brett von lichess.
- **KI**: Claude über die API für Erklärungen, Wochenbericht und Chat.

## 9. Fahrplan

| Phase | Inhalt | Ergebnis |
|---|---|---|
| 0 – Diagnose | Partien laden, analysieren, Punkte-Verlust-Report als einmalige Auswertung | Klarheit, welche Module sich für dich lohnen |
| 1 – MVP | Fehler-Trainer mit Spaced Repetition, Eröffnungs-Lecks, tägliche 10-Minuten-Session, Auto-Import | Erste nutzbare App |
| 2 | Uhr-Coach, Tilt-Regeln, KI-Wochenbericht | Vollständiges Profil |
| 3 | Chat-Coach, Maia-Sparring aus eigenen Stellungen, Fortschrittsmessung | Persönlicher Coach |

**Erfolgsmessung**: Rating schwankt stark und ist deshalb nur Nebenmetrik. Hauptmetrik sind die verlorenen Punkte pro Partie je Kategorie: Sinken sie dort, wo trainiert wird?

## 10. Referenzen

- lichess API: <https://lichess.org/api>
- chess.com Published-Data API: <https://www.chess.com/news/view/published-data-api>
- lichess-puzzler (Puzzle-Generator und Motiv-Tagger): <https://github.com/lichess-org/lichess-puzzler>
- chessground: <https://github.com/lichess-org/chessground>
- Maia Chess: <https://www.maiachess.com>
- OpeningTree: <https://www.openingtree.com>
- Take Take Take: „Building a Chess Coach“ (Engine bewertet, LLM erklärt): <https://ai.engineer/talks/building-a-chess-coach>
- chess.com Premium-Pläne: <https://support.chess.com/en/articles/8562418-what-does-each-level-of-membership-get-me>
