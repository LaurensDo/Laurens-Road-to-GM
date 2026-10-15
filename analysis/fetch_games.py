"""Lädt alle Partien von lichess und chess.com und speichert sie als JSONL.

Aufruf:
    python analysis/fetch_games.py --lichess Poquitonator --chesscom laurens3495

Ausgabe: data/games_raw.jsonl (eine Partie pro Zeile, beide Plattformen im selben Format).
"""

import argparse
import io
import json
import time
import urllib.request
from pathlib import Path

import chess.pgn

UA = "road-to-gm (personal training analysis)"
DATA = Path(__file__).resolve().parent.parent / "data"


def http_get(url, accept="application/json"):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                return resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(60)
                continue
            raise
        except urllib.error.URLError:
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError(f"Download fehlgeschlagen: {url}")


def parse_time_control(tc):
    if not tc or tc == "-" or "/" in tc:
        return None, None
    base, _, inc = tc.partition("+")
    return int(base), int(inc or 0)


def moves_with_clocks(pgn_text):
    """Gibt (Header, [(uci, clock_seconds_or_None), ...]) zurück."""
    game = chess.pgn.read_game(io.StringIO(pgn_text))
    if game is None:
        return None, []
    moves = []
    for node in game.mainline():
        clk = node.clock()
        moves.append((node.move.uci(), round(clk, 1) if clk is not None else None))
    return game.headers, moves


def fetch_lichess(user, perf, max_games=None):
    url = (
        f"https://lichess.org/api/games/user/{user}"
        f"?perfType={perf}&clocks=true&evals=false&opening=true&pgnInJson=true"
    )
    if max_games:
        url += f"&max={max_games}"
    text = http_get(url, accept="application/x-ndjson")
    for line in text.splitlines():
        if not line.strip():
            continue
        g = json.loads(line)
        if g.get("variant") != "standard":
            continue
        white = g["players"]["white"]
        black = g["players"]["black"]
        color = "white" if white.get("user", {}).get("name", "").lower() == user.lower() else "black"
        me, opp = (white, black) if color == "white" else (black, white)
        winner = g.get("winner")
        result = 0.5 if winner is None else (1.0 if winner == color else 0.0)
        if g.get("status") in ("aborted", "noStart"):
            continue
        headers, moves = moves_with_clocks(g.get("pgn", ""))
        if not moves:
            continue
        clock = g.get("clock") or {}
        yield {
            "platform": "lichess",
            "id": g["id"],
            "url": f"https://lichess.org/{g['id']}",
            "end_ts": g.get("lastMoveAt", g.get("createdAt")) // 1000,
            "start_ts": g.get("createdAt") // 1000,
            "speed": g.get("speed"),
            "base": clock.get("initial"),
            "inc": clock.get("increment"),
            "rated": g.get("rated", False),
            "color": color,
            "my_rating": me.get("rating"),
            "opp_rating": opp.get("rating"),
            "opp_name": opp.get("user", {}).get("name"),
            "result": result,
            "termination": g.get("status"),
            "eco": g.get("opening", {}).get("eco"),
            "opening": g.get("opening", {}).get("name"),
            "moves": moves,
        }


def fetch_chesscom(user):
    archives = json.loads(http_get(f"https://api.chess.com/pub/player/{user}/games/archives"))["archives"]
    for arch in archives:
        data = json.loads(http_get(arch))
        for g in data.get("games", []):
            if g.get("rules") != "chess" or not g.get("pgn"):
                continue
            color = "white" if g["white"]["username"].lower() == user.lower() else "black"
            me, opp = (g["white"], g["black"]) if color == "white" else (g["black"], g["white"])
            res = me.get("result")
            if res == "win":
                result = 1.0
            elif res in ("agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"):
                result = 0.5
            else:
                result = 0.0
            headers, moves = moves_with_clocks(g["pgn"])
            if not moves:
                continue
            base, inc = parse_time_control(g.get("time_control"))
            eco_url = headers.get("ECOUrl", "") if headers else ""
            opening = eco_url.rsplit("/", 1)[-1].replace("-", " ") if eco_url else None
            # Verlierer-Ergebniscode beschreibt die Art des Partieendes
            term = opp.get("result") if result == 1.0 else res
            yield {
                "platform": "chesscom",
                "id": g["url"].rsplit("/", 1)[-1],
                "url": g["url"],
                "end_ts": g.get("end_time"),
                "start_ts": None,
                "speed": g.get("time_class"),
                "base": base,
                "inc": inc,
                "rated": g.get("rated", False),
                "color": color,
                "my_rating": me.get("rating"),
                "opp_rating": opp.get("rating"),
                "opp_name": opp.get("username"),
                "result": result,
                "termination": term,
                "eco": headers.get("ECO") if headers else None,
                "opening": opening,
                "moves": moves,
            }
        time.sleep(0.3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lichess")
    ap.add_argument("--chesscom")
    ap.add_argument("--bullet-max", type=int, default=3000)
    args = ap.parse_args()
    DATA.mkdir(exist_ok=True)
    out = DATA / "games_raw.jsonl"
    n = {"lichess": 0, "chesscom": 0}
    with out.open("w") as f:
        if args.chesscom:
            for g in fetch_chesscom(args.chesscom):
                f.write(json.dumps(g) + "\n")
                n["chesscom"] += 1
        if args.lichess:
            # Blitz/Rapid komplett, Bullet nur als Vergleichsstichprobe (30.000+ Partien)
            for perf, max_games in (("blitz,rapid", None), ("bullet", args.bullet_max)):
                for g in fetch_lichess(args.lichess, perf, max_games):
                    f.write(json.dumps(g) + "\n")
                    n["lichess"] += 1
    print(f"Gespeichert: {out} – {n}")


if __name__ == "__main__":
    main()
