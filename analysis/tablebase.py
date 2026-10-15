"""Prüft Endspielzüge (≤ 7 Steine) gegen die Syzygy-Tablebase von lichess.

Aufruf:
    python analysis/tablebase.py --since 2025-01-01

Für jede Stellung mit höchstens 7 Steinen, in der du am Zug bist, wird das
theoretische Ergebnis vor und nach deinem Zug abgefragt. So wird sichtbar, wo
ein gewonnenes Endspiel zum Remis wurde oder ein Remis verloren ging.

Schreibt data/tablebase.jsonl (fortsetzbar).
"""

import argparse
import datetime as dt
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

import chess

DATA = Path(__file__).resolve().parent.parent / "data"
API = "https://tablebase.lichess.ovh/standard?fen="
UA = "road-to-gm (personal training analysis)"

# Ergebnis aus Sicht der Seite am Zug. Cursed win / blessed loss = Remis durch 50-Züge-Regel.
VALUE = {"win": 1, "cursed-win": 0, "draw": 0, "blessed-loss": 0, "loss": -1}
FLIP = {"win": "loss", "loss": "win", "cursed-win": "blessed-loss", "blessed-loss": "cursed-win", "draw": "draw",
        "maybe-win": "maybe-loss", "maybe-loss": "maybe-win", "unknown": "unknown"}


def query(fen):
    url = API + urllib.parse.quote(fen)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(60)
                continue
            raise
        except urllib.error.URLError:
            time.sleep(2 ** (attempt + 1))
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="2025-01-01")
    args = ap.parse_args()
    ts = dt.datetime.fromisoformat(args.since).replace(tzinfo=dt.timezone.utc).timestamp()

    out = DATA / "tablebase.jsonl"
    done = set()
    if out.exists():
        done = {(r["platform"], r["id"], r["ply"]) for r in map(json.loads, out.open())}

    jobs = []
    for line in (DATA / "games_raw.jsonl").open():
        g = json.loads(line)
        if not (g["speed"] == "blitz" and g["base"] in (180, 300) and g["end_ts"] >= ts and len(g["moves"]) >= 10):
            continue
        me = chess.WHITE if g["color"] == "white" else chess.BLACK
        board = chess.Board()
        for ply, (uci, clk) in enumerate(g["moves"]):
            if len(board.piece_map()) <= 7 and board.turn == me and not board.castling_rights:
                if (g["platform"], g["id"], ply) not in done:
                    jobs.append((g, ply, board.fen(), uci))
            board.push_uci(uci)
    print(f"{len(jobs)} Stellungen abzufragen", flush=True)

    with out.open("a") as f:
        for i, (g, ply, fen, uci) in enumerate(jobs, 1):
            res = query(fen)
            if res is None:
                continue
            before = res.get("category")
            played = next((m for m in res.get("moves", []) if m["uci"] == uci), None)
            after = FLIP.get(played["category"]) if played else None
            best_cat = res["moves"][0]["category"] if res.get("moves") else None
            best_moves = [m["san"] for m in res.get("moves", []) if m["category"] == best_cat][:3]
            f.write(json.dumps({
                "platform": g["platform"], "id": g["id"], "ply": ply, "fen": fen, "uci": uci,
                "played_san": played["san"] if played else None,
                "before": before, "after": after, "best": best_moves,
                "dtm": res.get("dtm"), "dtz": res.get("dtz"),
            }) + "\n")
            if i % 200 == 0:
                print(f"{i}/{len(jobs)}", flush=True)
                f.flush()
            time.sleep(0.15)
    print("fertig", flush=True)


if __name__ == "__main__":
    main()
