# Road to GM – Roadmap nach Version 1.1 (Entwurf)

Stand: 17.10.2026 · Status: Entwurf, abgestimmt; Schritte 1 bis 3 und der Einschub Varianten gebaut (Versionen 1.2 bis 1.5).

Entstanden aus sechs unabhängigen Blickwinkeln (Lernwissenschaft, Motivation und Gewohnheit, Blitz-Trainer, Wirkungsmessung, Produkt und UX im Code, Spieldesign) mit 55 Ideen, gebündelt zu 29 Kandidaten, bewertet von vier Juroren (Spielstärke, Spaß und Regelmäßigkeit, Machbarkeit, Skeptiker) und danach auf Lücken geprüft. Die Kernzahlen wurden gegen die Partiedaten nachgerechnet. Die Entscheidungen am Ende trifft Laurens.

## Entscheidungen vom 17.10.2026

- Vorrangig verbessert werden soll **3+0** (chess.com). Bullet wird mit geholt und getrennt ausgewertet, ist aber nicht das Ziel.
- Der Prüfsatz (60 Übungen) wird zurückgehalten. Umgesetzt in 1.2.
- „Serie“ unter Fortschritt entfällt, stattdessen „Trainingstage im Monat“. Umgesetzt in 1.2.
- Reihenfolge wie vorgeschlagen: erst Fundament (1.2), dann faires Urteil, dann die Uhr-Schleife, danach Big Dog auf der Ergebnisseite.
- Partien werden automatisch beim Öffnen geholt.

### Stand der Umsetzung

- Schritt 1 (Version 1.2): umgesetzt und veröffentlicht am 17.10.2026.
- Schritt 2 (Version 1.3): faires Urteil über alle Züge, Richtwert `maia.ok`, Erstversuch-Karte, Widerlegung und Drohungspfeil, Motive, Reihenfolge nach Priorität umgesetzt. Offen aus Schritt 2: das Herauslösen der Brett-Komponente (folgt mit Schritt 4 oder 5, wenn ein zweiter Nutzer sie braucht), „ruhige Stellungen“ als vorgerechnete Kandidaten (gehört zu Schritt 5), Umwerten alter Antworten (bewusst weggelassen, siehe Spezifikation 9c).
- Schritt 3 (Version 1.4): Partien aus chess.com und lichess holen, Karten „Deine Partien“ (Heute) und „Uhr in deinen Partien“ (Fortschritt) mit eingefrorener Basis umgesetzt. Offen aus Schritt 3: „In lichess-Analyse öffnen“ und das Vormerken von Denkpausen (`kind: 'mark'`) wandern zu Schritt 5. Abweichung: Die Denkpausen der Basis liegen bei 2,62 je Partie statt 2,16, weil die App nur Partien zählt, die Zug 30 erreichen, und das Inkrement abzieht. Nach der ersten echten Nutzung: Prüfen, ob es auf dem iPhone und iPad wirklich Partien holt (CORS wurde nur mit Mocks und aus der Sandbox geprüft).
- Einschub „Version 1.5: Varianten“ (abgestimmt am 17.10.2026, gebaut und veröffentlicht; Beschreibung siehe Spezifikation 9e; die folgende Planung blieb unverändert): (1) Beim Ansehen einer Variante bleibt das Brett oben stehen, die untere Leiste wird zur Variantenleiste (◀ ▶, Zugliste als Streifen, „Fertig“), dazu Wischen und Pfeiltasten. (2) Linienauswahl: bester Zug, gleichwertige Züge der Top 5 (bei 598 von 1.200 Übungen mindestens einer) und der eigene Zug mit seiner Widerlegung, jeweils durchklickbar. (3) Bewertungsbalken in Gewinnchance aus Sicht des Spielers, erst nach dem eigenen Zug, nicht in der Aufgabe (Schalter in den Einstellungen, standardmäßig aus). Dafür einmal Stockfish je Halbzug der Linien vorrechnen (etwa 30.000 Stellungen, grob eine Stunde, etwa 150 KB, Felder additiv in `exercises.json`). Danach optional: die 208 Übungen, deren gleichwertige Züge außerhalb der Top 5 liegen, mit Varianten nachrechnen. Bewusst nicht: Live-Stockfish im Browser und freies Ausprobieren mit Bewertung (7 bis 10 MB, iOS nur single-threaded, Zahlen würden von den gespeicherten abweichen). Die Zeit in Varianten wird getrennt erfasst, damit „Minuten pro Tag“ und „Aufgaben pro 15 Minuten“ nicht verzerrt werden. Brett, Zugliste und Balken werden zur Brett-Komponente, auf der Schritt 4 aufbaut. Die drei Teile sind einzeln brauchbar und lassen sich auf mehrere Tage verteilen.

## Kernthese

Der größte Hebel ist die Uhr, und zwar vor der Zeitnot, nicht in ihr. In 3+0 denkt er in Zug 15 bis 35 pro Partie 2,16-mal 10 s oder länger nach, seine Gegner 1,46-mal (letzte 300 Partien). Das passiert meist in Stellungen mit mehreren gleich guten Zügen. Dadurch gerät er 2,3-mal so oft in Zeitnot, patzt dort pro Zug aber kaum öfter (unter 10 s 4,7 gegenüber 4,5 pro 100 Züge). Dasselbe Muster zeigt sein Bullet, das er seit März weit häufiger spielt als 3+0: 1.113 von 1.493 Niederlagen in 1+0 kamen auf Zeit, vor Zug 20 liegt er 2,9 s hinter den Gegnern. Die App sieht keine dieser Partien und trainiert nur das Gegenteil, nämlich den versteckten Zug zu suchen. Deshalb kommt zuerst ein Fundament, das sich später nicht nachholen lässt: faires Urteil, Prüfsatz, Update-Weg. Danach die Schleife zu den echten Partien beider Formate, und erst dann die fehlende Entscheidung „Ist hier überhaupt etwas los?“. Die Uhr bringt grob 30 Elo. Darüber hinaus muss er besser spielen als seine Gegner, deshalb bleiben die Übungen der Klasse „Nächste Stufe“ eine feste zweite Spur. Der Spaß bleibt, wo er heute entsteht: faire Urteile, Big Dog an den richtigen Momenten und nie ein Berg fälliger Karten.

## Leitlinien

- Die Uhr zuerst, und zwar vor der Zeitnot. Zeit, die er zwischen Zug 15 und 35 in ruhigen Stellungen spart, hat Vorrang vor Übungen für die Zeitnot selbst (Revanche, Endspiel-Tempo, „Hängt was?“). Auch die Reihenfolge neuer Übungen bevorzugt deshalb keine Zeitnot-Stellungen.
- Zwei Spuren. Die Uhr ist der kurzfristige Hebel (grob 30 Elo). Können ist der langfristige: Die 592 Übungen der Klasse „Nächste Stufe“ bleiben ein fester Anteil (mindestens 3 von 10 neuen) mit großzügigem Limit. Gemessen wird diese Spur über die Erstversuch-Quote gegen p_ok_me und über Patzer ohne Zeitnot aus jeder neuen Runde.
- Echte Partien sind der Prüfstein, aber ehrlich. Ein Urteil gibt es erst ab einer Mindestmenge (3+0: 120 Partien, die Zug 30 erreichen; Bullet: 600 Partien), immer gegen den normalen Bereich seiner Monatswerte. Einzelne Funktionen werden nicht über Partie-Fenster bewertet, denn das Band ist breiter als der erwartete Effekt. Ob eine Funktion bleibt, entscheiden sein Urteil und die Trainingskennzahlen.
- Kein Tempo ohne Qualitätsbremse. Gezählt wird Materialverlust nach schnellen Zügen pro 100 solcher Züge, summiert über mindestens 150 Partien. Als gestiegen gilt die Rate erst ab +50 %. Vorschnelle Fehler kosten in jeder Übung mehr als Langsamkeit.
- Fairness vor Strenge. Ein guter Zug wird nie als falsch gewertet. Alte Antworten werden beim Lesen mit den aktuellen Daten neu gewertet, und zwar nur zu seinen Gunsten. Schwankungen im Rauschen werden nie rot, und es gibt nur drei Urteilswörter.
- Weniger bauen. Phase 2 bringt höchstens zwei neue Modi (Tempo-Satz und „Gegen Big Dog“), jede Version höchstens einen neuen Ablauf, den er bedienen muss. Neue Anzeigen ersetzen möglichst etwas Bestehendes. Jede Funktion hat ein Abbruchkriterium: Nach 2 Wochen fragt die App „bleibt oder raus“, und was 3 Wochen ungenutzt bleibt, fliegt raus.
- Neuheit ist kein Beweis. Die App läuft seit zwei Tagen. Über Ergebnisseite und ruhige Stellungen wird erst nach 2 bis 3 Wochen Nutzungsdaten entschieden.
- Bedingungen statt Kalender. Pakete starten, wenn ihre Voraussetzungen erfüllt sind, nicht nach Wochen. Er spielt zwischen 2 und 116 Partien pro Woche, im September nur 10 Partien in 3+0, aber 922 in Bullet.
- Kein Druck und keine Schuld. Keine Serien, keine roten Reihen, kein „verpasst“, keine Push-Nachrichten. Ein Rückstand wird über mehrere Tage verteilt. Big Dog spottet nur über sich selbst, nie über Laurens oder über ausgelassenes Training.
- Big Dog trägt die Botschaft. Der Humor hängt an messbaren Momenten (langsam richtig, vorschnell falsch, Uhr gehalten), und die sachliche Zeile steht immer gleich groß daneben.
- Zuerst festlegen, was sich später nicht nachholen lässt: Prüfsatz, Zeitlimit und Datenstand je Antwort, tolerantes Datenformat mit Regel zur Kompaktierung, Update-Weg und eingefrorene Basis. Neue Datenarten werden erst geschrieben, wenn beide Geräte sie lesen können.
- Offline, privat, ohne Server. Partien und Verlauf gehören nie ins öffentliche Repo, Gegnernamen werden nie gespeichert. Engine-Arbeit läuft offline bei Claude, auf dem Gerät gibt es Stockfish lite nur für Partien gegen Big Dog.

## Jetzt

### Schritt 1, Version 1.2: das Fundament, das sich später nicht nachholen lässt

Aufwand: M · Kandidaten: K06, K13, K21, neu: Update-Weg, neu: lim/dv je Antwort, neu: Fokus-Karte korrigieren

**Was:** Ein kleines, fast unsichtbares Release. (1) Update-Weg: Beim Öffnen und bei der Rückkehr in den Vordergrund liest die App eine kleine version.json direkt vom Server, am Cache vorbei. Ist sie neuer, ruft die App registration.update() auf, wartet auf controllerchange und lädt neu, aber nur auf „Heute“ oder „Fortschritt“, nie mitten in einem Satz. Nach einem Satz erscheint stattdessen „Neue Version da, tippen zum Laden“ mit Bulldogge. Auf demselben Weg kommen neue Übungsdaten an. Heute laden skipWaiting und clientsClaim die Seite nicht neu, und iOS hält die installierte App tagelang im Speicher. (2) Datenformat: Unbekannte Schlüssel oben in der Sync-Datei werden weitergereicht statt verworfen (normalize, toRemote, fromRemote), und `minReader` ersetzt die starre Prüfung schema === 1. Einträge bekommen ein optionales `kind` (Standard „fehler“). replay() rechnet nur diese; „ruhig“, „mark“, „retry“ und „run“ werden erkannt und weitergereicht. Jede Antwort speichert zusätzlich `lim` (das damals geltende Zeitlimit) und `dv` (den Datenstand der Übung). Ohne diese Felder lassen sich alte Antworten nach dem Datenlauf und nach der Tempo-Leiter nicht neu einordnen. Für die spätere Kompaktierung wird `snap` reserviert (Schnappschuss der Karten bis zu einer Grenze, ähnlich der Epoche). Außerdem wird replay() einmal auf dem iPhone mit einem simulierten Jahres-Log von 20.000 Einträgen gemessen. Jedes Gerät trägt seine App-Version in die Sync-Datei ein, und neue Datenarten werden erst geschrieben, wenn beide Geräte mindestens 1.2 melden. Tests: e2e-Abgleich mit einem Gerät auf 1.1 und einem auf 1.2 sowie mit der echten Sync-Datei. (3) Prüfsatz: 60 Übungen werden geschichtet nach Fehlerart, Phase und Maia-Klasse über die ganze Datei ab etwa Position 150 gezogen; die ersten 30 bis 60 hat er schon gesehen. Markiert werden sie mit `hold: true` direkt in exercises.json, nicht in meta.json, denn loadData() lädt meta.json nur optional und verschluckt Fehler. poolOf() schließt diese Übungen aus. Bereits gesehene IDs gleicht Claude über den Kopierknopf ab und ersetzt sie. Angezeigt wird in 1.2 noch nichts. (4) Kein Berg fälliger Karten: Nach mindestens 4 Tagen Pause beginnt der erste Satz mit den 5 überfälligen Karten, die er am sichersten kann (get_retrievability). Im Rückstand gibt es höchstens 30 Wiederholungen pro Tag, und 3 neue Stellungen kommen trotzdem dazu. Auf „Heute“ steht dann „Rückstand wird über 5 Tage verteilt“. Deckel und Anzeige nutzen dieselbe Funktion in queue.ts. Fällig, Lernen und Neu rücken klein unter den Knopf. Wenn Laurens zustimmt, ersetzt neutral „Trainingstage im Oktober: 9“ die „Serie“ unter „Fortschritt“. (5) Fokus-Karte auf „Heute“ sofort korrigieren: Aus „tauschen und vereinfachen“ wird „Klar gewonnen: Der erste sichere Zug reicht, nicht grübeln“. Aus „vor jedem Zug prüfen, ob eine Figur hängt“ wird „Nach jedem Gegnerzug ein Blick: Was greift er an?“. (6) In den Einstellungen kommt der Knopf „Auswertung für Claude kopieren“ dazu. Er kopiert Trainingstage pro Woche, Minuten pro Tag, „Nächster Satz“ gegenüber „Für heute fertig“, abgebrochene Sätze, die gesehenen Prüfsatz-IDs, Karten mit 3 oder mehr Fehlversuchen und die App-Versionen beider Geräte.

**Warum:** Das sind genau die Dinge, die mit jedem Trainingstag teurer werden. Nur der erste Versuch an einer unbekannten Stellung misst Können. Wegen der Sortierung nach Verlust verschiebt sich die Mischung stark: Die ersten 200 Übungen kosteten in der Partie im Schnitt 68,5 Punkte, die letzten 200 nur 20,5. Die hinteren 500 sind zu 46 % positionelle Fehler, deshalb wird über die ganze Datei geschichtet. fromRemote verlangt heute schema 1 und Noten von 1 bis 3, normalize und toRemote werfen neue Schlüssel weg, und iPhone und iPad laufen nach jedem Update tagelang mit verschiedenen Ständen. Er spielt in Schüben (176 Spieltage in 651 Tagen, 20 Pausen ab 8 Tagen, eine von 122 Tagen). 100 bis 170 fällige Karten bei der Rückkehr sind der typische Moment, in dem man eine Lern-App für immer schließt. Die Fokus-Karte rät heute zum Falschen: In Gewinnstellungen schlägt er so oft wie seine Gegner (27,9 gegenüber 28,0 %), denkt aber öfter länger als 10 s nach (7,6 gegenüber 4,3 %). In 34 % seiner eingestellten Figuren hing die Figur schon nach dem Gegnerzug. Ein Prüfritual vor jedem eigenen Zug kostet genau die Zeit, um die es geht. Der Kopierknopf ist der einzige Weg, auf dem die Messungen dieser Roadmap zu Claude kommen.

**Erfolg:** Kein Formatfehler und kein verlorener Eintrag im Abgleich. Eine neue Version kommt auf beiden Geräten innerhalb eines Tages an, ohne Kaltstart. Vom Prüfsatz sind höchstens 2 Stellungen verbraucht. Nach der ersten Pause ab 4 Tagen folgt innerhalb von 3 Tagen ein zweiter Trainingstag. Mindestens zwei Auswertungen kommen über den Kopierknopf im Chat an.

### Schritt 2: Faires Urteil, richtige Motive, ehrlicher Richtwert, dazu das Brett als Baustein

Aufwand: L · Kandidaten: K07, K11, K12, K09, K13, K29

**Was:** Offline rechnet Claude einmal lokal und liefert eine neue exercises.json mit denselben IDs und höherem `dv`. (1) Alle legalen Züge jeder Übung werden mit demselben Knotenbudget bewertet und als Paare [Zug, Gewinnchance] gespeichert. Grenzfälle zwischen 5 und 15 Punkten werden tiefer nachgerechnet. Der Build prüft, dass Partiezug und alle gespeicherten Züge enthalten sind. (2) Maia läuft einmal neu über die 1.200 Stellungen und speichert die volle Verteilung. Daraus entsteht `p_ok_me`: die Summe der Maia-Wahrscheinlichkeiten aller Züge, die die App als richtig wertet. Heute steht dort nur p_best_me, und das schmeichelt jeder Quote. (3) Motive: `missed_motifs` wird übernommen (162 der 253 Übungen „Gegnerfehler nicht bestraft“). Bei den 47 Übungen mit „Matt in N“ steht künftig „Drohung: Matt in N“. Der Bruch in der Motivstatistik wird mit Datum gekennzeichnet. (4) Pro Übung kommen `threat` (Nullzug, entfällt bei Schach) und die Widerlegung des Partiezugs (4 Halbzüge) dazu, außerdem Widerlegungen der 2 Fehlzüge, die Maia auf seinem Niveau am ehesten erwartet. (5) Neue Übungen kommen nicht mehr nach Verlust sortiert, sondern nach `prio`. Vorn liegen jüngere Partien, Leichtsinn, hängende Figur und Gabel sowie Mittelspiel von Zug 15 bis 35. Zeitnot-Stellungen bekommen keinen Bonus, das übernimmt später die Tempo-Leiter. Unter 10 neuen Übungen sind höchstens 1 „Gegnerfehler nicht bestraft“, höchstens 2 „Positioneller Fehler ohne Motiv“ und mindestens 3 „Nächste Stufe“. Der Prüfsatz bleibt unberührt. (6) Vorgerechnet, aber noch nicht ausgeliefert: Kandidaten für ruhige Stellungen (Schritt 5) und Stellungen, in denen er den einzigen guten Zug schnell fand (Stoppschilder, Glanzzüge). In der App: (7) Die Brett- und Aufgabenlogik wird aus Trainer.tsx (761 Zeilen) als Komponente herausgelöst: Brett, Animation des Gegnerzugs, Zugeingabe, Umwandlung, Zeitmessung und Töne. Sichtbar ändert sich nichts, der e2e-Test sichert ab. Die Schritte 3 bis 5 bauen darauf auf. (8) judge() wertet jeden Zug: „Auch gut: Te1 (−3)“ oder „Kostet 31 Punkte“. Fehlt ein Zug trotzdem, steht da „Big Dog hat das nicht nachgerechnet, zählt nicht gegen dich“, mit Note 2. (9) Altlasten: Statistik und Satzverlauf leiten das Urteil beim Lesen aus `san` und den aktuellen Daten ab. replay() hebt die FSRS-Note alter Antworten an, die nach den neuen Daten richtig waren, senkt aber nie eine. „Zu langsam“ richtet sich weiter nach dem damaligen `lim`. (10) Bei „Figur eingestellt“, „Gegnerische Taktik übersehen“ und „Matt übersehen“ (545 Übungen) zeigt ein gestrichelter roter Pfeil, was der Gegner drohte. Die Widerlegung des eigenen Zugs steht in einer Zeile („Kf8? erlaubt Df7#. Besser: Txc4+“) und wird 2 bis 3 Halbzüge weit animiert, insgesamt in unter 5 s. Ein Tipp überspringt das. (11) Spielt er wieder den Zug aus der Partie, steht da „Wie in der Partie: ein festes Muster bei dir“. (12) Erst jetzt erscheint unter „Fortschritt“ die Erstversuch-Quote: die erste Antwort je Übung, gleitend über 50, gegen p_ok_me, mit Band und getrennt für „Leichtsinn“ und „Nächste Stufe“. Auch die Einordnung der Sätze rechnet ab hier mit p_ok_me.

**Warum:** In 240 von 1.200 Übungen liegen alle fünf gespeicherten Züge innerhalb von 10 Punkten. Dort gibt es mit großer Sicherheit weitere gute Züge, die heute als „Falsch“ mit Note 1 nach einer Minute wiederkommen. Das zerstört Vertrauen und trainiert genau die schädliche Haltung „irgendwo steckt immer der eine Trick“, also Grübeln. 845 Übungen haben kein Motiv, und „Matt in N“ führt in die Irre. Der Maia-Richtwert zählt heute nur den besten Zug, die App aber jeden Zug bis 10 Punkte dahinter. Erstversuch-Quote, Satz-Überschrift und Monats-Check lägen dadurch systematisch „über dem Richtwert“. Die Herauslösung des Bretts gehört an den Anfang, weil Uhr-Schleife, Ergebnisseite und ruhige Stellungen alle Trainer.tsx umbauen. Ohne sie entstehen Kopien. Nebenbei macht der Lauf den geplanten Stockfish-Prüfer auf dem Handy überflüssig.

**Erfolg:** Höchstens 1 % der Urteile lauten „ungeprüft“. Die Falsch-Quote in den 240 betroffenen Übungen sinkt, „Nicht mehr zeigen“ wird seltener getippt. Die Zahl der Aufgaben pro 15 Minuten sinkt trotz Pfeil und Animation um höchstens 10 %. Die Erstversuch-Quote erscheint mit Band und liegt nicht mehr systematisch über dem Richtwert.

### Schritt 3: Die Uhr-Schleife, mit Partien aus chess.com und lichess, einer Regel und einer ehrlichen Kurve

Aufwand: L · Kandidaten: K01, K05, K04, neu: Bullet, neu: lichess-Analyse

**Was:** Holen: chess.com über das laufende Monatsarchiv von Laurens3495 (nur bei geändertem ETag, cache: no-cache). Vorher wird einmal gemessen, nach wie vielen Minuten eine Partie dort steht. lichess über /api/games/user/Poquitonator?since=…&clocks=true&pgnInJson=true: Das liefert NDJSON, die Partie steht sofort nach Ende bereit, CORS ist offen. Geholt wird leise beim Öffnen, dazu gibt es einen Knopf. Pro Partie speichert die App in IndexedDB id, URL, Plattform, Zeitpunkt, Zeitmodus, Farbe, Ergebnis, Endgrund, eigene Wertungszahl, die Züge als UCI, die Uhr je Halbzug und ein leeres Kommentarfeld (Spezifikation 8a). Die Partien laufen nicht über den Abgleich, jedes Gerät holt selbst, und Gegnernamen werden nie gespeichert. Auf „Heute“ ersetzt die Karte „Letzte Partien“ die Fokus-Karte. Oben steht die eine Regel: „Über 10 s ohne Schach, Schlag oder Drohung: Zieh deinen besten Kandidaten.“ Darunter kommt zuerst das Positive: „3+0 seit gestern: 5 Partien · Zug 30 im Budget: 3 von 4 · 1× auf Zeit verloren mit Mehrmaterial“. Bullet hat eine eigene, zusammengefasste Zeile ohne Budget-Marken: „Bullet: 41 Partien · 6× auf Zeit verloren mit Mehrmaterial · vor Zug 20 im Schnitt 2 s hinter deinen Gegnern“. Jede Partiezeile (3+0, 3+2, 5+0) zeigt zwei Budget-Marken (Haken oder grauer Punkt, nie ein rotes Kreuz), die längste Denkpause mit Mini-Brett („Zug 23: 31 s für Tc1“), den Link zur Partie und „In lichess-Analyse öffnen“ (PGN-Import, volle Engine, kostenlos). Die Denkpause lässt sich mit einem Tipp für die neue Runde vormerken, als Log-Eintrag `kind: 'mark'`. Die Uhr-Spur kommt später. An Tagen ohne Partien zeigt die Karte nur die Regel. Definitionen, alle in einer Funktion mit Tests gegen report.json (119,6 und 65,4 s) und gegen 5 Partien aus games_raw: „vor Zug N“ ist die Uhr nach dem eigenen Zug N−1. Eine Denkpause sind 10 s oder mehr in Zug 15 bis 35. Die Qualitätsbremse zählt Materialverlust von mindestens 2 Bauern innerhalb von 2 Halbzügen nach einem eigenen Zug unter 2 s bei mindestens 30 s Restzeit in Zug 10 bis 35, pro 100 solcher Züge, berechnet mit chessops. Unter „Fortschritt“ ersetzt die Karte „Uhr“ die „Ausgangslage“. Groß steht dort die eigene Zeit von Zug 16 bis 29 (Basis 74 s) als laufende Kurve, der normale Bereich seiner Monatswerte ist schattiert. Darunter stehen der Rückstand vor Zug 30 gegenüber den Gegnern (Basis −11,3 s, normaler Bereich der Monate −6 bis −23 s), die Denkpausen pro Partie (2,16, Gegner 1,46), die beiden Budget-Quoten (41 % bei Zug 30, 59 % bei Zug 20) und die Qualitätsbremse. Bullet hat eine eigene Zeile: Rückstand vor Zug 20, Basis −2,9 s. Ein Urteil erscheint erst ab 120 3+0-Partien, die Zug 30 erreichen, bzw. ab 600 Bullet-Partien, darunter steht „noch 74 Partien bis zur ersten Aussage“. Es gibt kein Wochenziel, keine Ampel und keine Elo-Hochrechnung. Die Basis wird mit derselben TypeScript-Funktion aus den letzten 300 3+0-Partien vor dem 15.10. und den letzten 600 Bullet-Partien eingefroren. Die Regel liegt als öffentliche Datei data/regel.json. App und iOS-Kurzbefehl („Inhalte von URL abrufen“) lesen dieselbe Datei, und die Hilfe beschreibt die Automation für die chess.com- und die lichess-App. Die Regel wechselt nicht nach Kalender, sondern nur, wenn Laurens es will.

**Warum:** 317 von 755 Niederlagen in der Diagnose endeten auf Zeit, etwa 30 Elo, und die App sieht davon heute nichts. Seit März hat er auf lichess rund 3.000 Partien 1+0 gespielt. Im September waren es 922 Bullet-Partien gegen 10 in 3+0, vom 1. bis 14. Oktober 366 gegen 73. Ohne lichess bliebe die Karte an den meisten Spieltagen leer. Bullet zeigt dasselbe Muster: 75 % seiner Bullet-Niederlagen kamen auf Zeit, und vor Zug 20 liegt er etwa 5 % der Grundzeit zurück (in 3+0 vor Zug 30 etwa 6 %). Einen Grund, Bullet zu verbieten, gibt es nicht. In 3+0-Partien nach Wochen mit mindestens 50 Bullet-Partien lag der Rückstand vor Zug 30 bei −14,5 s, sonst bei −16,0 s. Die eigene Zeit von Zug 16 bis 29 streut weniger (Standardabweichung 27 s statt 34,6 s) und enthält kein Rauschen vom Gegner. Die Monate schwanken stärker, als der Zufall erklärt (August −6,3 s, 1. bis 14. Oktober −22,8 s). Deshalb zeigt die Karte den normalen Bereich statt eines einzelnen Basiswerts. Rückmeldung wenige Minuten nach dem Spielen wirkt stark, und sie hängt sich an eine Gewohnheit, die er schon hat (Sitzungen im Median 3 Partien). Die Regel heißt „nicht grübeln“, nicht „tauschen“.

**Erfolg:** An mindestens 70 % der Spieltage werden die Partien innerhalb von 24 h geholt, und dank lichess ist die Karte an den meisten Spieltagen gefüllt. Die erste Aussage kommt nach 120 3+0-Partien mit Zug 30 bzw. nach 600 Bullet-Partien. Das Ziel für das Ganze steht unter „measurement“. Der Kopierknopf zeigt, dass er die Karte nach Spieltagen tatsächlich ansieht.

### Schritt 4: Big Dog am Satzende, die Ergebnisseite einmal ganz neu (Start nach 2 bis 3 Wochen Nutzungsdaten)

Aufwand: M · Kandidaten: K19, K20, K10

**Was:** Gestartet wird erst, wenn der Kopierknopf 2 bis 3 Wochen Daten geliefert hat (wo Sätze abgebrochen werden, wie oft „Nächster Satz“). Bis dahin schreibt Claude im Chat die Spruch-Töpfe. Die Ergebnisseite wird einmal als Ganzes entworfen, mit einer Obergrenze für die Zeit pro Aufgabe. Pro gelöster Aufgabe steht die Damals-Zeile: „Damals: Lxf7 nach 1,4 s, 0:38 auf der Uhr, Figur weg. Heute: Sd5 in 3,1 s.“ Bei Misserfolg erscheint sie nicht. Die Überschrift misst gegen p_ok_me statt gegen feste Schwellen („Über dem Richtwert: 62 % bei erwarteten 55 %“), „Durchwachsener Satz“ fällt weg. Oben steht der „Moment des Satzes“ mit Mini-Brett und Link zur Partie, aber nur, wenn ein großer damaliger Verlust (mindestens 30 Punkte) gekontert wurde. Darunter steht EIN Big-Dog-Spruch aus dem Topf, der zur Lage passt: mindestens 2 vorschnelle Fehler unter 3 s, mindestens 2 richtige, aber langsame Antworten, 10 von 10, unter 40 %, dieselbe Stellung zum dritten Mal falsch, ein Dauerbrenner endlich in der Zeit, Rückkehr nach einer Pause. Ein Spruch kommt höchstens auf jeder zweiten Ergebnisseite, jeder Topf hat mindestens 10 Sprüche, die sachliche Zeile steht gleich groß daneben, und die Sprüche sind pro Gerät abschaltbar. Big Dog spottet nur über sich („Ich habe 20 Sekunden über einen Bauernzug nachgedacht. Der Bauer war beeindruckt. Die Uhr nicht.“). Einen Herz-Tipp gibt es nicht, Lieblingssprüche nennt er im Chat. „Zweite Chance“: Vor der Ergebnisseite bietet die App an, bis zu 3 falsche Aufgaben noch einmal zu spielen, in neuer Reihenfolge, frühestens 30 s nach dem Fehler, und nur, wenn der Satz noch keine 15 Minuten läuft. Diese Antworten werden nur angezeigt („3 von 3 zurückgeholt“), aber nicht in FSRS gewertet und nicht in die Quote gerechnet. Sie stehen als `kind: 'retry'` im Log, replay() überspringt sie und listSets() filtert sie heraus. Die Einordnung schrumpft auf die große Zahl und einen Satz, die Details lassen sich aufklappen.

**Warum:** Die Sprüche gefallen ihm an der App am meisten, erscheinen aber nur im Startbild (quotes.ts wird nur in Splash.tsx genutzt). Die Ergebnisseite ist korrekt, aber trocken. Mit einem Maia-Median von 0,50 heißt ein Satz mit vielen neuen Übungen heute „Durchwachsener Satz“, der Frust ist eingebaut. Wie eine Sitzung in Erinnerung bleibt, hängt an ihrem Höhepunkt und ihrem Ende. Die Damals-Zeile zeigt ohne Belehrung immer wieder den Kernbefund: 430 der 1.200 Übungsfehler fielen in unter 2 s. Die Zweite Chance wird nicht gewertet, weil srs.ts learning_steps ['1m'] setzt. Eine richtige Antwort 30 s nach „Nochmal“ würde den Lernschritt abschließen und die Karte gleich in Abstände von Tagen schieben, die geplante Wiederholung entfiele.

**Erfolg:** Der Anteil „Nächster Satz“ statt „Für heute fertig“ steigt gegenüber den Wochen davor. Laurens sagt nach 2 Wochen „bleibt“. Die Zahl der Aufgaben pro 15 Minuten sinkt um höchstens 10 %. Abgebrochene Sätze werden seltener.

### Schritt 5: Ruhige Stellungen, „Gut genug, sofort ziehen“, als Beimischung (Start nach Stichprobe und Nutzungsdaten)

Aufwand: M · Kandidaten: K02, K29

**Was:** Voraussetzungen: Schritt 2 hat die Kandidaten gerechnet, die Uhr-Schleife läuft, und Laurens hat sich 20 Stichproben im Chat angesehen. Die Definition ist vorher festgeschrieben. Ruhig ist eine Stellung aus seinen 3+0-Partien zwischen Zug 13 und 35, in der er ohne Zeitnot 10 s oder länger nachdachte, ohne Schach, ohne hängendes Material und ohne taktisches Motiv, und eine tiefe Nachrechnung bestätigt mindestens 3 Züge innerhalb von 5 Punkten. Grenzfälle fallen raus. Als gut (`ok`) gelten großzügig alle Züge bis 8 bis 10 Punkte hinter dem besten, als schlecht (`bad`) Züge, die Material einstellen, jeweils mit Widerlegung. Der erste Schwung umfasst 300 Stellungen. In normalen Sätzen sind 2 bis 3 von 10 Stellungen ohne Ankündigung ruhig; beim ersten Mal erklärt ein Satz, worum es geht. Der Ablauf bleibt gleich: Der Gegnerzug wird animiert, dann läuft die Zeit, Zielzeit 4 s. Ein guter Zug in der Zielzeit ist richtig. Ein guter Zug nach der Zielzeit erscheint grau mit „richtig, gespart hättest du 19 s“, nicht in Fehler-Rot. Ein schlechter Zug ist falsch, die Widerlegung wird gezeigt. Groß in der Mitte steht: „Ruhige Stellung: 9 Züge waren gleich gut (Sf3, Le2, O-O …). Damals 23 s.“ Dazu gibt es einen Big-Dog-Topf zum Grübeln. Ruhige Stellungen laufen in einem eigenen Pool mit langen Abständen außerhalb der FSRS-Wiederholung, im Log als `kind: 'ruhig'`, und zählen getrennt in Quote, Einordnung und Tabellen. Am Satzende steht „Ø ruhig 3,1 s · kritisch 6,4 s“. Nachschub kommt aus den vorgemerkten Denkpausen, mit der monatlichen neuen Runde. Regel und Übung tragen bewusst dieselbe Botschaft. Abbruchkriterien: Laurens sagt „nervt“, die Quote in kritischen Aufgaben sinkt, oder die Qualitätsbremse steigt über mindestens 150 Partien um 50 % oder mehr.

**Warum:** In Zug 15 bis 35 denkt er pro 3+0-Partie 2,16-mal 10 s oder länger nach, die Gegner 1,46-mal. 76 bis 80 % dieser Denkpausen fallen in Stellungen mit mehreren gleich guten Zügen, nur 3 % in Stellungen mit genau einem guten Zug. Auf leichten Zügen braucht er im Schnitt 3,9 s, auf kritischen 2,5 s, und 68,5 % der kritischen zieht er in unter 2 s (dabei 9,7 % Fehler). Er denkt also lange, wo es egal ist, und kurz, wo es zählt. Die App trainiert heute zu 100 % das Finden versteckter Züge. Übung überträgt sich, wenn sie dieselbe Entscheidung verlangt wie die Partie: „Ist hier überhaupt etwas los?“. Als Beimischung bringt das Abwechslung, ohne einen neuen Modus.

**Erfolg:** Nach 4 Wochen Beimischung liegt die Median-Zeit in ruhigen Stellungen bei höchstens 4 s, mit mindestens 85 % guten Zügen, und die Quote in kritischen Aufgaben ist nicht gesunken. Laurens sagt „bleibt“. In Partien zeigt die Kurve ab 120 Partien seit der Uhr-Schleife weniger Denkpausen in Zug 15 bis 35, ohne dass die Qualitätsbremse steigt.

## Danach

### Tempo-Leiter pro Karte und Blitz-Rhythmus im Fehler-Trainer

Aufwand: M · Kandidaten: K08, K24

**Was:** Startet, wenn die ruhigen Stellungen stabil laufen. (1) Jede Karte bekommt ein eigenes Limit, abgeleitet aus dem Log (`lim` gibt es seit 1.2). Stufe 1 hat 15 s bei „Nächste Stufe“ und bei der ersten Begegnung, 10 s bei „Leichtsinn“. Stufe 2 hat 8 s, Stufe 3 hat 5 s. Stufe 4 mit 3 s gibt es nur für Leichtsinn- und Zeitnot-Karten; „Nächste Stufe“ geht nie unter 5 s. Richtig im Limit bringt eine Stufe hoch. Richtig über dem Limit gibt „Schwer“ ohne Stufenwechsel. Falsch kostet eine Stufe, falsch in unter 3 s zwei Stufen, mit dem Hinweis „Zwei-Sekunden-Check: Schach, Schlagen, Drohung“. Richtig in höchstens 40 bis 50 % des Limits ergibt erstmals FSRS „Leicht“. Das läuft über das Zusatzfeld `fast: true`, die Note bleibt 1 bis 3. Stufe 4 zählt nur, wenn sie nach mindestens 7 Tagen Abstand erreicht wird. An der Karte stehen klein 1 bis 4 Pfoten, ohne Animation beim Abstieg und ohne „Blitz-reif“-Zähler als Hauptzahl. Die Einstellung lautet „Zeitlimit: automatisch / 5 / 10 / 20 / aus“. Zum Start erscheint einmal „Ab jetzt wird's schneller. Die Quote sinkt erst und steigt dann.“ (2) Über dem Brett zählt eine Uhr wie auf chess.com herunter, unter 3 s rot, ohne Blinken. Klein und grau steht daneben die damalige Partie-Uhr: „Partie: du 0:23 · Gegner 1:04“. Die Gegneruhr wird offline aus games_raw ergänzt; fehlt sie, entfällt die Anzeige. (3) Beim besten Zug im Limit geht es nach 1,2 s automatisch weiter, mit Häkchen und Ton; ein Tipp hält an. Die Damals-Zeilen erscheinen dann gesammelt auf der Satzseite. Countdown und automatisches Weiter lassen sich pro Gerät getrennt abschalten.

**Warum:** Heute gilt für alle Karten dasselbe Limit, und „Leicht“ wird nie vergeben (GRADE_MAP kennt nur Again, Hard und Good). In Partien entscheidet er 68,5 % der kritischen Stellungen in unter 2 s. Ein Muster nützt ihm im Blitz nur, wenn er es so schnell sieht. „Leicht“ schafft Platz für neue Stellungen. Dass ein vorschneller Fehler zwei Stufen kostet, hält dagegen, dass Tempo Leichtsinn antrainiert (28 % seiner Leichtsinnsfehler fielen in unter 2 s).

**Erfolg:** Die mittlere Lösezeit bei Wiederholungen sinkt von etwa 6 auf etwa 4 s, bei einer Quote nahe 90 % nach mindestens 7 Tagen Abstand. Die Zahl der Aufgaben pro 15 Minuten steigt um mindestens 15 %. Vorschnelle Fehler pro Satz nehmen nicht zu.

### Tempo-Satz mit Zeitkonto (der erste von höchstens zwei neuen Modi)

Aufwand: M · Kandidaten: K02, K03

**Was:** Ein einziger Tempo-Modus statt zweier Varianten, gebaut auf der Brett-Komponente aus Schritt 2. Der Verlauf `runs` speichert pro Lauf nur eine Zusammenfassung (Konto am Ende, Zeit für ruhige und kritische Stellungen, Fehler, IDs der Zeitfresser). Der Satz hat 12 bis 15 Stellungen und eine gemeinsame Uhr groß über dem Brett, die nur läuft, wenn er am Zug ist. Etwa 70 % sind ruhige Stellungen, mindestens 25 % Stoppschilder: kritische Stellungen, in denen er in der Partie in unter 2 s falsch zog, und Stellungen mit nur einem guten Zug. Das Konto hat feste Stufen von 80, 70, 60, 50 und 40 s für 10 Stellungen. Ein geschaffter Lauf bringt eine Stufe hoch, eine abgelaufene Zeit eine zurück. Bei 40 s, dem echten Budget von Zug 20 bis 30 („Zug 20 · 2:00“, Ziel „Zug 30 mit 1:20“), gibt es eine Feier („Big Dog hat 40 Sekunden nie geschafft“), danach wird nicht weiter verschärft. Ein Einsteller in einer kritischen Stellung kostet 15 s und zeigt „Figur weg“, der zweite beendet den Lauf. Überspringen geht nicht. Ist die Zeit abgelaufen, kommen ein Big-Dog-Spruch und der Knopf „Nochmal“. Die Ergebnisseite zeigt die Restzeitkurve gegen eine Ideallinie, einen Balken pro Stellung (grau ruhig, rot kritisch), den Anteil des Kontos, der in ruhige Stellungen floss, und die größten Zeitfresser. FSRS übernimmt aus Läufen nur „falsch“. Auf „Heute“ steht ein zweiter Knopf unter „Satz starten“, und nach 2 Wochen fragt die App „bleibt oder raus“.

**Warum:** Nur ein gemeinsames Konto übt die Frage „hier investieren oder nicht?“. Was er in Zug 18 verbraucht, fehlt ihm in Zug 35. Im Mittelspiel braucht er 5,75 s pro Zug, die Gegner 4,96 s, und 40 s für 10 Züge ist genau seine Budget-Regel. Ohne ruhige Stellungen wäre es nur schnelleres Rätseln, deshalb kommt der Modus nach Schritt 5. Feste Stufen sind durchschaubar und kein Laufband ohne Ende.

**Erfolg:** Er spielt den Modus ohne Aufforderung an mindestens 2 Tagen pro Woche. In 4 Wochen erreicht das Konto Stufe 60 oder besser, und mehr als die Hälfte des Kontos fließt in kritische Stellungen. Die Partie-Kurve fällt nicht, und die Qualitätsbremse steigt nicht.

### Gegen Big Dog: Revanche, dazu die Budget-Partie als zweite Art von Akte (der zweite neue Modus, ersetzt den Gewinn-Drill)

Aufwand: L · Kandidaten: K15, neu: Budget-Partie

**Was:** Ein Engine-Modul mit Stockfish 19 lite single (1,85 MB, passt in den Offline-Speicher) läuft im Web Worker. Die Stärke wird über Skill Level und ein Knotenlimit gesteuert, nicht über UCI_Elo. Big Dog denkt 1 bis 3 s wie ein Mensch, gibt nie auf und gewinnt auch auf Zeit. Zuerst kommt ein Prototyp für 2 Wochen: 10 Akten aus den letzten 6 Monaten als einfache Liste, feste Stärke, keine Premoves, getestet auf dem iPad. Die Frage ist, ob er das gern spielt und ob Big Dog glaubwürdig verteidigt. Erst danach folgt der Ausbau. Ein Raster aus Akten zeigt Mini-Brett, Datum, Farbe, Uhrstände („du 0:31, Gegner 1:12“) und den damaligen Ausgang. Start ist der erste Zug mit mindestens 90 % Gewinnchance, mit der echten Restzeit beider Seiten; beim ersten Versuch gibt es 30 s Zuschlag. Gewonnen hat er bei Matt, wenn Big Dog die Zeit überschreitet, oder bei klarem Gewinn nach Material und Bewertung, alles offline. Der Grübel-Zähler (Züge über 5 s) steht vor dem Ergebnis: „Partie: Zeit abgelaufen nach 14 Zügen bei +6. Heute: Matt in 11 Zügen, 0:09 übrig, 1 Denkpause.“ Eine gelöste Akte kommt mit 15 % weniger Zeit wieder, bis 60 % der damaligen Zeit erreicht sind. Der Zähler zeigt nur „zurückgeholt: 23 von 136“, nie „offen“. Die zweite Art von Akte im selben Bildschirm ist die Budget-Partie: Er übernimmt eine eigene Partie bei Zug 15 mit der damaligen Uhr beider Seiten. Ziel ist Zug 30 mit mindestens 1:20, ohne eine Figur einzustellen. Ausgewertet wird die Uhr-Spur gegen die Budgetlinie. Die Akten erzeugt Claude offline. Neue Akten kommen aus der monatlichen neuen Runde, auch aus Bullet-Partien, wenn Laurens Bullet als Ziel nennt.

**Warum:** 101 der 136 verlorenen Gewinnstellungen gingen auf Zeit verloren. In diesen Partien hatte er beim ersten Erreichen von 90 % im Median 36 bis 37 s für 14 weitere Züge. In Gewinnstellungen denkt er bei 7,6 % der Züge länger als 10 s nach (Gegner 4,3 %). Das Problem ist Zögern, nicht Technik. Die Budget-Partie übt als einzige Übung die zusammenhängende Strecke, auf der der Rückstand entsteht (−0,9 s bei Zug 15, −14,5 s bei Zug 30). Gegen die eigene schmerzhafte Partie zu spielen ist persönlicher als jede Punktzahl.

**Erfolg:** Im Prototyp spielt er freiwillig mindestens 3 Revanchen pro Woche, und Big Dogs Stärke lässt sich so einstellen, dass er 60 bis 70 % zurückholt. Später sinken in Partien die Zeitverluste nach einer Gewinnstellung (Basis etwa 6,3 pro 100 Partien), gemessen nach der neuen Runde.

### Rhythmus ohne Serie: Partie der Woche, monatliche neue Runde mit Skill-Kennzahlen, Monats-Check

Aufwand: M · Kandidaten: K22, K25, K13, neu: Skill-Kennzahlen

**Was:** Sonntags ab 18 Uhr erscheint auf „Heute“ die Karte „Deine Woche“. Sie bleibt bis Mittwoch oder bis sie geöffnet wurde und verschwindet dann still. Sie beginnt mit dem Höhepunkt der Woche (Partie mit der besten Uhr). Dann folgt „Big Dogs Lieblingsdrama“, der teuerste Zeitverlust: auf Zeit verloren mit Mehrmaterial, sonst der größte Rückstand vor Zug 30. Gezeigt werden Uhr-Spur, die drei größten Zeitfresser und die Frage „Wo hättest du in 2 s ziehen können?“; er tippt den Moment an. Dazu kommen „In lichess-Analyse öffnen“ und „Für Claude kopieren“ (Kennzahlen und PGN ohne Gegnernamen). Einmal im Monat sagt er im Chat „neue Runde“. Claude holt die Partien, rechnet Stockfish und erzeugt Übungen aus neuen Fehlern und vorgemerkten Denkpausen, dazu neue Prüfstellungen und Akten. Neu ist, dass Claude auch die Skill-Kennzahlen für das Monatsfenster liefert: Patzer pro 100 Mittelspielzüge ohne Zeitnot (Basis 3,59, Gegner 3,29), hängende Figuren außerhalb der Zeitnot pro 100 Partien (16,9), Zeitverluste in nicht verlorener Stellung (6,8 pro 100 Partien) und die Verwertung ab 90 % (76,6 %). Sie stehen unter „Fortschritt“ als Monatswerte mit Band. Die App zeigt danach „34 neue Stellungen aus deinen Oktober-Partien“. Alle 4 Wochen bietet „Heute“ zwei Wochen lang einen Monats-Check an: 15 unbekannte Stellungen aus dem Prüfsatz mit festem Limit, ohne Wiederholung, Lösungen am Ende, verglichen mit p_ok_me genau dieser 15 Stellungen, mit Band und den drei Urteilswörtern. Eine Fokus-Wahl gibt es noch nicht.

**Warum:** Tägliche Zahlen schwanken zu stark, eine Woche passt zur Datenmenge. Sonntag ist sein Haupt-Schachtag (290 der 1.384 3+0-Partien auf chess.com seit 2025). Die Nachbetrachtung einer Zeitverlust-Partie ist der einzige Teil des Diagnose-Plans, der in der App noch fehlt. Ohne Nachschub sind die 1.140 Trainingsübungen nach etwa 76 Trainingstagen gesehen. Die Skill-Kennzahlen schließen die Lücke jenseits der Uhr: Nach den etwa 30 Elo der Uhr muss er besser spielen als seine Gegner, nicht nur gleich gut. Die manuelle Runde (Variante A der Spezifikation) braucht keine Infrastruktur.

**Erfolg:** In 8 Wochen öffnet er die Partie der Woche an mindestens 5 Sonntagen. Zwei neue Runden sind gelaufen. Auf frischen Übungen liegt die Erstversuch-Quote über der auf alten. Der erste Monats-Check erscheint gegen den Richtwert, ohne dass er ihn als Absturz erlebt.

### Neue Aufgabenarten im Fehler-Trainer statt neuer Modi: Lecks, „Was droht?“, Endspiel-Urteil

Aufwand: M · Kandidaten: K17, K14, K16

**Was:** Von jeder Art kommt höchstens eine Aufgabe pro Satz, jeweils mit eigener Statistik. (a) Eröffnungs-Lecks als normale Übungen, zuerst die 5 häufigsten, zum Beispiel im Sizilianer ...cxd4 statt ...e5 (49 gegenüber 39 % bei Spielern seiner Stärke) und Smith-Morra. Die Stellung wird aus der Grundstellung schnell hergespielt (150 ms pro Zug), dann gilt ein Limit von 2 s. Die Erklärung nennt die Explorer-Zahlen, die Ergebnisseite die beiden Regeln („Im Sizilianer kein frühes ...e5, gegen d4 immer ...cxd4“). Das Königsgambit ist kein Leck. Karten zu Caro-Kann und Skandinavisch kommen erst nach seiner Entscheidung. (b) „Was droht?“: Nach dem Gegnerzug tippt er in 3 s die bedrohte Figur bzw. das Feld an oder „Nichts“. Grundlage ist `threat` aus Schritt 2, es kommen nur klare Drohungen (mindestens 2 Bauern) und gleich viele Stellungen ohne Drohung. (c) „Gewinn, Remis oder Verlust?“ in 4 s, aus seinen eigenen Stellungen mit höchstens 7 Steinen (Tablebase offline abgefragt). Vorher gibt es einen Test mit 20 Stellungen: Bewertet er sie schon sicher in 4 s, entfällt (c).

**Warum:** Die 11 bestätigten Lecks gehen auf zwei Denkfehler zurück, und eine Regel überträgt sich auch auf Zugfolgen ohne eigene Karte. Der Ertrag ist sicher, aber klein (18 % der verlorenen Gewinnchance). „Was droht?“ übt den Blick, den die korrigierte Fokus-Karte verlangt. Ein eigener Modus lohnt sich dafür nicht, denn außerhalb der Zeitnot stellt er nicht mehr ein als seine Gegner (16,9 gegenüber 17,6 pro 100 Partien). Im Endspiel braucht er 3,85 s pro Zug, die Gegner 3,03 s, und spielt 31 % der Endspielzüge in Zeitnot.

**Erfolg:** Nach 4 Wochen löst er die Leck-Karten zu mindestens 90 % in 2 s. Bei „Was droht?“ steigt die Trefferquote, ohne dass Fehlalarme zunehmen. Der Endspiel-Test entscheidet über (c).

## Später oder optional

### Nachtlauf im privaten Sync-Repo

Aufwand: L · Kandidaten: K25

**Was:** Ein GitHub-Workflow läuft täglich im privaten Repo und rechnet mit den Definitionen der Diagnose, die nach analysis/metrics.py ausgelagert werden. Er schreibt games.json (eine Zeile pro Partie) und exercises-new.json. Auf „Heute“ steht dann „3 neue Fehler aus deinen Partien von gestern“. Maia läuft anfangs nicht mit. Ist der letzte Lauf älter als 3 Tage, zeigt die App das an. Voraussetzung ist ein allgemeiner Lesezugriff auf weitere Dateien im privaten Repo, sync.ts kennt heute nur state.json.

**Warum:** Ersetzt die manuelle neue Runde erst, wenn sie zwei- bis dreimal gelaufen ist und er die frischen Übungen nachweislich bevorzugt. Ein Nachtlauf ist der wartungsintensivste Baustein, und fällt er still aus, merkt es niemand.

**Erfolg:** 4 Wochen ohne Ausfall. Frische Übungen machen mindestens 30 % der neuen Übungen in Sätzen aus.

### Kompaktierung der Sync-Datei

Aufwand: M · Kandidaten: neu: Kompaktierung

**Was:** Wird eingeschaltet, wenn das Log 10.000 Einträge überschreitet oder replay() auf dem iPhone länger als 300 ms braucht. Ältere Einträge werden in einen Schnappschuss der Karten (`snap`, reserviert seit 1.2) bis zu einer Grenze zusammengefasst. Die Einzeleinträge davor wandern in eine Archivdatei pro Quartal im privaten Repo.

**Warum:** Eine Antwort braucht etwa 130 Byte, bei rund 60 Antworten am Tag sind das etwa 3 MB im Jahr. Jeder Abgleich lädt die ganze Datei als Base64 hoch und rechnet replay() zwei- bis dreimal. Das Format ist schon vorbereitet, gebaut wird erst bei Bedarf.

**Erfolg:** Die Sync-Datei bleibt unter 1 MB, und der Abgleich dauert auf dem iPhone unter 2 s.

### Leck-Bilanz in jeder geholten Partie

Aufwand: S · Kandidaten: K18

**Was:** Jede geholte Partie wird ohne Engine gegen die Leck-Stellungen geprüft (Stellungsvergleich ohne Zugzähler). Das Ergebnis steht nur zusammengefasst in der Sonntags-Karte („Lecks diese Woche: 8 von 9 umschifft“). Ein Leck lässt sich mit einem Tipp als „bewusst gespielt“ markieren. Ein Rückfall macht die passende Leck-Karte sofort fällig.

**Warum:** Rauschfrei und billig, sobald Partien geholt werden und es die Leck-Karten gibt. Es gab 572 Begegnungen in 1.606 Partien, in 13 % davon kam der schwache Zug.

**Erfolg:** Der Anteil schwacher Züge in Leck-Stellungen sinkt in 8 Wochen von 13 % auf unter 7 %.

### Spiegelbild als Prüfstein für die höchste Tempo-Stufe

Aufwand: M · Kandidaten: K28

**Was:** Bevor eine Karte Stufe 4 der Tempo-Leiter erreicht, kommt sie einmal gespiegelt: Farben getauscht, Brett vertikal gespiegelt, mit chessops (transformSetup und flipVertical) und neu erzeugten Lösungszügen. Die Bewertung bleibt gleich, eine neue Rechnung ist nicht nötig. Spiegelbilder zählen nicht zur Erstversuch-Quote und nicht zum Richtwert. Der Abstand zwischen Original und Spiegelbild wird intern berechnet, aber nicht angezeigt.

**Warum:** Nach mehreren Wiederholungen erkennt man eigene Stellungen am Bild. Mit der Tempo-Leiter wächst diese Gefahr.

**Erfolg:** Ab mindestens 100 Paaren liegt die Quote im Spiegelbild höchstens 10 Prozentpunkte unter der im Original.

### Endspiel-Zeitfahren gegen Big Dog

Aufwand: M · Kandidaten: K16

**Was:** Nutzt das Engine-Modul der Revanche. Zuerst kommen seine 44 nicht verwerteten Tablebase-Gewinne als Strecken, mit Bestzeit und Zugzahl. Grundtechniken kommen nur dazu, wenn eine Messung zeigt, dass er sie langsam spielt. Eine Strecke mit stabiler Bestzeit gilt als gemeistert und verlässt die Rotation. Ein Patt beendet die Fahrt, mit Big-Dog-Spruch.

**Warum:** Sein Endspiel ist technisch gut (2,0 gegenüber 2,3 Patzern ohne Zeitnot), er kommt nur mit zu wenig Zeit an. Deshalb ist das ein Nebenschauplatz, der sich erst lohnt, wenn das Engine-Modul existiert.

**Erfolg:** Der Anteil der Endspielzüge in Zeitnot sinkt von 31 % Richtung 25 % (gemessen nach der neuen Runde).

### Repertoire-Reflex: Eröffnungstempo als Zeitpuffer

Aufwand: S · Kandidaten: neu: Repertoire-Reflex

**Was:** Zuerst messen: Die Uhr-Schleife zeigt, wie viel Zeit er bis Zug 12 in seinen 20 häufigsten Stellungen verbraucht. Lohnt es sich, kommen seine 30 häufigsten Repertoire-Stellungen bis Zug 10 bis 12 (aus games_raw nach Häufigkeit) als Beimischung mit 1 s Limit.

**Warum:** Bis Zug 15 liegt er gleichauf, verbraucht aber zwischen Zug 10 und 15 rund 20 s. Ein Puffer von 5 bis 10 s bei kaum Fehlerrisiko ist denkbar, aber nicht belegt.

**Erfolg:** Die Restzeit bei Zug 15 liegt mindestens 5 s über der Basis von 146 s.

### Glanzzüge als seltene Überraschung

Aufwand: S · Kandidaten: K29

**Was:** Das Material kommt aus Schritt 2. Höchstens eine Stellung pro Satz wird unangekündigt eingestreut, in der er in der Partie den einzigen guten Zug gefunden hat, ohne Schlagzug. Danach steht da: „Diesen Zug hast du am 12.07. mit 0:14 auf der Uhr in 2 s gefunden.“ Findet er ihn nicht: „Damals hast du ihn gefunden. Er steckt also drin.“ Glanzzüge zählen getrennt.

**Warum:** Die Übungsbank besteht nur aus Fehlern und wird auf Dauer zur Mängelliste. Eigene Erfolge stärken das Selbstbild „Ich finde so etwas unter Zeitdruck“.

**Erfolg:** Laurens sagt nach 2 Wochen „bleibt“. Sätze mit Glanzzug enden öfter mit „Nächster Satz“.

### Anschluss-Knopf statt Tagesprogramm

Aufwand: S · Kandidaten: K23

**Was:** Erst wenn es den Tempo-Satz gibt: Nach einem Fehler-Satz bietet die Ergebnisseite „Weiter: 3 Minuten Tempo“ an, jederzeit beendbar. Es gibt keine Gänge mit Häkchen, keinen Wochentagsplan und keinen Status „1 von 3“.

**Warum:** Die App gefällt ihm, weil sie aus einem Knopf besteht. Gegen Überladung hilft, weniger Modi zu bauen.

**Erfolg:** An mindestens der Hälfte der Trainingstage folgt dem Fehler-Satz ein Tempo-Block.

### „Jetzt du“: die Lösung selbst nachspielen

Aufwand: M · Kandidaten: K09

**Was:** Nur auf Tipp: Nach einem Fehler springt das Brett zurück. Er spielt den besten Zug selbst, Big Dog antwortet nach der Engine-Variante, und er sucht bis zu 3 eigene Folgezüge. Die Folgestellungen sind ebenfalls vollständig bewertet. Das läuft über einen gemeinsamen Spieler für Zugfolgen, den auch Revanche und Leck-Pfade nutzen.

**Warum:** Selbst erzeugte Lösungen bleiben besser haften. Es kostet aber Aufgaben pro 15 Minuten, und ohne Bewertungen der Folgestellungen wäre es wieder unfair.

**Erfolg:** Bei der ersten Wiederholung liegt die Quote nachgespielter Karten über der nicht nachgespielter. Die Aufgaben pro 15 Minuten sinken um höchstens 5 %.

### Automatischer Schwerpunkt aus schwachen Gruppen

Aufwand: S · Kandidaten: K12

**Was:** Ist eine Gruppe über mehrere Sätze mit mindestens 8 Versuchen schwach (gemessen gegen p_ok_me), wird sie in den nächsten 3 Sätzen unter den neuen Übungen stärker beigemischt, etwa 40 %. Auf „Heute“ steht das als wegtippbare Information: „Schwerpunkt: Gabel (automatisch)“.

**Warum:** Erst sinnvoll, wenn die Erstversuch-Quote 4 Wochen läuft. Bei 3 bis 4 Versuchen pro Satz wäre es Rauschen.

**Erfolg:** In beigemischten Gruppen steigt die Erstversuch-Quote schneller als in den übrigen.

### Claude-Notizen für hartnäckige Muster

Aufwand: S · Kandidaten: K11

**Was:** Für Karten, die er 3-mal oder öfter falsch gelöst hat, schreibt Claude bei der neuen Runde 2 bis 3 Sätze, die nur auf den gespeicherten Varianten beruhen. Sie landen als `note` in den Übungsdaten, und der Build prüft sie mit python-chess. Welche Karten betroffen sind, liest Claude aus dem Kopierknopf.

**Warum:** Hinter einem Dauerbrenner steckt meist ein Denkfehler. Das lohnt sich erst ab etwa 20 solcher Karten.

**Erfolg:** Karten mit Notiz löst er innerhalb von 3 Wiederholungen häufiger als vorher.

## Bewusst nicht

- **Einzelne Funktionen über Partie-Fenster von 50 Partien bewerten:** Nachgerechnet: Die Standardabweichung des Rückstands vor Zug 30 beträgt 34,6 s. Beim Vergleich zweier Fenster ist das Band ±13,6 s breit, also breiter als der ganze Rückstand von 11,3 s. Die Monate schwanken zusätzlich zwischen −6 und −23 s. Ob eine Funktion bleibt, entscheiden sein Urteil und die Trainingskennzahlen. Partiedaten liefern nur das Gesamturteil nach mindestens 120 Partien.
- **Regelwechsel alle zwei Wochen nach Kalender:** Passt weder zu Partien, die in Schüben kommen, noch zur Messung. Regel 1 („nicht grübeln“) trifft das Kernproblem und bleibt, bis Laurens wechseln will.
- **Ablauf „Gleich spiele ich“ mit 3 sicheren Karten und Link „Zu chess.com“, zweites Symbol mit ?mode=warmup:** Wäre ein zusätzlicher Ablauf vor dem Spielen, also genau die Reibung, die bei einem Spieler in Schüben nicht hält. Regel auf der Partien-Karte plus Kurzbefehl über regel.json leisten den Kern. Ein zweites Symbol hätte auf iOS eigenen, leeren Speicher.
- **Taktik-Sprint mit lichess-Puzzles bzw. „Sturm mit Geist“ (K27):** Außerhalb der Zeitnot beherrscht er diese Muster so gut wie seine Gegner (hängende Figuren 16,9 gegenüber 17,6, Gabeln 8,9 gegenüber 8,7 pro 100 Partien), und die Puzzles stammen nicht aus seinen Stellungen. Es wäre ein weiterer Tempo-Modus im Wettbewerb um dieselben 15 Minuten.
- **„Hängt was?“ als eigener Wisch-Modus (K14 Typ A und C):** Die Lücke bei hängenden Figuren entsteht vor allem, weil er häufiger in Zeitnot gerät. Pro Zug in Zeitnot patzt er nur etwa 10 % öfter. Übrig bleibt „Was droht?“ als Aufgabenart.
- **Push-Erinnerung über eine GitHub Action (K26):** Kippt eine bewusste Entscheidung, obwohl er sanftere Anstupser (Begrüßung, Serie) selbst entfernt hat. Web-Push auf iOS ist unzuverlässig, und der Umbau des Service Workers gefährdet den stabilen Offline-Betrieb. Der Kurzbefehl leistet fast dasselbe.
- **Allgemeiner Gewinn-Drill aus der bisherigen Phase 2:** Wird durch die Revanche ersetzt: eigene verlorene Gewinnstellungen mit der damaligen Uhr beider Seiten.
- **Stockfish-Prüfer auf dem Gerät und „Starke Engine“ (94 MB):** Die Offline-Bewertung aller Züge ersetzt den Prüfer ohne Akku und ohne Wartezeit. Für die Nachbetrachtung echter Partien reicht der Knopf „In lichess-Analyse öffnen“.
- **Zweite Chance mit Wertung in FSRS:** Eine richtige Antwort 30 s nach „Nochmal“ schließt den 1-Minuten-Lernschritt ab und schiebt die Karte gleich in Abstände von Tagen. Deshalb nur anzeigen.
- **Herz-Tipp für Sprüche, Marke „Tag zählt“ am Balken:** Sichtbare Kleinteile ohne Wirkung. Lieblingssprüche nennt er im Chat, und der Comeback-Mechanismus macht die Marke überflüssig.
- **Prüfsatz-Liste in meta.json:** loadData() lädt meta.json nur optional und verschluckt Fehler. Fehlt die Datei, landen die Prüfstellungen still im Training. Die Markierung `hold` gehört in exercises.json.
- **Bullet verbieten oder als Störfaktor behandeln:** Nachgerechnet: In 3+0-Partien nach Wochen mit mindestens 50 Bullet-Partien lag der Rückstand vor Zug 30 bei −14,5 s, sonst bei −16,0 s. Bullet wird stattdessen geholt und getrennt ausgewertet.
- **Tagesprogramm in drei Gängen mit Häkchen und Wochentagsplan (K23 in der vorgeschlagenen Form):** Fühlt sich wie Hausaufgaben an. Höchstens kommt später ein Anschluss-Knopf.
- **Elo als Hauptzahl, Wochenziel „7/14“, Ampel-Uhren, „Blitz-reif“ als Hauptzahl, Bestenlisten, Puzzle-Rating, Abzeichen:** Die Elo schwankt zu stark (allein im Juli 1.294 bis 1.516). Der Rest wäre eine Serie durch die Hintertür oder eine schöne Zahl, die Können behauptet, wo nur Gedächtnis wächst.
- **Claude live in der App (API-Schlüssel auf dem Gerät):** Kosten und Schlüsselverwaltung bei kaum Mehrwert gegenüber Kopierknopf und Chat.
- **Systemwechsel in der Eröffnung durch die App erzwingen:** Ungewohnte Stellungen kosten anfangs Bedenkzeit, also genau die Uhr, um die es geht. Ob er wechselt, entscheidet Laurens.

## Außerhalb der App

- Eine einzige Regel in allen Partien, in 3+0 wie im Bullet: Wenn du über 10 s nachdenkst (im Bullet über 3 s) und es kein Schach, keinen Schlag und keine Drohung gibt, zieh deinen besten Kandidaten. In klar gewonnener Stellung reicht der erste sichere Zug. Dein Problem ist nicht das Tauschen (du schlägst in Gewinnstellungen so oft wie deine Gegner), sondern das Grübeln.
- Nach jedem Gegnerzug ein kurzer Blick: Was greift er an? Kein Prüfritual vor jedem eigenen Zug, das kostet genau die Zeit, um die es geht.
- Einmal die Einstellungen in der chess.com- und der lichess-App durchgehen: Premoves an (die nutzt du schon viel), automatische Umwandlung zur Dame, die Zugeingabe, mit der du unter Zeitdruck am sichersten ziehst (Tippen oder Ziehen), auf lichess keine Zugbestätigung, und ein Warnton bei wenig Restzeit, falls angeboten.
- Nach einer Blitz- oder Bullet-Session die App öffnen und die Partien-Karte ansehen. 30 Sekunden reichen. Eine auffällige Denkpause merkst du mit einem Tipp vor, eine Partie, die dich ärgert, öffnest du mit einem Tipp in der lichess-Analyse.
- Für dich selbst klären, wofür Bullet da ist: Ausgleich oder Training? Wenn es Training sein soll, gilt dort dieselbe Regel, und die App misst es mit.
- 3+2 bewusst einsetzen oder ganz lassen. Ein Vorschlag: ein Abend pro Woche in 3+2 als Endspiel-Abend, an dem du Gewinnstellungen ohne Zeitverlust zu Ende spielst. Die App wertet diese Partien getrennt aus.
- Einmal im Monat im Chat „neue Runde“ sagen. Claude holt dann deine Partien, rechnet Stockfish, macht Übungen aus deinen neuen Fehlern und vorgemerkten Denkpausen und liefert die Skill-Kennzahlen.
- Alle zwei Wochen „Auswertung für Claude kopieren“ in den Chat geben. So entscheiden echte Nutzungsdaten, was als Nächstes gebaut wird.
- Vor Schritt 3 einmal eine Partie auf chess.com spielen, die Endzeit notieren und Claude Bescheid geben. Claude prüft dann, nach wie vielen Minuten sie im Archiv steht.
- Optional die iOS-Kurzbefehl-Automation einrichten: „Wenn chess.com oder lichess geöffnet wird → Mitteilung mit der aktuellen Regel“. Sie liest die Regel aus regel.json, läuft lokal und lässt sich jederzeit abschalten.
- Fair Play: Die App nie während einer laufenden Partie öffnen. Regel und Kurzbefehl sind nur für die Zeit davor gedacht.

## Messung

Gemessen wird auf drei Ebenen. Jede Zahl hat eine Mindestmenge und ein Band, und einzelne Funktionen werden nicht über Partie-Fenster bewertet.

(1) Wirkung in echten Partien, mit getrennter Basis pro Format, eingefroren mit derselben TypeScript-Funktion wie neue Partien.
- 3+0 auf chess.com, Basis aus den letzten 300 Partien vom 28.07. bis 14.10.2026.
  - Leitgröße A: eigene Zeit von Zug 16 bis 29. Basis 74 s, Standardabweichung 27 s, keine Störung durch den Gegner.
  - Leitgröße B: Denkpausen von 10 s oder mehr in Zug 15 bis 35 pro Partie. Basis 2,16, Gegner 1,46, Standardabweichung 1,74.
  - Begleitend der Rückstand vor Zug 30 gegenüber den Gegnern (−11,3 s, Standardabweichung 34,6 s) und die beiden Budget-Quoten (41 % bei Zug 30, 59 % bei Zug 20).
  - Der Rückstand erscheint als laufende Kurve vor dem normalen Bereich seiner Monatswerte von −6 bis −23 s. Die Basis von −11,3 s ist ein eher günstiger Ausschnitt (August −6,3 s, 1. bis 14. Oktober −22,8 s). Gegen die Gesamtwerte der Diagnose (−15,1 s) sähe jeder Vergleich zu gut aus.
- Bullet 1+0 auf lichess, Basis aus den letzten 600 Partien: Rückstand vor Zug 20 −2,9 s (Standardabweichung 9,2 s), 75 % der Niederlagen auf Zeit.
- Qualitätsbremse: Materialverlust von mindestens 2 Bauern innerhalb von 2 Halbzügen nach eigenen Zügen unter 2 s, bei mindestens 30 s Restzeit in Zug 10 bis 35. Gezählt pro 100 solcher schnellen Züge, das sind etwa 16,7 pro Partie, Basis etwa 1,7. Summiert wird über mindestens 150 Partien, als gestiegen gilt die Rate erst ab +50 %.
- Spätindikatoren nach jeder neuen Runde:
  - Patzer pro 100 Mittelspielzüge ohne Zeitnot (3,59, Gegner 3,29)
  - hängende Figuren außerhalb der Zeitnot (16,9 pro 100 Partien)
  - Zeitverluste in nicht verlorener Stellung (6,8 pro 100 Partien)
  - Verwertung ab 90 % Gewinnchance (76,6 %)

(2) Können im Training:
- Erstversuch-Quote gegen p_ok_me, gleitend über 50, mit Band und getrennt für „Leichtsinn“ und „Nächste Stufe“. Sie erscheint erst nach dem Datenlauf.
- Monats-Check mit 15 unbekannten Prüfstellungen gegen deren p_ok_me.
- Behalten bei Wiederholungen nach mindestens 7 Tagen Abstand, Ziel nahe 90 %.
- Später die Median-Zeit in ruhigen Stellungen bei gleicher Quote.

(3) Freude und Regelmäßigkeit, nur über den Kopierknopf und nie als Anzeige:
- Trainingstage pro Woche (Ziel mindestens 4) und Minuten pro Tag
- Anteil „Nächster Satz“ und abgebrochene Sätze
- Rückkehr innerhalb von 3 Tagen nach einer Pause
- „bleibt oder raus“ zu jeder neuen Funktion nach 2 Wochen

Vorab festgelegtes Erfolgskriterium für das Ganze, beim Format, das Laurens als Ziel nennt:
- 3+0: Nach mindestens 120 Partien, die Zug 30 erreichen, gezählt ab dem Start der Uhr-Schleife, liegt mindestens eine Leitgröße über das Band hinaus besser als die Basis. Das heißt eigene Zeit von Zug 16 bis 29 bei höchstens 66 s (Band im Vergleich zur Basis etwa ±6 s) oder Denkpausen bei höchstens 1,7 pro Partie (Band etwa ±0,4). Gleichzeitig steigt die Qualitätsbremse nicht.
- Bullet: Nach mindestens 600 Partien liegt der Rückstand vor Zug 20 bei −1,5 s oder besser (Band etwa ±1,0 s).

Wird das Kriterium verfehlt, ändert sich der Ansatz: mehr Gewicht auf die Regel in Partien, 3+2-Wochen oder die Budget-Partie, statt weitere Module zu bauen.

## Offene Entscheidungen für Laurens

- Bullet zuerst: Seit März hast du auf lichess rund 3.000 Partien 1+0 gespielt, im September 922 gegen 10 Partien 3+0. Ist Bullet für dich Ausgleich oder Teil des Ziels, und welches Format willst du vorrangig besser spielen, 3+0 auf chess.com oder 1+0 auf lichess? Davon hängen Leitkennzahl, Erfolgskriterium und die Quelle neuer Übungen ab.
- Prüfsatz: Bist du einverstanden, dass 60 der 1.200 Übungen ab sofort aus dem Training verschwinden und nur noch für den monatlichen Check dienen? Das geht nur jetzt.
- Unter „Fortschritt“ steht noch „Serie“. Auf „Heute“ hast du sie entfernt. Soll sie auch dort weg und durch „Trainingstage im Monat“ ersetzt werden?
- Bekommt Claude Leserecht auf dein privates Sync-Repo, damit es Auswertungen und Vormerkungen selbst lesen kann, oder reicht dir der Knopf „Auswertung für Claude kopieren“?
- Partien holen: automatisch beim Öffnen der App oder nur per Knopf?
- Reihenfolge nach dem Fundament: zuerst die Uhr-Schleife (größter Hebel, startet die Messung) und danach Big Dog auf der Ergebnisseite, oder umgekehrt, weil dir der Spaß-Teil wichtiger ist?
- 3+2: als wöchentlichen Endspiel-Abend bewusst einsetzen oder die Empfehlung aus dem Plan streichen?
- Caro-Kann und Skandinavisch (dein schwächster Bereich, 44 % in 68 Partien): beim System bleiben und dort die bessere Variante üben, oder bewusst auf 2.d4 bzw. 2.exd5 umsteigen?
- Darf die Liste deiner Eröffnungs-Lecks öffentlich liegen wie die Übungen, oder muss sie privat bleiben? Privat heißt: ein zweiter Datenweg zum privaten Repo.
- Big Dog nach einer schlechten Session: Darf er auf der Partien-Karte etwas sagen, oder spricht er nur im Training?
- Kurzbefehl beim Öffnen von chess.com und lichess mit der aktuellen Regel: ausprobieren?

## Änderungen gegenüber der bisherigen Phase-2-Planung

Die Phase 2 aus docs/app-spezifikation.md (Abschnitte 2 und 10: Uhr-Coach mit Gewinn-Drill und Zeitbudget-Check, Taktik-Sprint, Stockfish-Prüfer) wird umgebaut. Grund: Er gerät 2,3-mal so oft in Zeitnot, patzt dort aber kaum öfter. Die Zeit verliert er vorher, mit überzähligen Denkpausen in ruhigen Mittelspielstellungen. Außerdem spielt er seit März überwiegend Bullet auf lichess, mit demselben Uhr-Muster.

Die Änderungen im Einzelnen:

(1) Neu vor Phase 2 kommt Version 1.2.
- Update-Weg über version.json mit registration.update() und Neuladen außerhalb von Sätzen.
- Tolerantes Datenformat: `minReader`, `kind`, `lim` und `dv` je Antwort, reserviertes `snap`, App-Version pro Gerät.
- Prüfsatz mit `hold` in exercises.json, Comeback ohne Kartenberg, korrigierte Fokus-Karte („nicht grübeln“ statt „tauschen“) und Kopierknopf.

(2) Ein Offline-Datenlauf.
- Alle Züge werden bewertet.
- p_ok_me statt p_best_me als Richtwert.
- Motive werden korrigiert, neue Übungen nach Priorität sortiert (ohne Zeitnot-Bonus), dazu der Drohungspfeil.
- Die Brett-Komponente wird vor allen Umbauten herausgelöst.
- Alte Urteile werden beim Lesen neu gewertet. Dadurch ändert sich Abschnitt 8 „Datenformat der Übungen“ von MultiPV 5 zu „alle Züge bewertet“.

(3) Der Zeitbudget-Check wird vorgezogen und zur Uhr-Schleife ausgebaut.
- Das Holen von Partien aus Abschnitt 8a bzw. Version 2 kommt nach vorn: chess.com und lichess, ohne Engine, mit Zügen und Uhr je Halbzug, lokal pro Gerät.
- Unter „Fortschritt“ ersetzt die Karte „Uhr“ die „Ausgangslage“, als laufende Kurve gegen den normalen Monatsbereich.
- Neu festgelegt: „vor Zug N“ heißt Uhr nach dem eigenen Zug N−1, die Basis wird pro Format in TypeScript eingefroren, die Regel liegt öffentlich in regel.json.

(4) Der Taktik-Sprint entfällt. An seine Stelle treten ruhige Stellungen, zuerst als Beimischung, später als Tempo-Satz mit Zeitkonto.

(5) Aus dem Gewinn-Drill wird „Gegen Big Dog“: Revanche plus Budget-Partie, zuerst als Prototyp.

(6) Der Stockfish-Prüfer und die „Starke Engine“ entfallen. Für die Nachbetrachtung gibt es „In lichess-Analyse öffnen“, Stockfish lite nur für Big Dog.

(7) Version 2 wird aufgeteilt.
- Lecks, „Was droht?“ und Endspiel-Urteil werden Aufgabenarten im Fehler-Trainer.
- Der Wochenbericht wird zur Partie der Woche.
- Der Import wird zweigeteilt: Uhrdaten sofort im Browser, Engine-Analyse monatlich per „neuer Runde“, die jetzt auch Skill-Kennzahlen liefert. Der Nachtlauf kommt später, im privaten Repo.

(8) Abschnitt 6 bleibt: keine Push-Nachrichten. Als Auslöser dient der Kurzbefehl über regel.json, für chess.com und lichess.

(9) Neue Planungsregeln.
- Höchstens zwei neue Modi in Phase 2, höchstens ein neuer Ablauf pro Version.
- Abbruchkriterien, Bedingungen statt Kalender.
- Nach 2 bis 3 Wochen Nutzungsdaten wird über Schritt 4 und 5 entschieden.

Der Kritik folge ich fast vollständig. Bewusst abweichend:
- (a) Die Zweite Chance wird gar nicht gewertet statt mit Note 2. Das ist einfacher und für FSRS sicher.
- (b) Alte Urteile werden nur zu seinen Gunsten neu gewertet, nie verschärft. „Zu langsam“ richtet sich weiter nach dem damaligen Limit.
- (c) Die Budget-Partie bleibt im Plan, aber als zweite Art von Akte im Modus „Gegen Big Dog“ und erst nach dem Prototyp. So wird sie kein dritter Modus.
- (d) Den Regelwechsel binde ich nicht an Messfenster, sondern streiche ihn. Weil Funktionen nicht mehr einzeln über Fenster bewertet werden, dürfen Regel und ruhige Stellungen bewusst dieselbe Botschaft tragen.
- (e) Das Prinzip „ein sichtbares Element pro Version“ wird nicht wörtlich gehalten, sondern zu „ein neuer Ablauf pro Version“ präzisiert. Dazu entfallen Herz-Tipp, die Marke „Tag zählt“ und der Aufwärm-Ablauf.
- (f) Das Gesamturteil an echten Partien bleibt, nur die Bewertung einzelner Funktionen über Fenster entfällt.
- (g) Die Basis bleibt bei den letzten 300 Partien und wird nicht durch die aktuelle Form ersetzt. −22,8 s beruhen auf nur 50 Partien. Sichtbar gemacht wird der normale Bereich.
- (h) Vormerkungen landen als `kind: 'mark'` im Abgleich (erst wenn beide Geräte mindestens 1.2 melden), nicht nur im Kopierknopf.
- (i) Bullet bekommt vorerst keine eigenen Budget-Tore, nur Rückstand und Zeitverluste mit Mehrmaterial, bis Laurens das Zielformat entschieden hat.

## Anhang: Rangliste der Kandidaten

Noten 1 bis 5 je Juror: Spielstärke, Spaß und Regelmäßigkeit, Machbarkeit, Skeptiker. Aufwand S/M/L.

| ID | Kandidat | Ø | Stärke | Spaß | Machbar | Skeptiker | Aufwand |
|---|---|---|---|---|---|---|---|
| K01 | Partien holen: Uhr-Bilanz jeder echten Partie, ohne Engine | 4.75 | 5 | 5 | 4 | 5 | M |
| K07 | Faires Urteil: alle Züge jeder Übung offline bewerten | 4.25 | 3 | 4 | 5 | 5 | S |
| K02 | Ruhige Stellungen: „Gut genug, sofort ziehen“ als neuer Übungstyp (Triage) | 4 | 5 | 4 | 3 | 4 | M |
| K04 | Aufwärmen vor dem Blitzen: 3 Minuten mit Wenn-dann-Karte | 4 | 4 | 4 | 4 | 4 | S |
| K21 | Wiedereinstieg ohne Schuldenberg | 4 | 2 | 5 | 4 | 5 | M |
| K05 | Uhr als Leitkennzahl unter „Fortschritt“, mit Rauschregeln und eingefrorener Basis | 3.75 | 3 | 3 | 4 | 5 | M |
| K08 | Tempo-Leiter pro Karte: vom Finden zum Sehen (Woodpecker in FSRS) | 3.75 | 4 | 4 | 4 | 3 | S |
| K15 | Revanche: verlorene Gewinnstellungen mit der damaligen Uhr zurückholen | 3.75 | 4 | 5 | 2 | 4 | L |
| K19 | Big Dog als Anti-Coach: Sprüche zu messbaren Momenten | 3.75 | 1 | 5 | 5 | 4 | S |
| K24 | Blitz-Rhythmus im Satz: Countdown-Uhr, damalige Partie-Uhr, automatisch weiter | 3.75 | 2 | 4 | 5 | 4 | S |
| K03 | Zeitkonto über den ganzen Satz (Budget-Lauf) | 3.5 | 4 | 4 | 3 | 3 | M |
| K06 | Datenmodell für Phase 2 jetzt festlegen, bevor das erste neue Modul kommt | 3.5 | 2 | 2 | 5 | 5 | M |
| K10 | Nachholrunde: Fehler am Satzende noch einmal | 3.5 | 2 | 3 | 5 | 4 | S |
| K12 | Neue Aufgaben nach Lernwert und Zielquote wählen, Schwächen automatisch beimischen | 3.5 | 3 | 4 | 4 | 3 | S |
| K13 | Können messen statt Gedächtnis: Erstversuch-Quote und fester Prüfsatz | 3.5 | 2 | 3 | 5 | 4 | S |
| K11 | Erklärungen mit Substanz: Motive korrigieren, Fallen, Wiederholer, Claude-Notizen | 3.25 | 2 | 3 | 4 | 4 | M |
| K16 | Endspiel auf Tempo: Tablebase-Drill aus eigenen Endspielen, später Zeitfahren | 3.25 | 3 | 4 | 3 | 3 | M |
| K20 | Ergebnis mit „Damals gegen heute“, Moment des Satzes und Fehler-Galerie | 3.25 | 1 | 4 | 4 | 4 | S |
| K22 | Sonntags-Rückblick: Big Dogs Wochenurteil, Partie der Woche, Wochenfokus | 3.25 | 3 | 4 | 3 | 3 | M |
| K09 | Fehler auf dem Brett zeigen und die Lösung selbst nachspielen | 3 | 2 | 3 | 3 | 4 | M |
| K14 | „Hängt was?“: Sicherheits-Check im Zeitnot-Tempo | 3 | 3 | 4 | 3 | 2 | M |
| K17 | Eröffnungs-Lecks als zwei Regeln mit Reflex-Tempo und Mini-Pfaden | 3 | 2 | 2 | 4 | 4 | S |
| K23 | Tagesprogramm in drei Gängen statt eines einzigen Knopfs | 3 | 3 | 3 | 3 | 3 | M |
| K18 | Leck-Bilanz: Eröffnungs-Lecks in jeder neuen Partie prüfen | 2.75 | 1 | 2 | 4 | 4 | S |
| K27 | Sturm mit Geist: fester Wochen-Parcours gegen die eigene Bestleistung | 2.75 | 2 | 4 | 3 | 2 | M |
| K28 | Zwillinge und Spiegelbilder: das Muster prüfen, nicht das Bild | 2.75 | 2 | 2 | 4 | 3 | M |
| K29 | Glanzzüge: eigene starke Momente als seltene Überraschung | 2.75 | 1 | 4 | 3 | 3 | M |
| K25 | Nachtlauf im privaten Sync-Repo: Engine-Kennzahlen und frische Übungen aus den Partien von gestern | 2.67 | 3 | – | 2 | 3 | L |
| K26 | Erinnerung nach dem Blitzen: Web-Push über eine GitHub Action statt eigenem Server | 2 | 2 | 2 | 2 | 2 | M |

## Anhang: Kernerkenntnisse der sechs Blickwinkel

**Lernwissenschaft:** Die App trainiert heute nur angekündigte Rätsel mit einem versteckten besten Zug. Laurens verliert seine Punkte aber an anderer Stelle. Das zeigt eine eigene Auswertung von data/analysis.jsonl und games_raw.jsonl über 1.428 Partien in 3+0. Er denkt pro Partie 3,0-mal 10 s oder länger nach, die Gegner 1,9-mal. In diesen langen Denkpausen stecken bei ihm 53 s, bei den Gegnern 29 s. Das ist mehr als sein ganzer Rückstand von 18 s bei Zug 35. 80 % dieser Denkpausen fallen in Stellungen, in denen der zweitbeste Zug weniger als 5 Prozentpunkte schlechter ist. Es gibt dort also mehrere gute Züge, und längeres Nachdenken bringt nichts: Die Fehlerquote steigt sogar von 3,0 % (unter 2 s) auf 6,5 % (10 bis 20 s). 30 % der Denkpausen fallen in Stellungen mit mindestens 70 % Gewinnchance. Kritische Mittelspielstellungen spielt er dagegen im Median in 1,4 s. Er denkt also lange, wo es egal ist, und kurz, wo es zählt. Die Entscheidung „Ist hier überhaupt etwas los?" kommt im Training nicht vor, weil jede Aufgabe eine Lösung hat und ein Zeitlimit pro Aufgabe läuft. Damit Training in Blitzpartien wirkt, braucht es drei Dinge: unangekündigt gemischte ruhige und kritische Stellungen, eine Uhr, die über den ganzen Satz läuft, und eine Messung, die Können von Gedächtnis trennt (Erstversuche, fester Prüfsatz, Import der Partien). Sonst misst die App nur, wie gut er sich 1.200 Stellungsbilder merkt.

**Motivation und Gewohnheit:** Die App steht bisher neben Laurens' eigentlicher Gewohnheit statt an ihr. Er blitzt ohnehin, aber in Schüben: 176 Spieltage in 21 Monaten, zwischen 1 und 360 Partien im Monat und 20 Pausen von mindestens 8 Tagen, darunter eine von 56 und eine von 122 Tagen. Für dauerhafte Motivation braucht es keine zusätzliche Spielmechanik. Die App muss sich an die Blitz-Gewohnheit andocken: vor dem Spielen mit 2 Minuten Aufwärmen und der Zeitbudget-Regel, nach dem Spielen mit einer Uhr-Bilanz der echten Partien. Die Bilanz geht ohne Stockfish und ist deshalb sofort machbar: Zug 30 mit mindestens 1:20 schafft er heute nur in 29,6 % der Partien. Außerdem muss die App Pausen verzeihen. Mit den heutigen FSRS-Einstellungen stehen nach einer Pause 77 bis 174 Karten auf „Fällig“, und die „Serie“ fällt auf 0. Big Dog ist das passende Werkzeug für die Momente, die zählen. Er verkörpert in der Satire genau die Unarten aus der Diagnose: sofort ziehen, die Uhr verbrennen, nie analysieren. So nimmt er Fehlern, langsamen Sätzen und der Rückkehr nach einer Pause den Stich, ohne Schuldgefühl und ohne Abzeichen.

**Blitz-Trainer:** Fast der ganze Abstand zu deinen Gegnern entsteht in Zeitnot, und in Zeitnot gerätst du vor allem durch wenige lange Denkpausen in ruhigen Stellungen. Ich habe die Diagnose-Daten nachgerechnet (3+0, Züge außerhalb der Zeitnot). Außerhalb der Zeitnot patzt du nicht öfter als deine Gegner: 2,11 statt 2,18 Patzer pro 100 Züge, hängende Figuren 16,9 statt 17,6 pro 100 Partien, Gabeln 8,9 statt 8,7. Der Rückstand bei hängenden Figuren (23 statt 19,5) kommt allein aus der Zeitnot (6,1 statt 1,9 pro 100 Partien). Du kommst in 42 % der 3+0-Partien in Zeitnot, deine Gegner in 24 %. Die Ursache sind 3,3 Denkpausen von mindestens 10 s pro Partie (zusammen 58 s, 39 % deiner verbrauchten Zeit), bei den Gegnern 2,1 (31 s, 22 %). 79 % deiner Denkpausen ab 15 s fallen in Stellungen, in denen laut Engine mindestens zwei Züge praktisch gleich gut sind. Echte Stellungen mit nur einem guten Zug sind es nur 3 %. Allein diese ruhigen Denkpausen kosten dich rund 27 s pro Partie, mehr als die 18 s Rückstand bei Zug 35. Die App trainiert heute zu 100 % das Finden des besten Zugs in kritischen Stellungen, mit großzügigen 10 s. Das ist eine Genauigkeit, die du ohne Zeitnot schon hast. Den größten Unterschied macht ein Training der Entscheidung, wann du nachdenkst und wann du einfach ziehst. Danach kommen ein Partie-Check, der genau das in deinen echten Partien misst, und Drills, die unter echtem Zeitdruck laufen statt mit großzügigem Zeitlimit.

**Wirkung messen:** Die Uhr ist zugleich das größte Leck und die beste Messlatte. Restzeit und Rückstand vor Zug 30 stehen in jeder Partie im PGN, ganz ohne Engine. Sie sind nach 40 bis 60 Partien aussagekräftig und hängen eng mit dem Ergebnis zusammen, auch unabhängig von der Stellung: Bei ausgeglichener Stellung in Zug 30 holt Laurens mit 20 s Rückstand oder mehr nur 22 % der Punkte (52 % Zeitverluste), mit Gleichstand bis 20 s Vorsprung 63 %. Ergebnis-Zahlen sind dagegen so verrauscht, dass sie Monate brauchen. Drei aufeinanderfolgende 100-Partien-Blöcke vor dem Training lagen beim Score bei 0,60, 0,44 und 0,44. Die Elo schwankte allein im Juli zwischen 1.294 und 1.516 und liegt heute bei 1.311. Den Kreis schließt man deshalb zuerst mit einem Uhr-Check im Browser. Ergebnisse misst man nur mit großen, nach Partien gezählten Fenstern gegen eine eingefrorene, gleich definierte Basis. Und man misst, wo die Zeit wirklich bleibt: 79 % seiner Bedenkzeit zwischen Zug 13 und 30 fließt in Züge, bei denen mehrere Züge gleich gut sind. Das sind im Schnitt 61 s pro Partie, ein Drittel der Grundzeit, bei einem Rückstand von 12 bis 15 s vor Zug 30.

**Produkt und UX im Code:** Die App trainiert heute nur eine Hälfte der Zeitverteilung, und sie sieht seine echten Partien nicht. Sie zeigt ausschließlich kritische Stellungen mit 10 s Limit, übt also: „Nicht vorschnell ziehen“. Seine Partien zeigen aber vor allem das Gegenstück. Eigene Grobrechnung aus data/analysis.jsonl (1.428 Partien 3+0, eigene Züge 15 bis 40, Gewinnchance nach der lichess-Formel): In Routinestellungen, in denen der beste und der zweitbeste Zug höchstens 3 Prozentpunkte auseinanderliegen, braucht er im Schnitt 5,7 s pro Zug (Median 3,4 s). In kritischen Stellungen, in denen der zweitbeste Zug mindestens 15 Punkte schlechter ist, braucht er nur 3,0 s (Median 1,3 s) und patzt dabei in 18 % der Fälle. 40 % seiner Bedenkzeit gehen in Routinezüge, 5 % in kritische Züge. In Partien, die er auf Zeit verloren hat, kosten ihn langsame Routinezüge (über 8 s, Züge 10 bis 30) im Schnitt etwa 32 s, gerechnet gegen ein Tempo von 3 s pro Zug. In den übrigen Partien sind es 16 s. Daraus folgen die beiden Hebel mit der größten Wirkung. Erstens die Schleife zu den echten Partien schließen: Die Uhrdaten der öffentlichen APIs reichen dafür, eine Engine ist nicht nötig, und CORS ist offen, also ist das billig. Zweitens die fehlende Hälfte üben: Routinestellungen schnell spielen. Dazu kommen drei billige Korrekturen, damit es mehr Spaß macht und mehr bringt. Das Urteil soll fair sein (in 20 % der Übungen kennt die App gute Züge nicht). Fehler sollen auf dem Brett sichtbar werden statt als Text (45 von 47 „Matt in N“-Motiven beschreiben die Drohung des Gegners, nicht die Lösung). Und das Datenmodell muss jetzt für Phase 2 vorbereitet werden, bevor ältere App-Stände über den Abgleich neue Daten löschen.

**Spieldesign:** Der heutige Fehler-Trainer zeigt nur kritische Stellungen, denn jede Aufgabe ist ein früherer Fehler. Er belohnt damit die Haltung „überall steckt ein Trick, nimm dir 10 s“. Laurens' Zeit geht aber in ruhigen Stellungen verloren. Eigene Nachrechnung der 1.428 Partien in 3+0, Zug 13 bis 35, ohne Zeitnot: Er denkt 2,6-mal pro Partie 10 s oder länger nach (Gegner 1,6-mal) und verbraucht dabei 45 s statt 24 s. Das ist ziemlich genau sein Rückstand bei Zug 35. In 76 % seiner Mittelspielzüge ist der zweitbeste Zug höchstens 5 Punkte schlechter. Dort bringt langes Nachdenken keine besseren Züge: 2,3 % Fehler unter 2 s, 5,8 % bei 10 bis 20 s. Die Marke 1:20 bei Zug 30 hält er nur in 35 % der Partien. Hält er sie, verliert er 11 % auf Zeit, sonst 38 %. Die neuen Spielmodi sollten deshalb vor allem Triage trainieren, also unterscheiden zwischen „ruhig, gut genug, sofort ziehen“ und „kritisch, Zeit investieren“. Das geht mit einem gemeinsamen Zeitkonto über mehrere Stellungen statt mit einem Limit pro Aufgabe. Den Erfolg misst man an der Uhr in echten Partien, nicht an der Trefferquote in der App.
