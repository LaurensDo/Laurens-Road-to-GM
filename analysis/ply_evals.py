"""Bewertung nach jedem Halbzug der Varianten (für den Bewertungsbalken in der Variantenansicht).

Die Übungen kennen die Gewinnchance am Anfang jeder Linie, nicht Zug für Zug. Hier wird für diese Linien jede Stellung nach Halbzug 2, 3, ...
einzeln bewertet, immer als Gewinnchance für den, der in der Übung am Zug ist:
  lines  die beste Linie und alle, die höchstens --equal-wp hinter ihr liegen (also die Linien, die die App als gleichwertig anbietet)
  refs   die Widerlegungen falscher Züge (Zug aus der Partie, wahrscheinliche Fehlzüge)
Halbzug 1 braucht keine neue Rechnung: bei Linien ist es die Gewinnchance der Linie, bei Widerlegungen 100 minus oppWp aus refutations.py.
Beides setzt analysis/build_exercises.py zusammen. Die Zahlen sind flacher gerechnet als die Linienwerte (--nodes), sie zeigen den Verlauf,
nicht den genauen Wert.

Aufruf: python analysis/ply_evals.py --workers 3
Liest app/public/data/exercises.json, schreibt data/ply_evals.jsonl (fortsetzbar).
"""

import argparse
import json
import multiprocessing as mp
import time
from pathlib import Path

import chess
import chess.engine

from all_moves import find_stockfish, to_cp, win_pct

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
EXERCISES = ROOT / "app" / "public" / "data" / "exercises.json"

_engine = None
_cfg = None


def _init(cfg):
    global _engine, _cfg
    _cfg = cfg
    _engine = chess.engine.SimpleEngine.popen_uci(find_stockfish())
    _engine.configure({"Threads": 1, "Hash": 128})


def user_wp(board, user):
    """Gewinnchance des Spielers `user` in der Stellung `board` (Engine-Bewertung, Endstellungen ohne Engine)."""
    if board.is_checkmate():
        return 0.0 if board.turn == user else 100.0
    if board.is_game_over():
        return 50.0
    info = _engine.analyse(board, chess.engine.Limit(nodes=_cfg["nodes"]))
    wp = win_pct(to_cp(info["score"].pov(board.turn)))
    return round(wp if board.turn == user else 100 - wp, 1)


def walk(fen, sans, first_ply):
    """Bewertung nach Halbzug first_ply, first_ply+1, ... (1-basiert) einer SAN-Folge ab fen. None, wenn ein Zug nicht passt."""
    board = chess.Board(fen)
    user = board.turn
    vals = []
    for k, san in enumerate(sans, 1):
        try:
            board.push_san(san)
        except ValueError:
            return None
        if k >= first_ply:
            vals.append(user_wp(board, user))
    return vals


def solve(e):
    t0 = time.time()
    best = e["lines"][0]["wp"]
    out = {"id": e["id"], "lines": {}, "refs": {}}
    for i, line in enumerate(e["lines"]):
        if best - line["wp"] > _cfg["equal_wp"] or len(line["pv"]) < 2:
            continue
        vals = walk(e["fen"], line["pv"], 2)
        if vals is not None:
            out["lines"][str(i)] = vals
    for san, pv in e.get("refs", []):
        if not pv:
            continue
        vals = walk(e["fen"], [san] + pv, 2)
        if vals is not None:
            out["refs"][san] = vals
    out["secs"] = round(time.time() - t0, 1)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--nodes", type=int, default=150_000)
    ap.add_argument("--equal-wp", type=float, default=10.0, help="Linien bis so weit hinter der besten werden bewertet")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--out", default=str(DATA / "ply_evals.jsonl"))
    args = ap.parse_args()

    exercises = json.loads(EXERCISES.read_text())["exercises"]
    if args.limit:
        exercises = exercises[: args.limit]
    out = Path(args.out)
    done = {json.loads(l)["id"] for l in out.open()} if out.exists() else set()
    todo = [e for e in exercises if e["id"] not in done]
    print(f"{len(exercises)} Übungen, {len(done)} fertig, {len(todo)} offen", flush=True)

    cfg = {"nodes": args.nodes, "equal_wp": args.equal_wp}
    t0 = time.time()
    with mp.Pool(args.workers, initializer=_init, initargs=(cfg,)) as pool, out.open("a") as f:
        for i, res in enumerate(pool.imap(solve, todo, chunksize=1), 1):
            f.write(json.dumps(res, ensure_ascii=False) + "\n")
            f.flush()
            if i % 25 == 0:
                rate = i / (time.time() - t0)
                print(f"{i}/{len(todo)}  ({rate * 60:.1f}/min, noch ca. {(len(todo) - i) / rate / 60:.0f} min)", flush=True)
    print("fertig", flush=True)


if __name__ == "__main__":
    main()
