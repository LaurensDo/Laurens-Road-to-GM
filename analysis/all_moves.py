"""Bewertet für jede Übung ALLE legalen Züge, nicht nur die fünf besten.

Warum: Die App wertet einen Zug als richtig, wenn er höchstens 10 Prozentpunkte unter dem besten liegt. Kannte die Datei nur die fünf
besten Züge, wurden in Stellungen mit vielen gleich guten Zügen (240 von 1.200) gute Züge als falsch gewertet. Jetzt kennt die App
jeden Zug, der nicht viel schlechter ist.

Zwei Stufen, damit es in vertretbarer Zeit läuft:
  1. Schnelle Prüfung jedes Zuges außerhalb der Top 5 (--screen-nodes, eigene Suche mit root_moves).
  2. Alles, was dabei nahe genug am besten Zug liegt, wird genauer nachgerechnet (--nodes). Nur diese Werte entscheiden über
     "richtig". Die Top 5 wurden mit 3 Mio. Knoten für fünf Linien gleichzeitig gerechnet (MultiPV), jede Linie bekam also etwa
     600.000 Knoten. Eine Einzelsuche mit 700.000 Knoten ist damit vergleichbar tief.

Übersprungen wird eine Übung, wenn schon die fünfte der Top-5-Linien weit hinter dem besten Zug liegt: Alle übrigen Züge liegen
nach der Logik von MultiPV nicht besser als die fünfte, sind also sicher falsch.

Aufruf: python analysis/all_moves.py --workers 3
Liest app/public/data/exercises.json und data/solutions.jsonl, schreibt data/all_moves.jsonl (fortsetzbar).
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

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
EXERCISES = ROOT / "app" / "public" / "data" / "exercises.json"
MATE = 10000
KEEP_MARGIN = 40.0  # Züge, die weiter als so viele Punkte hinter dem besten liegen, werden nicht gespeichert (sicher falsch)

_engine = None
_cfg = None


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


def key_of(e):
    return f"{e['url']}|{e['fen']}"


def _init(cfg):
    global _engine, _cfg
    _cfg = cfg
    _engine = chess.engine.SimpleEngine.popen_uci(find_stockfish())
    _engine.configure({"Threads": 1, "Hash": 256})


def eval_move(board, mv, nodes):
    info = _engine.analyse(board, chess.engine.Limit(nodes=nodes), root_moves=[mv])
    cp = to_cp(info["score"].pov(board.turn))
    return cp, round(win_pct(cp), 1)


def already_done(eid):
    """Zweiter Lauf von hinten: nicht noch einmal rechnen, was der erste Lauf inzwischen geschafft hat."""
    out = DATA / "all_moves.jsonl"
    return out.exists() and f'"id": "{eid}"' in out.read_text()


def solve(e):
    if already_done(e["id"]):
        return None
    t0 = time.time()
    board = chess.Board(e["fen"])
    top = {l["uci"] for l in e["lines"]}
    best_wp = e["lines"][0]["wp"]
    fifth_wp = e["lines"][-1]["wp"]
    others = [m for m in board.legal_moves if m.uci() not in top]
    legal = len(others) + len(top)
    if not others or fifth_wp <= best_wp - _cfg["skip_gap"]:
        return {"key": key_of(e), "id": e["id"], "legal": legal, "refined": 0, "more": [], "skipped": True, "secs": 0.0}
    screened = {}
    for mv in others:
        screened[mv.uci()] = eval_move(board, mv, _cfg["screen_nodes"])[1]
    # Nachrechnen nur dort, wo die schnelle Prüfung nicht reicht: Züge, die nahe an der Grenze "10 Punkte hinter dem besten" liegen
    # (weit darüber sind sie sicher richtig, weit darunter sicher falsch), höchstens --max-refine, die nächsten an der Grenze zuerst
    lo, hi = best_wp - _cfg["refine_margin"], best_wp - _cfg["refine_close"]
    border = [m for m in others if lo <= screened[m.uci()] <= hi and screened[m.uci()] >= fifth_wp - 6]
    border.sort(key=lambda m: abs(screened[m.uci()] - (best_wp - 10.0)))
    refine = border[: _cfg["max_refine"]]
    final = {}
    for mv in refine:
        cp, wp = eval_move(board, mv, _cfg["nodes"])
        final[mv.uci()] = (cp, wp)
    more = []
    for mv in others:
        u = mv.uci()
        cp, wp = final.get(u, (None, screened[u]))
        if wp >= best_wp - KEEP_MARGIN:
            more.append({"uci": u, "san": board.san(mv), "wp": wp, "deep": u in final})
    more.sort(key=lambda m: -m["wp"])
    return {"key": key_of(e), "id": e["id"], "legal": legal, "refined": len(refine), "more": more, "skipped": False,
            "secs": round(time.time() - t0, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--nodes", type=int, default=400_000, help="Knoten für die Endwertung (etwas flacher als die Top 5, genügt für die Grenze)")
    ap.add_argument("--screen-nodes", type=int, default=100_000)
    ap.add_argument("--refine-margin", type=float, default=18.0, help="nachrechnen, wenn die schnelle Prüfung höchstens so weit hinter dem besten liegt")
    ap.add_argument("--refine-close", type=float, default=3.0, help="...und mehr als so weit (näher dran ist ohnehin gleichwertig)")
    ap.add_argument("--max-refine", type=int, default=10)
    ap.add_argument("--skip-gap", type=float, default=30.0, help="Übung überspringen, wenn die fünfte Linie so weit hinter der besten liegt")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--reverse", action="store_true", help="von hinten beginnen (zweiter Lauf parallel zum ersten; Doppeltes ist harmlos)")
    args = ap.parse_args()

    exercises = json.loads(EXERCISES.read_text())["exercises"]
    if args.limit:
        exercises = exercises[: args.limit]
    out = DATA / "all_moves.jsonl"
    done = {json.loads(l)["id"] for l in out.open()} if out.exists() else set()
    todo = [e for e in exercises if e["id"] not in done]
    if args.reverse:
        todo.reverse()
    print(f"{len(exercises)} Übungen, {len(done)} fertig, {len(todo)} offen", flush=True)

    cfg = {"nodes": args.nodes, "screen_nodes": args.screen_nodes, "refine_margin": args.refine_margin, "refine_close": args.refine_close, "max_refine": args.max_refine, "skip_gap": args.skip_gap}
    t0 = time.time()
    with mp.Pool(args.workers, initializer=_init, initargs=(cfg,)) as pool, out.open("a") as f:
        for i, res in enumerate(pool.imap(solve, todo, chunksize=1), 1):
            if res is None:
                continue
            f.write(json.dumps(res, ensure_ascii=False) + "\n")
            f.flush()
            if i % 10 == 0:
                rate = i / (time.time() - t0)
                print(f"{i}/{len(todo)}  ({rate * 60:.1f}/min, noch ca. {(len(todo) - i) / rate / 60:.0f} min)", flush=True)
    print("fertig", flush=True)


if __name__ == "__main__":
    main()
