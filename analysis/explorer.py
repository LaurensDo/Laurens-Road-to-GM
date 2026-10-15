"""Fragt den lichess Opening Explorer für deine Eröffnungs-Lecks ab.

Aufruf:
    LICHESS_TOKEN=lip_... python analysis/explorer.py

Der Explorer verlangt ein lichess-Token (ohne Berechtigungen reicht). Das Token wird nur
aus der Umgebungsvariable gelesen und nirgends gespeichert.

Für jede Leck-Stellung aus data/report.json wird abgefragt, was Blitz-Spieler deiner Stärke
(lichess-Skala, umgerechnet über ratings.py) und der nächsthöheren Gruppe dort spielen und wie
die Züge ausgehen. Verglichen werden dein Zug, der Engine-Zug und die beliebtesten Züge.

Schreibt data/explorer.json.
"""

import json
import os
import statistics as st
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from ratings import EXPLORER_BUCKETS, chesscom_to_lichess

DATA = Path(__file__).resolve().parent.parent / "data"
API = "https://explorer.lichess.ovh/lichess"
UA = "road-to-gm (personal training analysis)"


def own_bucket():
    """Explorer-Gruppe, die zu deiner Stärke auf lichess-Skala passt (Median der analysierten chess.com-Partien)."""
    ratings = []
    for line in (DATA / "games_raw.jsonl").open():
        g = json.loads(line)
        if g["platform"] == "chesscom" and g["speed"] == "blitz" and g["rated"] and g["end_ts"] >= 1735689600:
            ratings.append(g["my_rating"])
    lichess_level = chesscom_to_lichess(st.median(ratings))
    return max(b for b in EXPLORER_BUCKETS if b <= lichess_level), round(lichess_level)


def query(fen, bucket, speeds, token):
    params = {"variant": "standard", "speeds": speeds, "ratings": str(bucket), "fen": fen, "moves": "12"}
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Authorization": f"Bearer {token}"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(65)
                continue
            raise
        except urllib.error.URLError:
            time.sleep(2 ** (attempt + 1))
    return None


def summarize(res, white_to_move):
    """Züge mit Häufigkeit und Score aus Sicht des Spielers am Zug."""
    total = res["white"] + res["draws"] + res["black"]
    moves = []
    for m in res["moves"]:
        n = m["white"] + m["draws"] + m["black"]
        if not n:
            continue
        mine = m["white"] if white_to_move else m["black"]
        moves.append({"uci": m["uci"], "san": m["san"], "n": n,
                      "share": round(100 * n / total, 1) if total else 0,
                      "score": round(100 * (mine + m["draws"] / 2) / n, 1)})
    return {"total": total, "moves": moves}


def main():
    token = os.environ.get("LICHESS_TOKEN")
    if not token:
        sys.exit("LICHESS_TOKEN fehlt (Umgebungsvariable)")
    report = json.loads((DATA / "report.json").read_text())
    leaks = report["opening_leaks"]
    bucket, lichess_level = own_bucket()
    upper = next((b for b in EXPLORER_BUCKETS if b > bucket), bucket)
    print(f"Dein Niveau auf lichess-Skala: {lichess_level} -> Explorer-Gruppe {bucket}, darüber {upper}", flush=True)

    out = {"bucket": bucket, "upper": upper, "lichess_level": lichess_level, "speeds": "blitz", "positions": {}}
    for i, leak in enumerate(leaks, 1):
        fen = leak["fen"]
        white = " w " in fen
        entry = {}
        for name, b in (("level", bucket), ("up", upper)):
            res = query(fen, b, "blitz", token)
            entry[name] = summarize(res, white) if res else None
            time.sleep(1.2)
        out["positions"][fen] = entry
        print(f"{i}/{len(leaks)} {leak['opening']}: {entry['level']['total'] if entry['level'] else '-'} Partien", flush=True)

    (DATA / "explorer.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print("fertig", flush=True)


if __name__ == "__main__":
    main()
