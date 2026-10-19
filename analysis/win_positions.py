"""Stellungen für "Sicher gewinnen": Du stehst klar gewonnen und musst nur einen sicheren Zug finden, schnell.

Der Befund hinter der Übung: In Stellungen mit mindestens 90 % Gewinnchance verlierst du 17 % der Partien noch, 101 von 136 davon auf Zeit.
Zu langes Nachdenken in gewonnener Stellung kostet mehr als ein nicht ganz bester Zug. Die Übung ist deshalb Tempo statt Genauigkeit: Jeder Zug, der
die Stellung klar gewonnen hält (Gewinnchance mindestens --safe-wp), ist richtig.

Auswahl (aus data/analysis.jsonl und data/games_raw.jsonl, nur Blitz):
  - dein Zug, Zug 12 bis 55, Gewinnchance für dich mindestens 90 %, kein Matt in Sicht, nicht im Schach
  - du hast dort mindestens 5 s gebraucht oder hattest weniger als 40 s auf der Uhr
  - höchstens zwei Stellungen je Partie, mindestens 10 Halbzüge auseinander
Danach wird jeder legale Zug mit Stockfish bewertet (--screen-nodes). Behalten wird die Stellung nur, wenn es mindestens drei sichere Züge gibt
(höchstens drei Viertel aller legalen), aber auch mindestens vier Züge, die den Vorteil klar verspielen: Sonst gibt es nichts zu entscheiden. Die fünf besten Linien kommen aus einer tiefen
Suche (--nodes), Züge nahe der Grenze "sicher" werden nachgerechnet.

Aufruf: python analysis/win_positions.py --workers 3
Schreibt data/win_positions.jsonl (fortsetzbar). Danach: python analysis/build_exercises.py.
"""

import argparse
import hashlib
import json
import multiprocessing as mp
import random
import time
from pathlib import Path

import chess
import chess.engine

from all_moves import find_stockfish, to_cp, win_pct

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

_engine = None
_cfg = None


def _init(cfg):
    global _engine, _cfg
    _cfg = cfg
    _engine = chess.engine.SimpleEngine.popen_uci(find_stockfish())
    _engine.configure({"Threads": 1, "Hash": 256})


def key_of(url, fen):
    return f"{url}|{fen}"


def candidates(args):
    """Kandidaten aus den vorhandenen Analysen, die besten zuerst (erst "lange nachgedacht", dann "wenig Zeit")."""
    games = {}
    for line in (DATA / "games_raw.jsonl").open():
        g = json.loads(line)
        games[(g["platform"], g["id"])] = g
    found = []
    for line in (DATA / "analysis.jsonl").open():
        a = json.loads(line)
        g = games.get((a["platform"], a["id"]))
        if not g:
            continue
        white = g["color"] == "white"
        mv = g["moves"]
        inc = g.get("inc") or 0
        base = g["base"]
        last_ply = -100
        picked = 0
        for i, p in enumerate(a["plies"]):
            if (i % 2 == 0) != white or i - last_ply < 10 or picked >= 2:
                continue
            move = i // 2 + 1
            if move < 12 or move > 55 or i >= len(mv):
                continue
            cp = p["cp"] if white else -p["cp"]
            if abs(cp) >= 9000 or win_pct(cp) < args.min_wp:
                continue
            prev_clk = mv[i - 2][1] if i >= 2 else base
            spent = prev_clk - mv[i][1] + inc
            if spent < 5 and prev_clk >= 40:
                continue
            found.append({"platform": g["platform"], "id": g["id"], "url": g["url"], "ply": i, "spent": round(spent, 1), "clock": round(prev_clk, 1),
                          "date": g.get("date") or "", "end_ts": g.get("end_ts"), "color": g["color"], "moves": [m[0] for m in mv[: i + 1]], "inc": inc})
            last_ply = i
            picked += 1
    rng = random.Random(args.seed)
    rng.shuffle(found)
    found.sort(key=lambda c: (0 if c["spent"] >= 10 else 1 if c["spent"] >= 5 else 2))
    return found[: args.candidates]


def eval_move(board, mv, nodes):
    info = _engine.analyse(board, chess.engine.Limit(nodes=nodes), root_moves=[mv])
    cp = to_cp(info["score"].pov(board.turn))
    return cp, round(win_pct(cp), 1)


def san_line(board, pv, plies=8):
    b = board.copy()
    out = []
    for m in pv[:plies]:
        out.append(b.san(m))
        b.push(m)
    return out


def solve(c):
    t0 = time.time()
    board = chess.Board()
    for u in c["moves"][: c["ply"] - 1]:
        board.push_uci(u)
    before_prev = board.board_fen()
    prev_uci = c["moves"][c["ply"] - 1]
    prev_san = board.san(chess.Move.from_uci(prev_uci))
    board.push_uci(prev_uci)
    fen = board.fen()
    if board.is_check() or board.is_game_over():
        return {"id": f"{c['platform']}:{c['id']}:{c['ply']}", "skip": "schach"}
    me = board.turn
    legal = list(board.legal_moves)
    screened = {m.uci(): eval_move(board, m, _cfg["screen_nodes"]) for m in legal}
    best = max(v[1] for v in screened.values())
    safe = [u for u, v in screened.items() if v[1] >= _cfg["safe_wp"]]
    bad = [u for u, v in screened.items() if v[1] < 60]
    out = {"id": f"{c['platform']}:{c['id']}:{c['ply']}", "legal": len(legal), "safe": len(safe), "bad": len(bad), "best": best}
    if best < _cfg["min_wp"] or len(safe) < 3 or len(bad) < 4 or len(safe) / len(legal) > 0.75:
        out["skip"] = "auswahl"
        return out

    infos = _engine.analyse(board, chess.engine.Limit(nodes=_cfg["nodes"]), multipv=5)
    lines = []
    for inf in infos:
        pv = inf.get("pv", [])
        if not pv:
            continue
        cp = to_cp(inf["score"].pov(me))
        lines.append({"uci": pv[0].uci(), "san": board.san(pv[0]), "cp": cp, "wp": round(win_pct(cp), 1), "pv": san_line(board, pv)})
    if not lines:
        out["skip"] = "keine_linien"
        return out
    top = {l["uci"] for l in lines}
    # Züge nahe der Grenze "sicher" genauer rechnen, den Rest der schnellen Prüfung überlassen
    rest = {u: v[1] for u, v in screened.items() if u not in top}
    near = sorted((u for u, w in rest.items() if abs(w - _cfg["safe_wp"]) <= 5), key=lambda u: abs(rest[u] - _cfg["safe_wp"]))[:10]
    for u in near:
        rest[u] = eval_move(board, chess.Move.from_uci(u), _cfg["refine_nodes"])[1]
    best_wp = lines[0]["wp"]
    more = sorted(([board.san(chess.Move.from_uci(u)), w] for u, w in rest.items() if w >= best_wp - 40), key=lambda m: -m[1])
    played_uci = c["moves"][c["ply"]]
    pw = next((l["wp"] for l in lines if l["uci"] == played_uci), rest.get(played_uci, screened[played_uci][1]))
    pcp = screened[played_uci][0]
    pieces = sum(1 for p in board.piece_map().values() if p.piece_type not in (chess.PAWN, chess.KING))
    out.update(
        {
            "key": key_of(c["url"], fen),
            "fen": fen,
            "turn": "w" if me == chess.WHITE else "b",
            "lines": lines,
            "more": more,
            "played": {"san": board.san(chess.Move.from_uci(played_uci)), "uci": played_uci, "wp": pw, "cp": pcp},
            "clock": c["clock"],
            "spent": c["spent"],
            "date": c["date"],
            "url": c["url"],
            "src": c["platform"],
            "phase": "Endspiel" if pieces <= 6 else "Mittelspiel",
            "prev": {"board": before_prev, "uci": prev_uci, "san": prev_san},
            "secs": round(time.time() - t0, 1),
        }
    )
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--candidates", type=int, default=700)
    ap.add_argument("--min-wp", type=float, default=90.0, help="Gewinnchance für dich, ab der die Stellung als klar gewonnen gilt")
    ap.add_argument("--safe-wp", type=float, default=80.0, help="Züge mit mindestens so viel Gewinnchance gelten als sicher")
    ap.add_argument("--nodes", type=int, default=1_000_000)
    ap.add_argument("--screen-nodes", type=int, default=100_000)
    ap.add_argument("--refine-nodes", type=int, default=400_000)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--out", default=str(DATA / "win_positions.jsonl"))
    args = ap.parse_args()

    cands = candidates(args)
    if args.limit:
        cands = cands[: args.limit]
    out = Path(args.out)
    done = {json.loads(l)["id"] for l in out.open()} if out.exists() else set()
    todo = [c for c in cands if f"{c['platform']}:{c['id']}:{c['ply']}" not in done]
    print(f"{len(cands)} Kandidaten, {len(done)} fertig, {len(todo)} offen", flush=True)

    cfg = {"nodes": args.nodes, "screen_nodes": args.screen_nodes, "refine_nodes": args.refine_nodes, "safe_wp": args.safe_wp, "min_wp": args.min_wp}
    t0 = time.time()
    kept = 0
    with mp.Pool(args.workers, initializer=_init, initargs=(cfg,)) as pool, out.open("a") as f:
        for i, res in enumerate(pool.imap(solve, todo, chunksize=1), 1):
            f.write(json.dumps(res, ensure_ascii=False) + "\n")
            f.flush()
            kept += "skip" not in res
            if i % 20 == 0:
                rate = i / (time.time() - t0)
                print(f"{i}/{len(todo)}  behalten {kept}  ({rate * 60:.1f}/min, noch ca. {(len(todo) - i) / rate / 60:.0f} min)", flush=True)
    print("fertig", flush=True)


if __name__ == "__main__":
    main()
