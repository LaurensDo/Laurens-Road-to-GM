"""Drohung und Widerlegungen je Übung (für die Ergebnisanzeige).

Zwei Dinge, beides offline mit Stockfish:
  threat  Was droht der Gegner in dieser Stellung, wenn man nichts tut? (Nullzug: Der Gegner ist am Zug, sein bester Zug.)
          Wird nur gespeichert, wenn die Drohung wirklich etwas ausmacht (--min-gain Prozentpunkte) und man nicht im Schach steht.
  refs    Wie wird ein falscher Zug widerlegt? Für den Zug aus der Partie und für die (bis zu zwei) Fehlzüge, die ein Spieler deiner
          Stärke laut Maia am ehesten spielt: die beste Antwort des Gegners mit den folgenden Zügen (bis --plies Halbzüge).
          Damit zeigt die App nach einem Fehler, was passiert wäre, auch wenn er nicht aus der Partie stammt.

Aufruf: python analysis/refutations.py --workers 3
Liest app/public/data/exercises.json, data/all_moves.jsonl, data/maia_dist.jsonl. Schreibt data/refutations.jsonl (fortsetzbar).
"""

import argparse
import json
import multiprocessing as mp
import time
from pathlib import Path

import chess
import chess.engine

from all_moves import find_stockfish, key_of, to_cp, win_pct  # noqa: F401

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
EXERCISES = ROOT / "app" / "public" / "data" / "exercises.json"
TOLERANCE_WP = 10.0

_engine = None
_cfg = None


def _init(cfg):
    global _engine, _cfg
    _cfg = cfg
    _engine = chess.engine.SimpleEngine.popen_uci(find_stockfish())
    _engine.configure({"Threads": 1, "Hash": 256})


def line_after(board, mv, plies):
    """Beste Antwort auf einen Zug: (SAN-Folge, Gewinnchance des Zugenden nach seinem Zug)."""
    b = board.copy()
    b.push(mv)
    if b.is_game_over():
        return [], None
    info = _engine.analyse(b, chess.engine.Limit(nodes=_cfg["nodes"]))
    pv = info.get("pv", [])[:plies]
    if not pv:
        return [], None
    sans = []
    c = b.copy()
    for m in pv:
        sans.append(c.san(m))
        c.push(m)
    opp_wp = round(win_pct(to_cp(info["score"].pov(b.turn))), 1)
    return sans, opp_wp


def solve(task):
    e, dist = task
    t0 = time.time()
    board = chess.Board(e["fen"])
    best_wp = e["lines"][0]["wp"]
    out = {"id": e["id"]}

    # Drohung: Nullzug
    if not board.is_check():
        nb = board.copy()
        nb.push(chess.Move.null())
        info = _engine.analyse(nb, chess.engine.Limit(nodes=_cfg["nodes"]))
        pv = info.get("pv", [])
        if pv:
            opp_wp = win_pct(to_cp(info["score"].pov(nb.turn)))
            gain = opp_wp - (100 - best_wp)
            if gain >= _cfg["min_gain"]:
                out["threat"] = {"uci": pv[0].uci(), "san": nb.san(pv[0]), "gain": round(gain, 1)}

    # Widerlegungen: Zug aus der Partie plus die wahrscheinlichsten Fehlzüge
    wp = {l["uci"]: l["wp"] for l in e["lines"]}
    wp.update({m["uci"]: m["wp"] for m in e.get("_more", [])})
    wrong = lambda u: u not in wp or best_wp - wp[u] > TOLERANCE_WP
    cands = [e["played"]["uci"]]
    for u, p in sorted(dist.items(), key=lambda kv: -kv[1]):
        if len(cands) >= 3 or p < _cfg["min_p"]:
            break
        if u not in cands and wrong(u):
            cands.append(u)
    refs = []
    for u in cands:
        mv = chess.Move.from_uci(u)
        if mv not in board.legal_moves:
            continue
        san = board.san(mv)
        pv, opp_wp = line_after(board, mv, _cfg["plies"])
        if pv:
            refs.append({"san": san, "pv": pv, "oppWp": opp_wp})
    out["refs"] = refs
    out["secs"] = round(time.time() - t0, 1)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--nodes", type=int, default=700_000)
    ap.add_argument("--plies", type=int, default=4)
    ap.add_argument("--min-gain", type=float, default=20.0)
    ap.add_argument("--min-p", type=float, default=0.08)
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    exercises = json.loads(EXERCISES.read_text())["exercises"]
    more = {r["id"]: r["more"] for r in map(json.loads, (DATA / "all_moves.jsonl").open())}
    dist = {r["id"]: r["me"] for r in map(json.loads, (DATA / "maia_dist.jsonl").open())}
    tasks = []
    for e in exercises:
        e["_more"] = more.get(e["id"], [])
        tasks.append((e, dist.get(e["id"], {})))
    if args.limit:
        tasks = tasks[: args.limit]
    out = DATA / "refutations.jsonl"
    done = {json.loads(l)["id"] for l in out.open()} if out.exists() else set()
    todo = [t for t in tasks if t[0]["id"] not in done]
    print(f"{len(tasks)} Übungen, {len(done)} fertig, {len(todo)} offen", flush=True)

    cfg = {"nodes": args.nodes, "plies": args.plies, "min_gain": args.min_gain, "min_p": args.min_p}
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
