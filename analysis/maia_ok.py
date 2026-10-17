"""Maia-3: volle Zugverteilung je Übung (für "Richtwert für Spieler deiner Stärke").

Der bisherige Richtwert (p_best_me) zählt nur den einen besten Zug. Die App wertet aber jeden Zug bis 10 Prozentpunkte hinter dem
besten als richtig. Damit der Richtwert zur Wertung passt, speichert dieses Skript die ganze Verteilung über alle legalen Züge,
einmal für deine Stärke und einmal für +300 Elo. build_exercises.py rechnet daraus mit den Bewertungen aus all_moves.py
die Wahrscheinlichkeit, dass ein Spieler deiner Stärke einen als richtig gewerteten Zug findet (maia.ok).

Aufruf: python analysis/maia_ok.py [--model 79m]
Liest app/public/data/exercises.json und data/games_raw.jsonl, schreibt data/maia_dist.jsonl (fortsetzbar).
"""

import argparse
import json
from pathlib import Path

import chess

from maia_difficulty import Maia
from ratings import to_lichess_scale

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
EXERCISES = ROOT / "app" / "public" / "data" / "exercises.json"
MIN_P = 0.001


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="79m")
    ap.add_argument("--step", type=int, default=300)
    args = ap.parse_args()

    raw = {}
    for line in (DATA / "games_raw.jsonl").open():
        g = json.loads(line)
        raw[g["url"]] = g
    exercises = json.loads(EXERCISES.read_text())["exercises"]
    out = DATA / "maia_dist.jsonl"
    done = {json.loads(l)["id"] for l in out.open()} if out.exists() else set()

    maia = Maia(args.model)
    n = 0
    with out.open("a") as f:
        for e in exercises:
            if e["id"] in done:
                continue
            g = raw.get(e["url"])
            if not g:
                continue
            board = chess.Board()
            prefix = []
            for uci, _ in g["moves"]:
                if board.fen() == e["fen"]:
                    break
                prefix.append(uci)
                board.push_uci(uci)
            if board.fen() != e["fen"]:
                continue
            maia.set_game(prefix)
            me = to_lichess_scale(g["platform"], g["my_rating"]) or 1500
            opp = to_lichess_scale(g["platform"], g["opp_rating"]) or me
            low, high = maia.move_probs([me, me + args.step], opp)
            keep = lambda d: {u: round(p, 4) for u, p in d.items() if p >= MIN_P}
            f.write(json.dumps({"id": e["id"], "elo": me, "me": keep(low), "up": keep(high)}) + "\n")
            n += 1
            if n % 100 == 0:
                print(f"{n}", flush=True)
                f.flush()
    print("fertig", flush=True)


if __name__ == "__main__":
    main()
