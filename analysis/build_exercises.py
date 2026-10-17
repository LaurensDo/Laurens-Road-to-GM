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


def main():
    positions = {key_of(p): p for p in json.loads((DATA / "training_positions.json").read_text())}
    report = json.loads((DATA / "report.json").read_text())

    games = load_moves()
    holdout = set(json.loads(HOLDOUT.read_text())) if HOLDOUT.exists() else set()
    all_moves = load_jsonl(DATA / "all_moves.jsonl")
    maia_dist = load_jsonl(DATA / "maia_dist.jsonl")
    refutations = load_jsonl(DATA / "refutations.jsonl")
    exercises, dropped = [], {"kein_fehler": 0, "verloren": 0, "ohne_lösung": 0}
    no_prev = 0
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
        rf = refutations.get(eid)
        am = all_moves.get(eid)
        md = maia_dist.get(eid)
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
            "lines": [{"san": l["san"], "uci": l["uci"], "wp": l["wp"], "cp": l["cp"], "pv": pv_list(l["pv"])} for l in lines],
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
            **({"refs": [[r["san"], r["pv"]] for r in rf["refs"]]} if rf and rf.get("refs") else {}),
            **({"missed": [m for m in p.get("missed_motifs", []) if m not in GENERIC]} if p.get("missed_motifs") else {}),
            **({"prev": prev} if prev else {}),
            **({"hold": True} if ex_id(s["key"]) in holdout else {}),
        })
    exercises = order_by_priority(exercises)

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
    print(f"{len(exercises)} Übungen ({size // 1024} KB), davon {held} im Prüfsatz, verworfen: {dropped}, ohne letzten Zug: {no_prev}")
    if held != len(holdout):
        print(f"Achtung: {len(holdout)} IDs in holdout_ids.json, aber {held} gefunden")


if __name__ == "__main__":
    main()
