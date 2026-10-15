"""Bewertet jede Stellung der ausgewählten Partien mit Stockfish.

Aufruf:
    python analysis/analyze_games.py --since 2025-01-01 --workers 4

Liest data/games_raw.jsonl, schreibt data/analysis.jsonl (fortsetzbar: bereits
analysierte Partien werden übersprungen).

Pro Stellung (vor dem Zug) wird gespeichert:
    cp      Bewertung aus Sicht von Weiß in Centipawns (Matt = ±10000 - Abstand)
    best    bester Zug (UCI)
    cp2     Bewertung des zweitbesten Zugs (Weiß-Sicht), für die "Kritikalität"
    pv      Hauptvariante (max. 8 Halbzüge)
"""

import argparse
import datetime as dt
import json
import multiprocessing as mp
import shutil
from pathlib import Path

import chess
import chess.engine

DATA = Path(__file__).resolve().parent.parent / "data"
MATE = 10000


def find_stockfish():
    for p in ("stockfish", "/usr/games/stockfish", "/usr/local/bin/stockfish"):
        if shutil.which(p) or Path(p).exists():
            return shutil.which(p) or p
    raise SystemExit("Stockfish nicht gefunden")


def score_cp(score):
    s = score.white()
    if s.is_mate():
        m = s.mate()
        return MATE - abs(m) if m > 0 else -(MATE - abs(m))
    return s.score()


_engine = None
_nodes = None


def _init(nodes):
    global _engine, _nodes
    _engine = chess.engine.SimpleEngine.popen_uci(find_stockfish())
    _engine.configure({"Threads": 1, "Hash": 64})
    _nodes = nodes


def analyse_game(game):
    board = chess.Board()
    me = chess.WHITE if game["color"] == "white" else chess.BLACK
    plies = []
    for uci, _clk in game["moves"]:
        entry = {}
        if not board.is_game_over():
            # Zweitbester Zug nur bei eigenen Zügen nötig (Kritikalität für die Zeitanalyse)
            multipv = 2 if board.turn == me else 1
            infos = _engine.analyse(board, chess.engine.Limit(nodes=_nodes), multipv=multipv)
            first = infos[0]
            entry["cp"] = score_cp(first["score"])
            pv = first.get("pv", [])
            entry["best"] = pv[0].uci() if pv else None
            entry["pv"] = [m.uci() for m in pv[:8]]
            if len(infos) > 1 and "score" in infos[1]:
                entry["cp2"] = score_cp(infos[1]["score"])
        plies.append(entry)
        board.push_uci(uci)
    # Endstellung bewerten (für den Verlust des letzten Zuges)
    if board.is_checkmate():
        final = -MATE if board.turn == chess.WHITE else MATE
    elif board.is_game_over():
        final = 0
    else:
        final = score_cp(_engine.analyse(board, chess.engine.Limit(nodes=_nodes))["score"])
    return {"platform": game["platform"], "id": game["id"], "plies": plies, "final_cp": final}


def select_games(since, bases):
    ts = dt.datetime.fromisoformat(since).replace(tzinfo=dt.timezone.utc).timestamp()
    out = []
    for line in (DATA / "games_raw.jsonl").open():
        g = json.loads(line)
        if g["speed"] == "blitz" and g["base"] in bases and g["end_ts"] >= ts and len(g["moves"]) >= 10:
            out.append(g)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="2025-01-01")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--nodes", type=int, default=50_000)
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    games = select_games(args.since, {180, 300})
    out = DATA / "analysis.jsonl"
    done = set()
    if out.exists():
        done = {(r["platform"], r["id"]) for r in map(json.loads, out.open())}
    todo = [g for g in games if (g["platform"], g["id"]) not in done]
    todo.sort(key=lambda g: g["end_ts"], reverse=True)  # neueste zuerst
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(games)} Partien ausgewählt, {len(done)} schon analysiert, {len(todo)} offen", flush=True)

    with mp.Pool(args.workers, initializer=_init, initargs=(args.nodes,)) as pool, out.open("a") as f:
        for i, res in enumerate(pool.imap_unordered(analyse_game, todo), 1):
            f.write(json.dumps(res) + "\n")
            f.flush()
            if i % 50 == 0:
                print(f"{i}/{len(todo)}", flush=True)
    print("fertig", flush=True)


if __name__ == "__main__":
    main()
