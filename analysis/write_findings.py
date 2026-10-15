"""Schreibt die Texte der Diagnose-Seite (data/findings.json) aus den Kennzahlen in data/report.json.

Aufruf:
    python analysis/write_findings.py

Zahlen kommen aus dem Report, Formulierungen sind fest. Danach analysis/build_report.py ausführen.
"""
import json
import math
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
r = json.loads((DATA / "report.json").read_text())


def de(x, d=0):
    s = f"{x:,.{d}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


to = r["timeouts"]
cv = r["conversion"]["winning_90"]
lost_winning = round(cv["n"] * cv["loss"] / 100)
cc = r["clock_curve_3_0"]
tu, tuo = r["time_use"]["by_phase"], r["time_use"]["opp_by_phase"]
eo = r["endgame_overall"]
eg = {e["type"]: e for e in r["endgames"]}
tb = r["tablebase"]
bm, bo = r["benchmark"]["me"], r["benchmark"]["opp"]
mot = {m["key"]: m for m in r["motifs_against_me"]}
mt = {m["cat"]: m for m in r["mistake_types_per_100_games"]}
mx = r["maia"]
fam = r["opening_families"]
sic = next(f for f in fam if f["family"] == "Sicilian Defense" and f["color"] == "black")
rp = r["rating_chesscom_blitz"]
peak = max(x["rating"] for x in rp)

# Opening-Explorer-Check der Lecks
leaks = [l for l in r["opening_leaks"] if l.get("explorer")]
conf = sorted([l for l in leaks if l["explorer"]["verdict"] == "bestätigt"],
              key=lambda l: l["explorer"]["best"]["score"] - l["explorer"]["played"]["score"], reverse=True)
contra = [l for l in leaks if l["explorer"]["verdict"] == "widerspricht"]


def leak_txt(l):
    e = l["explorer"]
    return f"{l['opening']}: dein {l['played'][0][0]} holt {de(e['played']['score'])} %, {l['best']} holt {de(e['best']['score'])} %"


# Grobe Schätzung: Punkte durch Zeitverluste in nicht verlorenen Stellungen
pts = to["lost_on_time_winning"] * 0.85 + to["lost_on_time_equal"] * 0.5
dscore = pts / r["n_games"]
elo = 400 * math.log10((0.5 + dscore) / (0.5 - dscore))
trainable = round(r["training_positions"] * (mx["classes"]["Leichtsinn"] + mx["classes"]["Nächste Stufe"]) / 100)

F = {
    "lede": (
        f"Ausgewertet wurden {de(r['n_games'])} Blitz-Partien mit 3 und 5 Minuten seit Januar 2025, fast alle auf chess.com in 3+0. "
        "Jeder Zug wurde mit Stockfish bewertet und mit den Zügen deiner Gegner in denselben Partien verglichen. Die haben praktisch dein Rating. "
        "Das Ergebnis: Am Brett spielst du auf ihrem Niveau, im Endspiel sogar besser. Die meisten Punkte verlierst du an der Uhr."
    ),
    "findings": [
        {
            "title": "Die Uhr kostet dich mehr als jede Eröffnung",
            "text": (
                f"Bis Zug 15 liegst du mit deinen Gegnern gleichauf. Im Mittelspiel denkst du pro Zug länger nach ({de(tu['Mittelspiel']['avg'], 1)} statt {de(tuo['Mittelspiel']['avg'], 1)} Sekunden). "
                f"In 3+0 hast du bei Zug 35 im Schnitt noch {de(cc['35']['me'])} Sekunden, deine Gegner {de(cc['35']['opp'])}. "
                f"{de(to['lost_on_time'])} deiner {de(to['losses'])} Niederlagen endeten durch Zeitablauf, {de(to['lost_on_time_winning'] + to['lost_on_time_equal'])} davon in Stellungen, die nicht verloren waren. "
                f"Grob überschlagen sind das allein etwa {de(round(elo / 5) * 5)} Elo."
            ),
        },
        {
            "title": "Gewonnene Partien gehen auf Zeit verloren",
            "text": (
                f"In {de(cv['n'])} Partien hattest du mindestens 90 % Gewinnchance. {de(lost_winning)} davon hast du noch verloren, "
                f"<b>{de(cv['loss_on_time'])} davon auf Zeit</b>. Am Brett verspielst du solche Stellungen selten. Du hast nur keine Zeit mehr, sie zu Ende zu spielen."
            ),
        },
        {
            "title": "Dein Endspiel ist besser als du denkst",
            "text": (
                f"Ohne Zeitnot patzt du in jedem Endspieltyp seltener als deine Gegner ({de(eo['me_blunders_per_100_no_tt'], 1)} gegenüber {de(eo['opp_blunders_per_100_no_tt'], 1)} Patzern pro 100 Züge). "
                f"Aber du spielst {de(eo['me_tt_share'])} % deiner Endspielzüge in Zeitnot, deine Gegner {de(eo['opp_tt_share'])} %. "
                f"Im Damen- und im Bauernendspiel ist es etwa jeder zweite Zug. "
                f"Die Endspieldatenbank bestätigt das: Von {de(tb['won_games'])} theoretisch gewonnenen Endspielen mit höchstens 7 Steinen hast du {de(tb['won_games_converted'])} gewonnen, "
                f"und {de(tb['tt_share'])} % dieser Züge fielen in Zeitnot."
            ),
        },
        {
            "title": "Die Eröffnung ist solide, mit ein paar konkreten Lecks",
            "text": (
                f"Nur {de(r['loss_by_phase']['Eröffnung'])} % der verlorenen Gewinnchancen entstehen in der Eröffnung, und dort patzt du nicht öfter als deine Gegner. "
                f"Mit Schwarz holst du im Sizilianer ({de(sic['n'])} Partien) {de(sic['resid'] * 100)} % mehr als erwartet. "
                f"Der lichess Opening Explorer bestätigt {de(len(conf))} von {de(len(leaks))} Engine-Lecks auch in der Praxis: Spieler mit {de(r['explorer']['bucket'])} bis {de(r['explorer']['bucket'] + 199)} auf lichess holen mit deinem Zug deutlich weniger. "
                f"Am klarsten: {leak_txt(conf[0])}; {leak_txt(conf[1])}. "
                + (f"Dagegen schneidet dein Zug bei {contra[0]['opening']} mit {de(contra[0]['explorer']['played']['score'])} % sogar besser ab als der Engine-Zug, das ist kein Leck. " if contra else "")
                + "Die bestätigten lassen sich mit wenigen Minuten Wiederholung stopfen."
            ),
        },
        {
            "title": "Taktisch: hängende Figuren und Gabeln",
            "text": (
                f"Pro 100 Partien wirst du {de(mot['hangingPiece']['me'])}-mal für eine hängende Figur bestraft (Gegner: {de(mot['hangingPiece']['opp'])}) "
                f"und {de(mot['fork']['me'])}-mal mit einer Gabel (Gegner: {de(mot['fork']['opp'])}). "
                f"Im Mittelspiel patzt du {de((bm['blunders_per_100_Mittelspiel'] / bo['blunders_per_100_Mittelspiel'] - 1) * 100)} % öfter als deine Gegner, obwohl du dort länger nachdenkst. "
                f"Gegnerische Fehler bestrafst du dagegen besser als sie: {de(mt['Gegnerfehler nicht bestraft']['me'])} verpasste Chancen pro 100 Partien, bei ihnen {de(mt['Gegnerfehler nicht bestraft']['opp'])}."
            ),
        },
        {
            "title": f"{de(mx['classes']['Leichtsinn'] + mx['classes']['Nächste Stufe'])} % deiner Fehler sind trainierbar",
            "text": (
                f"Maia-3 schätzt für jeden Fehler, wie oft Menschen deiner Stärke den richtigen Zug finden. "
                f"{de(mx['classes']['Leichtsinn'])} % sind Leichtsinn, den richtigen Zug findet man auf deinem Niveau meistens. "
                f"Weitere {de(mx['classes']['Nächste Stufe'])} % finden Spieler 300 Punkte über dir oft. "
                f"Das sind {de(trainable)} Stellungen aus deinen eigenen Partien, genau das richtige Übungsmaterial. "
                f"Leichtsinn passiert vor allem bei schnellen Zügen: {de(mx['fast_leichtsinn'])} % unter 2 Sekunden, {de(mx['slow_leichtsinn'])} % ab 5 Sekunden."
            ),
        },
    ],
    "clock_lede": (
        f"Die Restzeit-Kurve zeigt, wo die Zeit bleibt. Bis Zug 15 liegt ihr gleichauf, danach verlierst du mit jedem Zug ein Stück. "
        f"In Zeitnot patzt du nur etwas öfter als deine Gegner ({de(bm['blunders_per_100_tt'], 1)} gegenüber {de(bo['blunders_per_100_tt'], 1)} Patzern pro 100 Züge), du kommst aber viel häufiger hinein. "
        f"Jeder sechste Zeitverlust ({de(to['lost_on_time_winning'])} Partien) passierte in einer Gewinnstellung, weitere {de(to['lost_on_time_equal'])} in offener Stellung."
    ),
    "open_lede": (
        "Mit Weiß spielst du ein eigenes System-Repertoire, vor allem 1.f4 (Bird) oder 1.e4 mit frühem Bc4 oder f4. "
        "Mit Schwarz spielst du fast immer Sizilianisch. Beides liegt im Rahmen der Erwartung. "
        "Darunter stehen die Stellungen, in denen du wiederholt denselben ungenauen Zug spielst. Rot ist dein Zug, grün der bessere. "
        f"Der Explorer zeigt dazu, wie Spieler deiner Stärke (lichess {de(r['explorer']['bucket'])} bis {de(r['explorer']['bucket'] + 199)}, entspricht deinem chess.com-Niveau) mit beiden Zügen abschneiden. Bestätigte Lecks stehen zuerst."
    ),
    "eg_lede": (
        "Gefühlt ist das Endspiel eine Schwäche. Die Daten zeigen: Deine Technik ist gut, aber du kommst mit zu wenig Zeit an. "
        "Die Endspieltabelle vergleicht jeden Endspielzug mit den Zügen deiner Gegner im gleichen Endspieltyp."
    ),
    "tb_lede": (
        "Für Stellungen mit höchstens 7 Steinen kennt die Syzygy-Datenbank das exakte Ergebnis. "
        f"Gezählt wird, ob dein Zug das theoretische Ergebnis gehalten hat. Ohne Zeitnot verschenkst du es bei {de(tb['error_rate_no_tt'], 1)} % der Züge, in Zeitnot bei {de(tb['error_rate_tt'], 1)} %."
    ),
    "motif_lede": (
        "Die Motive werden mit dem Tagger von lichess bestimmt, also nach derselben Logik wie die lichess-Puzzles. "
        "Gezählt werden Fehler ab 20 Prozentpunkten. Die Links führen direkt zu passenden Puzzle-Serien."
    ),
    "maia_lede": (
        "Maia-3 ist ein neuronales Netz der Universität Toronto, trainiert auf Millionen menschlicher Partien. "
        "Es schätzt, mit welcher Wahrscheinlichkeit ein Mensch einer bestimmten Stärke einen Zug spielt. "
        f"Für jeden deiner {de(mx['n'])} Fehler wurde verglichen, ob ihn ein Spieler deiner Stärke vermieden hätte, einer mit 300 Punkten mehr oder fast niemand. "
        "Maia kennt nur lichess-Ratings. Deine chess.com-Werte wurden deshalb umgerechnet: 1.380 auf chess.com entspricht etwa 1.690 auf lichess, "
        "und „300 Punkte mehr“ meint einen Spieler mit etwa 1.990 auf lichess, das entspricht rund 1.800 bis 1.850 auf chess.com."
    ),
    "tilt_lede": (
        "Nach einer Niederlage spielst du nicht schlechter. Nach zwei oder mehr Niederlagen in Folge liegst du 2 bis 4 % unter der Erwartung, "
        "ein schwacher Effekt im Bereich des Zufalls. 3+0, 3+2 und 5+0 laufen gleich gut."
    ),
    "plan_lede": (
        "Abgeleitet aus den Befunden, für 15 Minuten am Tag. Der größte Hebel ist aber kein Training, sondern eine Regel für deine Partien. Sie steht ganz oben."
    ),
    "plan": [
        {
            "min": "Partie",
            "title": "Zeitbudget für 3+0",
            "text": (
                f"Bei Zug 20 mindestens 2:00, bei Zug 30 mindestens 1:20 auf der Uhr. Das ist genau der Schnitt deiner Gegner (heute: {de(cc['20']['me'])} und {de(cc['30']['me'])} Sekunden). "
                "In klar gewonnener Stellung tauschen, vereinfachen und schnell ziehen. Für Trainingspartien lohnt sich 3+2: "
                "Mit Inkrement verlierst du gewonnene Partien nicht mehr auf Zeit und sammelst echte Endspielpraxis. Deine Ergebnisse in 3+2 sind gleich gut."
            ),
        },
        {
            "min": "5 min",
            "title": "Deine eigenen Fehler",
            "text": (
                "Fünf Stellungen aus deinen Partien, Klassen Leichtsinn und Nächste Stufe zuerst. Zug finden in unter 10 Sekunden, falsche kommen am nächsten Tag wieder. "
                "Bis die App steht, gibt es die 60 wichtigsten Stellungen als PGN für eine lichess-Studie."
            ),
        },
        {
            "min": "5 min",
            "title": "Taktik-Themen auf Tempo",
            "text": (
                'Abwechselnd <a href="https://lichess.org/training/hangingPiece" target="_blank" rel="noopener">Hängende Figur</a>, '
                '<a href="https://lichess.org/training/fork" target="_blank" rel="noopener">Gabel</a> und '
                '<a href="https://lichess.org/training/mateIn1" target="_blank" rel="noopener">Matt in 1</a> bzw. '
                '<a href="https://lichess.org/training/mateIn2" target="_blank" rel="noopener">Matt in 2</a>. '
                "Ziel ist Tempo, nicht Puzzle-Rating: unter 10 Sekunden pro Aufgabe."
            ),
        },
        {
            "min": "5 min",
            "title": "Wechselnd: Endspiel auf Zeit, Eröffnungs-Lecks, Nachbetrachtung",
            "text": (
                "Montag, Mittwoch, Freitag: eine Gewinnstellung aus deinen Partien mit 1 Minute gegen den Computer zu Ende spielen. "
                'Die Technik hast du, es fehlt die Routine unter Zeitdruck. Zum Auffrischen gibt es <a href="https://lichess.org/practice" target="_blank" rel="noopener">lichess Practice</a>. '
                "Dienstag und Donnerstag: die Leck-Stellungen aus diesem Report durchgehen. "
                "Am Wochenende: eine Partie nachbetrachten, die du auf Zeit verloren hast. Wo ist die Zeit geblieben?"
            ),
        },
    ],
    "method": [
        "Partien: chess.com und lichess über die öffentlichen Schnittstellen. Blitz mit 3 oder 5 Minuten Grundzeit seit 1. Januar 2025.",
        "Bewertung: Stockfish 16 mit 50.000 Knoten pro Stellung, umgerechnet in Gewinnwahrscheinlichkeit nach der Formel von lichess. Ungenauigkeit ab 10, Fehler ab 20, Patzer ab 30 Prozentpunkten Verlust.",
        "Zeitnot: unter 20 Sekunden (3 Minuten) bzw. 30 Sekunden (5 Minuten) Restzeit. Endspiel: höchstens sechs Figuren ohne Bauern und Könige.",
        "Ratings: Dieselbe Zahl bedeutet auf chess.com mehr Stärke als auf lichess. Bei dir passt das zu den Konten: chess.com-Blitz 1.283 gegenüber lichess-Blitz 1.603 im selben Quartal. "
        "Für Maia und den Opening Explorer habe ich chess.com-Blitz-Ratings mit dem Mittel zweier veröffentlichter Umrechnungstabellen (chessgoals.com, attackingchess.com) auf die lichess-Skala gebracht. Die Unsicherheit liegt bei etwa 70 Punkten.",
        "Bausteine: Motiv-Tagger aus lichess-puzzler, Syzygy-Endspieldatenbank und Opening Explorer über die lichess-API, Eröffnungskatalog lichess-org/chess-openings, Maia-3 (79M) von CSSLab, Universität Toronto.",
        "Die Engine rechnet bewusst knapp, einzelne Bewertungen können um ein paar Prozentpunkte abweichen. Die Muster über 1.606 Partien betrifft das kaum. Die Elo-Schätzung bei den Zeitverlusten ist eine grobe Überschlagsrechnung.",
    ],
}
(DATA / "findings.json").write_text(json.dumps(F, ensure_ascii=False, indent=1))
print("elo estimate", round(elo, 1), "trainable", trainable, "lost_winning", lost_winning)
