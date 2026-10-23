"""Baut die Übungsdaten für die App.

Aufruf:
    python analysis/build_exercises.py

Liest  data/training_positions.json, data/solutions.jsonl, data/report.json
       data/all_moves.jsonl (analysis/all_moves.py), data/maia_dist.jsonl (analysis/maia_ok.py),
       data/refutations.jsonl (analysis/refutations.py), analysis/holdout_ids.json
Schreibt app/public/data/exercises.json und app/public/data/meta.json

Pro Übung wird, wenn die Rohpartie vorliegt, der letzte Zug des Gegners mit dem Brett davor mitgegeben (prev),
damit die App ihn vor der Aufgabe zeigen kann.

Datenstand 2: Zu jeder Übung stehen alle Züge, die höchstens 40 Punkte hinter dem besten liegen (more, SAN und Gewinnchance), und
die Maia-Wahrscheinlichkeit, dass ein Spieler deiner Stärke einen als richtig gewerteten Zug findet (maia.ok, maia.ok0 für "nur der
beste"). Die Reihenfolge der Datei ist die Reihenfolge, in der neue Übungen drankommen (siehe order_by_priority).

Qualitätstor: Eine Stellung wird nur Übung, wenn die tiefe Suche den Fehler bestätigt
(dein Zug mindestens 15 Prozentpunkte unter dem besten) und die Stellung nicht schon
verloren ist (bester Zug mindestens 15 % Gewinnchance).
"""

import datetime as dt
import hashlib
import json
import os
import re
from pathlib import Path

import chess

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = Path(os.environ["ROAD_OUT"]) if os.environ.get("ROAD_OUT") else ROOT / "app" / "public" / "data"  # ROAD_OUT: Probelauf in einen anderen Ordner
HOLDOUT = Path(__file__).resolve().parent / "holdout_ids.json"
_TODAY = dt.date(2026, 10, 15)  # Stichtag der Diagnose: macht die Reihenfolge reproduzierbar
# Datenstand: erhöhen, wenn sich Bewertungen oder Lösungen ändern (steht an jeder Antwort in der App, um sie später einzuordnen)
DATA_VERSION = 2

TOLERANCE_WP = 10.0   # wie in app/src/lib/judge.ts
SAME_WP = 0.5

MIN_LOSS = 15.0      # Prozentpunkte, tiefe Suche
MIN_BEST_WP = 15.0   # bester Zug muss noch eine Chance haben
GENERIC = {"Verteidigungszug", "Stiller Zug", "Vorgerückter Bauer", "Ungeschützter König", "Königsangriff"}


def key_of(p):
    return f"{p['url']}|{p['fen']}"


def ex_id(key):
    return hashlib.sha1(key.encode()).hexdigest()[:8]


def pv_list(variation):
    """'20...Nb5 21. axb4 Rhg8' -> ['Nb5', 'axb4', 'Rhg8']"""
    out = []
    for tok in (variation or "").split():
        san = re.sub(r"^\d+\.+", "", tok)
        if san:
            out.append(san)
    return out


def platform_of(url):
    return "lichess" if "lichess.org" in url else "chess.com"


def load_moves():
    """url -> Zugliste (UCI) aus den Rohpartien. Fehlt die Datei, gibt es keinen letzten Zug in der App."""
    path = DATA / "games_raw.jsonl"
    if not path.exists():
        return {}
    out = {}
    with path.open() as f:
        for line in f:
            g = json.loads(line)
            out[g["url"]] = [m[0] for m in g["moves"]]
    return out


def last_move(moves, fen):
    """Letzter Zug vor der Stellung `fen` (Zug des Gegners): Brett davor, UCI und SAN. None, wenn nicht ermittelbar."""
    board = chess.Board()
    prev = None  # (Brett vor dem Zug, Zug)
    for uci in moves:
        if board.fen() == fen:
            if prev is None:
                return None  # Stellung vor dem ersten Zug der Partie
            before, mv = prev
            return {"board": before.board_fen(), "uci": mv.uci(), "san": before.san(mv)}
        mv = chess.Move.from_uci(uci)
        if mv not in board.legal_moves:
            return None
        prev = (board.copy(), mv)
        board.push(mv)
    return None


def load_jsonl(path):
    return {r["id"]: r for r in map(json.loads, path.open())} if path.exists() else {}


def maia_ok(dist, lines, more):
    """Wahrscheinlichkeit, dass ein Mensch einen als richtig gewerteten Zug spielt (Summe über alle Züge mit kleinem Verlust)."""
    wp = {l["uci"]: l["wp"] for l in lines}
    wp.update({m["uci"]: m["wp"] for m in more})
    best = lines[0]["wp"]
    ok = sum(p for u, p in dist.items() if u in wp and best - wp[u] <= TOLERANCE_WP)
    ok0 = sum(p for u, p in dist.items() if u in wp and best - wp[u] <= SAME_WP)
    return round(min(ok, 1.0), 4), round(min(ok0, 1.0), 4)


def fullmove(fen):
    try:
        return int(fen.split()[5])
    except (IndexError, ValueError):
        return 0


def priority(e):
    """Je höher, desto früher kommt eine neue Übung dran. Zeitnot-Stellungen bekommen bewusst keinen Bonus: Die Uhr trainiert die App
    anders (nicht mit Stellungen, in denen schon alles zu spät war)."""
    days = (_TODAY - dt.date.fromisoformat(e["date"])).days
    recency = max(0.0, 1.0 - days / 400.0)
    score = 3.0 * recency
    score += 2.0 if e["maia"]["cls"] == "Leichtsinn" else 0.0
    score += 2.0 if ("Hängende Figur" in e["motifs"] or "Gabel" in e["motifs"]) else 0.0
    score += 1.5 if (e["phase"] == "Mittelspiel" and 15 <= fullmove(e["fen"]) <= 35) else 0.0
    score += min(e["loss"], 60) / 60.0  # grobe Fehler etwas früher
    return score


def order_by_priority(exercises):
    """Reihenfolge nach Priorität, mit Regeln je Block von 10: höchstens 1 "Gegnerfehler nicht bestraft", höchstens 2 "Positioneller
    Fehler" ohne Motiv, mindestens 3 der Maia-Klasse "Nächste Stufe". So bleibt die Mischung abwechslungsreich und fordernd."""
    left = sorted(exercises, key=lambda e: (-priority(e), e["id"]))
    out = []
    while left:
        block, c_opp, c_pos, c_next = [], 0, 0, 0
        while left and len(block) < 10:
            slots_left = 10 - len(block)
            need_next = max(0, 3 - c_next)
            pick = None
            for e in left:
                if e["cat"] == "Gegnerfehler nicht bestraft" and c_opp >= 1:
                    continue
                if e["cat"] == "Positioneller Fehler" and not e["motifs"] and c_pos >= 2:
                    continue
                if need_next >= slots_left and e["maia"]["cls"] != "Nächste Stufe":
                    continue
                pick = e
                break
            if pick is None:  # Regeln nicht mehr erfüllbar (Vorrat fast leer): einfach der Reihe nach
                pick = left[0]
            left.remove(pick)
            block.append(pick)
            c_opp += pick["cat"] == "Gegnerfehler nicht bestraft"
            c_pos += pick["cat"] == "Positioneller Fehler" and not pick["motifs"]
            c_next += pick["maia"]["cls"] == "Nächste Stufe"
        out += block
    return out


WIN_SAFE = 80.0  # "Sicher gewinnen": Züge mit mindestens so viel Gewinnchance gelten als sicher
WIN_LIMIT = 5  # Zielzeit in Sekunden


def load_dates():
    """url -> Datum der Partie (YYYY-MM-DD) aus den Rohpartien."""
    path = DATA / "games_raw.jsonl"
    out = {}
    if path.exists():
        with path.open() as f:
            for line in f:
                g = json.loads(line)
                out[g["url"]] = dt.datetime.fromtimestamp(g["end_ts"], dt.timezone.utc).strftime("%Y-%m-%d")
    return out


def win_exercises(taken):
    """Übungen "Sicher gewinnen" aus analysis/win_positions.py (data/win_positions.jsonl). Stellungen, die schon eine Fehler-Übung sind, entfallen."""
    path = DATA / "win_positions.jsonl"
    if not path.exists():
        return []
    dates = load_dates()
    out = []
    for line in path.open():
        r = json.loads(line)
        if r.get("skip") or "key" not in r:
            continue
        eid = ex_id(r["key"])
        if eid in taken or r["url"] not in dates:
            continue
        best = r["lines"][0]
        played = r["played"]
        out.append({
            "id": eid, "fen": r["fen"], "turn": r["turn"], "phase": "Eröffnung" if r["phase"] != "Endspiel" and fullmove(r["fen"]) <= 12 else r["phase"],
            "cat": "Sicher gewinnen", "motifs": [], "themes": [],
            "lines": [{"san": l["san"], "uci": l["uci"], "wp": l["wp"], "cp": l["cp"], "pv": l["pv"]} for l in r["lines"]],
            "played": {"san": played["san"], "uci": played["uci"], "wp": played["wp"], "cp": played["cp"]},
            "loss": round(max(0.0, best["wp"] - played["wp"]), 1),
            "clock": round(r["clock"]), "spent": round(r["spent"], 1), "date": dates[r["url"]], "url": r["url"], "src": platform_of(r["url"]),
            "maia": {"me": None, "up": None, "cls": None},
            "more": r["more"],
            "prev": r["prev"],
            "win": {"safe": WIN_SAFE, "limit": WIN_LIMIT},
        })
    return out


def endgame_exercises(taken):
    """Übungen "Endspiel" aus analysis/endgame_positions.py (data/endgame_positions.jsonl): exakt bewertete Stellungen mit höchstens 7 Steinen."""
    path = DATA / "endgame_positions.jsonl"
    if not path.exists():
        return []
    dates = load_dates()
    out = []
    for line in path.open():
        r = json.loads(line)
        eid = ex_id(r["key"])
        if eid in taken or r["url"] not in dates:
            continue
        taken.add(eid)
        best = r["lines"][0]
        out.append({
            "id": eid, "fen": r["fen"], "turn": r["turn"], "phase": "Endspiel", "cat": "Endspiel", "motifs": [], "themes": [],
            "lines": r["lines"],
            "played": r["played"],
            "loss": round(max(0.0, best["wp"] - r["played"]["wp"]), 1),
            "clock": round(r["clock"] or 0), "spent": r["spent"], "date": dates[r["url"]], "url": r["url"], "src": platform_of(r["url"]),
            "maia": {"me": None, "up": None, "cls": None},
            "prev": r["prev"],
            "tb": r["tb"],
            **({"refs": r["refs"]} if r.get("refs") else {}),
        })
    return out


STALE = {"n": 0}  # Bewertungen je Halbzug, die nicht mehr zu den Linien passen


def line_out(i, l, pe):
    """Linie mit Gewinnchance nach jedem Halbzug (ev), wenn sie in analysis/ply_evals.py bewertet wurde: Halbzug 1 ist die Gewinnchance der Linie."""
    out = {"san": l["san"], "uci": l["uci"], "wp": l["wp"], "cp": l["cp"], "pv": pv_list(l["pv"])}
    vals = pe["lines"].get(str(i))
    if vals is not None and len(vals) == len(out["pv"]) - 1:
        out["ev"] = [l["wp"]] + vals
    elif vals is not None:
        STALE["n"] += 1  # Länge passt nicht: die Linien haben sich seit ply_evals.py geändert
    return out


def ref_out(r, pe):
    """Widerlegung [Zug, Folgezüge, Gewinnchance nach jedem Halbzug]: Halbzug 1 ist 100 minus die Gewinnchance des Gegners nach dem Zug."""
    vals = pe["refs"].get(r["san"])
    if vals is not None and r.get("oppWp") is not None and len(vals) == len(r["pv"]):
        return [r["san"], r["pv"], [round(100 - r["oppWp"], 1)] + vals]
    if vals is not None:
        STALE["n"] += 1
    return [r["san"], r["pv"]]


def main():
    positions = {key_of(p): p for p in json.loads((DATA / "training_positions.json").read_text())}
    report = json.loads((DATA / "report.json").read_text())

    games = load_moves()
    holdout = set(json.loads(HOLDOUT.read_text())) if HOLDOUT.exists() else set()
    all_moves = load_jsonl(DATA / "all_moves.jsonl")
    maia_dist = load_jsonl(DATA / "maia_dist.jsonl")
    refutations = load_jsonl(DATA / "refutations.jsonl")
    ply_evals = load_jsonl(DATA / "ply_evals.jsonl") if (DATA / "ply_evals.jsonl").exists() else {}
    exercises, dropped = [], {"kein_fehler": 0, "verloren": 0, "ohne_lösung": 0, "tablebase_kein_fehler": 0, "als_endspiel": 0}
    no_prev = 0
    # Endspiele mit höchstens 7 Steinen kennt die Tablebase exakt: Ihre Übung ersetzt die Stockfish-Übung derselben Stellung (außer im Prüfsatz,
    # der bleibt fest), und ein Partiezug, der laut Tablebase das Ergebnis hält, ist kein Fehler
    ends = endgame_exercises(set(holdout))
    end_ids = {e["id"] for e in ends}
    tb_path = DATA / "tablebase.jsonl"
    tb_rows = {(r["fen"], r["uci"]): r for r in map(json.loads, tb_path.open())} if tb_path.exists() else {}
    for line in (DATA / "solutions.jsonl").open():
        s = json.loads(line)
        p = positions.get(s["key"])
        if not p or not s["lines"]:
            dropped["ohne_lösung"] += 1
            continue
        lines = s["lines"]
        best = lines[0]
        played = s.get("played")
        if not played:
            dropped["ohne_lösung"] += 1
            continue
        loss = best["wp"] - played["wp"]
        if loss < MIN_LOSS:
            dropped["kein_fehler"] += 1
            continue
        if best["wp"] < MIN_BEST_WP:
            dropped["verloren"] += 1
            continue
        white = " w " in p["fen"]
        prev = last_move(games[p["url"]], p["fen"]) if p["url"] in games else None
        if prev is None:
            no_prev += 1
        eid = ex_id(s["key"])
        if eid in end_ids:
            dropped["als_endspiel"] += 1
            continue
        tbr = tb_rows.get((p["fen"], played["uci"]))
        if tbr and tbr["before"] == tbr["after"] and eid not in holdout:
            dropped["tablebase_kein_fehler"] += 1
            continue
        rf = refutations.get(eid)
        am = all_moves.get(eid)
        md = maia_dist.get(eid)
        pe = ply_evals.get(eid) or {"lines": {}, "refs": {}}
        maia = {"me": p.get("p_best_me"), "up": p.get("p_best_up"), "cls": p.get("maia_class")}
        if md and am:
            maia["ok"], maia["ok0"] = maia_ok(md["me"], lines, am["more"])
            maia["okUp"] = maia_ok(md["up"], lines, am["more"])[0]
        exercises.append({
            "id": eid,
            "fen": p["fen"],
            "turn": "w" if white else "b",
            "phase": p["phase"],
            "cat": p["cat"],
            "motifs": [m for m in p.get("motifs", []) if m not in GENERIC],
            "themes": p.get("themes", []),
            "lines": [line_out(i, l, pe) for i, l in enumerate(lines)],
            "played": {"san": played["san"], "uci": played["uci"], "wp": played["wp"], "cp": played["cp"]},
            "loss": round(loss, 1),
            "clock": round(p["clock"]),
            "spent": round(p["spent"], 1) if p.get("spent") is not None else None,
            "date": p["date"],
            "url": p["url"],
            "src": platform_of(p["url"]),
            "maia": maia,
            **({"more": [[m["san"], m["wp"]] for m in am["more"]]} if am else {}),
            # Drohung nur, wenn der Zug etwas Greifbares tut (Schlagen, Schach, Matt): Stille Züge als "Drohung" wären Rauschen
            **({"threat": rf["threat"]} if rf and rf.get("threat") and re.search(r"[x+#]", rf["threat"]["san"]) else {}),
            **({"refs": [ref_out(r, pe) for r in rf["refs"]]} if rf and rf.get("refs") else {}),
            **({"missed": [m for m in p.get("missed_motifs", []) if m not in GENERIC]} if p.get("missed_motifs") else {}),
            **({"prev": prev} if prev else {}),
            **({"hold": True} if ex_id(s["key"]) in holdout else {}),
        })
    exercises = order_by_priority(exercises)
    wins = win_exercises({e["id"] for e in exercises} | end_ids)
    exercises = exercises + wins + ends  # eigene Modi in der App ("Sicher gewinnen", "Endspiel")
    # Warum der beste Zug richtig ist (analysis/why.py, rechnet auf der fertigen Datei: nach neuen Übungen why.py und diesen Build noch einmal)
    why = load_jsonl(DATA / "why.jsonl")
    for e in exercises:
        w = why.get(e["id"])
        if w and (w["tags"] or w["gain"] or w["against"]):
            e["why"] = {"tags": w["tags"], "gain": w["gain"], "against": w["against"]}

    OUT.mkdir(parents=True, exist_ok=True)
    gen = report["generated"]
    (OUT / "exercises.json").write_text(json.dumps({"version": DATA_VERSION, "generated": gen, "exercises": exercises},
                                                   ensure_ascii=False, separators=(",", ":")))

    bm, bo = report["benchmark"]["me"], report["benchmark"]["opp"]
    cc = report["clock_curve_3_0"]
    to = report["timeouts"]
    mot = {m["key"]: m for m in report["motifs_against_me"]}
    meta = {
        "version": 1,
        "generated": gen,
        "games": report["n_games"],
        "period": report["period"],
        "baseline": {
            "lost_on_time": to["lost_on_time"],
            "losses": to["losses"],
            "lost_on_time_not_losing": to["lost_on_time_winning"] + to["lost_on_time_equal"],
            "clock_move20": cc["20"]["me"], "clock_move20_opp": cc["20"]["opp"],
            "clock_move30": cc["30"]["me"], "clock_move30_opp": cc["30"]["opp"],
            "hanging_per_100": mot["hangingPiece"]["me"], "hanging_per_100_opp": mot["hangingPiece"]["opp"],
            "fork_per_100": mot["fork"]["me"], "fork_per_100_opp": mot["fork"]["opp"],
            "blunders_middlegame": bm["blunders_per_100_Mittelspiel"],
            "blunders_middlegame_opp": bo["blunders_per_100_Mittelspiel"],
        },
        "counts": {
            "exercises": len(exercises),
            "by_phase": {ph: sum(1 for e in exercises if e["phase"] == ph) for ph in ("Eröffnung", "Mittelspiel", "Endspiel")},
        },
    }
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    size = (OUT / "exercises.json").stat().st_size
    held = sum(1 for e in exercises if e.get("hold"))
    if STALE["n"]:
        print(f"Achtung: {STALE['n']} Bewertungen je Halbzug passen nicht mehr zu den Linien. data/ply_evals.jsonl löschen und analysis/ply_evals.py neu laufen lassen.")
    print(f"davon {len(wins)} \"Sicher gewinnen\" und {len(ends)} \"Endspiel\"")
    print(f"{len(exercises)} Übungen ({size // 1024} KB), davon {held} im Prüfsatz, verworfen: {dropped}, ohne letzten Zug: {no_prev}")
    if held != len(holdout):
        print(f"Achtung: {len(holdout)} IDs in holdout_ids.json, aber {held} gefunden")


if __name__ == "__main__":
    main()
