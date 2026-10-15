"""Berechnet die Lösungen der Übungen mit tiefer Stockfish-Suche.

Aufruf:
    python analysis/solutions.py --nodes 3000000 --workers 3

Für jede trainierbare Fehlerstellung (Maia-Klasse "Leichtsinn" oder "Nächste Stufe"):
  - die 5 besten Züge mit Bewertung und Gewinnchance (MultiPV, tiefe Suche)
  - dein damaliger Zug mit derselben Bewertung (eigene Suche mit root_moves)

Die App zählt einen Zug als richtig, wenn er unter den 5 besten liegt und höchstens
10 Prozentpunkte Gewinnchance unter dem besten.

Reihenfolge: wichtigste Fehler zuerst (größter Verlust), fortsetzbar.
Schreibt data/solutions.jsonl.
"""

import argparse
import json
import math
import multiprocessing as mp
import shutil
import time
from pathlib import Path

import chess
import chess.engine

DATA = Path(__file__).resolve().parent.parent / "data"
MATE = 10000
_engine = None
_nodes = None
_nodes_played = None


def find_stockfish():
    for p in ("stockfish", "/usr/games/stockfish", "/usr/local/bin/stockfish"):
        if shutil.which(p) or Path(p).exists():
            return shutil.which(p) or p
    raise SystemExit("Stockfish nicht gefunden")


def to_cp(score):
    if score.is_mate():
        m = score.mate()
        return MATE - abs(m) if m > 0 else -(MATE - abs(m))
    return score.score()


def win_pct(cp):
    if abs(cp) >= MATE - 100:
        return 100.0 if cp > 0 else 0.0
    cp = max(-1000, min(1000, cp))
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


def key_of(p):
    return f"{p['url']}|{p['fen']}"


def _init(nodes, nodes_played):
    global _engine, _nodes, _nodes_played
    _engine = chess.engine.SimpleEngine.popen_uci(find_stockfish())
    _engine.configure({"Threads": 1, "Hash": 256})
    _nodes, _nodes_played = nodes, nodes_played


def solve(p):
    t0 = time.time()
    board = chess.Board(p["fen"])
    infos = _engine.analyse(board, chess.engine.Limit(nodes=_nodes), multipv=5)
    lines = []
    for info in infos:
        pv = info.get("pv", [])
        if not pv:
            continue
        cp = to_cp(info["score"].pov(board.turn))
        lines.append({
            "uci": pv[0].uci(),
            "san": board.san(pv[0]),
            "cp": cp,
            "wp": round(win_pct(cp), 1),
            "pv": board.variation_san(pv[:8]),
            "depth": info.get("depth"),
        })
    played = None
    try:
        mv = chess.Move.from_uci(p["played_uci"])
        hit = next((l for l in lines if l["uci"] == mv.uci()), None)
        if hit:
            played = {"uci": hit["uci"], "san": hit["san"], "cp": hit["cp"], "wp": hit["wp"]}
        elif mv in board.legal_moves:
            info = _engine.analyse(board, chess.engine.Limit(nodes=_nodes_played), root_moves=[mv])
            cp = to_cp(info["score"].pov(board.turn))
            played = {"uci": mv.uci(), "san": board.san(mv), "cp": cp, "wp": round(win_pct(cp), 1)}
    except (ValueError, KeyError):
        pass
    return {"key": key_of(p), "fen": p["fen"], "lines": lines, "played": played,
            "nodes": _nodes, "secs": round(time.time() - t0, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--nodes", type=int, default=3_000_000)
    ap.add_argument("--nodes-played", type=int, default=1_000_000)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    positions = json.loads((DATA / "training_positions.json").read_text())
    trainable = [p for p in positions if p.get("maia_class") in ("Leichtsinn", "Nächste Stufe")
                 and p.get("played_uci") and p.get("fen")]
    trainable.sort(key=lambda p: -p["loss"])
    if args.limit:
        trainable = trainable[: args.limit]

    out = DATA / "solutions.jsonl"
    done = set()
    if out.exists():
        done = {json.loads(l)["key"] for l in out.open()}
    todo = [p for p in trainable if key_of(p) not in done]
    print(f"{len(trainable)} trainierbare Stellungen, {len(done)} fertig, {len(todo)} offen", flush=True)

    t0 = time.time()
    with mp.Pool(args.workers, initializer=_init, initargs=(args.nodes, args.nodes_played)) as pool, out.open("a") as f:
        for i, res in enumerate(pool.imap(solve, todo, chunksize=1), 1):
            f.write(json.dumps(res, ensure_ascii=False) + "\n")
            f.flush()
            if i % 25 == 0:
                rate = i / (time.time() - t0)
                print(f"{i}/{len(todo)}  ({rate * 60:.1f}/min, noch ca. {(len(todo) - i) / rate / 60:.0f} min)", flush=True)
    print("fertig", flush=True)


if __name__ == "__main__":
    main()
