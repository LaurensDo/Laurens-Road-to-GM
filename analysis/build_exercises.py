"""Baut die Übungsdaten für die App.

Aufruf:
    python analysis/build_exercises.py

Liest  data/training_positions.json, data/solutions.jsonl, data/report.json
Schreibt app/public/data/exercises.json und app/public/data/meta.json

Pro Übung wird, wenn die Rohpartie vorliegt, der letzte Zug des Gegners mit dem Brett davor mitgegeben (prev),
damit die App ihn vor der Aufgabe zeigen kann.

Qualitätstor: Eine Stellung wird nur Übung, wenn die tiefe Suche den Fehler bestätigt
(dein Zug mindestens 15 Prozentpunkte unter dem besten) und die Stellung nicht schon
verloren ist (bester Zug mindestens 15 % Gewinnchance).
"""

import hashlib
import json
import re
from pathlib import Path

import chess

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "app" / "public" / "data"

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


def main():
    positions = {key_of(p): p for p in json.loads((DATA / "training_positions.json").read_text())}
    report = json.loads((DATA / "report.json").read_text())

    games = load_moves()
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
        exercises.append({
            "id": ex_id(s["key"]),
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
            "maia": {"me": p.get("p_best_me"), "up": p.get("p_best_up"), "cls": p.get("maia_class")},
            **({"prev": prev} if prev else {}),
        })
    exercises.sort(key=lambda e: -e["loss"])

    OUT.mkdir(parents=True, exist_ok=True)
    gen = report["generated"]
    (OUT / "exercises.json").write_text(json.dumps({"version": 1, "generated": gen, "exercises": exercises},
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
    print(f"{len(exercises)} Übungen ({size // 1024} KB), verworfen: {dropped}, ohne letzten Zug: {no_prev}")


if __name__ == "__main__":
    main()
