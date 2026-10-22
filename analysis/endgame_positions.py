"""Endspiel-Übungen aus deinen Partien: Stellungen mit höchstens 7 Steinen, exakt bewertet mit der lichess-Tablebase.

Der Befund: In 271 Partien gab es solche Endspiele. Von 132 Gewinnstellungen hast du 88 gewonnen, 36-mal wurde aus Gewinn Remis, 8-mal Verlust,
und 17 von 33 Remisstellungen gingen verloren (analysis/tablebase.py, data/tablebase.jsonl). Die meisten Züge dort fallen in Zeitnot.

Die Übung: Richtig ist jeder Zug, der das Ergebnis hält (Gewinn bleibt Gewinn, Remis bleibt Remis). Das ist hier keine Schätzung, die Tablebase
kennt jeden Zug exakt. Ausgewählt werden deine Stellungen, in denen etwas zu entscheiden war: mindestens ein Zug hält das Ergebnis und mindestens zwei
verspielen es (bei deinen eigenen Fehlern genügt einer), und nicht mehr als 60 % der Züge sind richtig (bei eigenen Fehlern 80 %). Deine Fehler zuerst, dann die kritischsten, höchstens
vier je Partie und mindestens sechs Halbzüge auseinander.

Je Stellung speichert das Skript alle legalen Züge mit ihrem Ergebnis aus deiner Sicht ('w' Gewinn, 'd' Remis, 'l' Verlust), die beste Linie
(bei Gewinn die kürzeste nach der 50-Züge-Regel, sonst Zug für Zug den besten der Tablebase), ein paar weitere richtige Züge und bei deinem Fehler,
wie der Gegner ihn ausnutzt. "Gewinn, aber nach der 50-Züge-Regel Remis" zählt als Remis.

Aufruf: python analysis/endgame_positions.py
Liest data/tablebase.jsonl und data/games_raw.jsonl, fragt https://tablebase.lichess.ovh ab (mit Zwischenspeicher data/tb_cache.jsonl, fortsetzbar)
und schreibt data/endgame_positions.jsonl. Danach: python analysis/build_exercises.py.
"""

import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import chess

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
API = "https://tablebase.lichess.ovh/standard"
UA = "road-to-gm (private Trainings-App, ein Nutzer)"

# Ergebnis der Stellung für den, der am Zug ist
ROOT_RES = {"win": "w", "cursed-win": "d", "draw": "d", "blessed-loss": "d", "loss": "l"}
# Ergebnis eines Zuges: die Tablebase bewertet die Stellung danach aus Sicht des Gegners
MOVE_RES = {"loss": "w", "blessed-loss": "d", "draw": "d", "cursed-win": "d", "win": "l"}
WP = {"w": 100.0, "d": 50.0, "l": 0.0}

_cache = {}
_cache_file = None
_last = [0.0]


def _load_cache():
    global _cache_file
    path = DATA / "tb_cache.jsonl"
    if path.exists():
        for line in path.open():
            r = json.loads(line)
            _cache[r["k"]] = r["v"]
    _cache_file = path.open("a")


def _get(kind, fen):
    key = f"{kind}|{fen}"
    if key in _cache:
        return _cache[key]
    url = f"{API}{'/mainline' if kind == 'm' else ''}?fen={urllib.parse.quote(fen)}"
    for attempt in range(6):
        wait = 0.4 - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                v = json.loads(resp.read())
            break
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(60)
                continue
            if e.code == 404 and kind == "m":
                v = {"mainline": []}
                break
            time.sleep(5 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError):
            time.sleep(5 * (attempt + 1))
    else:
        raise SystemExit(f"Tablebase nicht erreichbar: {url}")
    _cache[key] = v
    _cache_file.write(json.dumps({"k": key, "v": v}) + "\n")
    _cache_file.flush()
    return v


def probe(fen):
    return _get("p", fen)


def results(p):
    return [(m["san"], m["uci"], MOVE_RES.get(m["category"], "?")) for m in p.get("moves", [])]


def greedy_line(board, plies):
    """Beste Fortsetzung Zug für Zug: jeweils der erste (beste) Zug der Tablebase für die Seite am Zug."""
    b = board.copy()
    out = []
    for _ in range(plies):
        if b.is_game_over():
            break
        p = probe(b.fen())
        if not p.get("moves"):
            break
        mv = chess.Move.from_uci(p["moves"][0]["uci"])
        out.append(b.san(mv))
        b.push(mv)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=360, help="höchstens so viele Übungen")
    ap.add_argument("--per-game", type=int, default=4)
    ap.add_argument("--gap", type=int, default=6, help="Mindestabstand in Halbzügen zwischen zwei Stellungen derselben Partie")
    ap.add_argument("--limit", type=int, help="nur so viele Stellungen abfragen (zum Testen)")
    ap.add_argument("--out", default=str(DATA / "endgame_positions.jsonl"))
    args = ap.parse_args()
    _load_cache()

    games = {}
    for line in (DATA / "games_raw.jsonl").open():
        g = json.loads(line)
        games[(g["platform"], g["id"])] = g
    rows = [json.loads(l) for l in (DATA / "tablebase.jsonl").open()]
    rows = [r for r in rows if r["before"] in ("win", "draw")]
    if args.limit:
        rows = rows[: args.limit]
    print(f"{len(rows)} Stellungen mit Gewinn oder Remis, Abfrage der Tablebase ...", flush=True)

    cands = []
    for i, r in enumerate(rows, 1):
        g = games.get((r["platform"], r["id"]))
        if not g:
            continue
        p = probe(r["fen"])
        res = ROOT_RES.get(p.get("category"), "?")
        moves = results(p)
        if res not in ("w", "d") or not moves or any(m[2] == "?" for m in moves):
            continue
        keep = [m for m in moves if m[2] == res]
        worse = [m for m in moves if m[2] != res]
        played = next((m for m in moves if m[1] == r["uci"]), None)
        if not played:
            continue
        error = played[2] != res
        if not keep or len(keep) / len(moves) > (0.8 if error else 0.6) or len(worse) < (1 if error else 2):
            continue
        cands.append({"row": r, "res": res, "moves": moves, "keep": len(keep), "legal": len(moves), "error": error, "played": played})
        if i % 100 == 0:
            print(f"{i}/{len(rows)} abgefragt, {len(cands)} Kandidaten", flush=True)

    # Fehler zuerst, dann die kritischsten (wenige richtige Züge), je Partie begrenzt und mit Abstand
    cands.sort(key=lambda c: (not c["error"], c["keep"] / c["legal"], c["row"]["id"], c["row"]["ply"]))
    picked, per_game = [], {}
    for c in cands:
        gid = (c["row"]["platform"], c["row"]["id"])
        taken = per_game.setdefault(gid, [])
        if not c["error"] and (len(taken) >= args.per_game or any(abs(c["row"]["ply"] - p) < args.gap for p in taken)):
            continue
        taken.append(c["row"]["ply"])
        picked.append(c)
        if len(picked) >= args.max:
            break
    print(f"{len(cands)} Kandidaten, {len(picked)} ausgewählt ({sum(c['error'] for c in picked)} eigene Fehler). Linien ...", flush=True)

    out = Path(args.out)
    with out.open("w") as f:
        for n, c in enumerate(picked, 1):
            r = c["row"]
            g = games[(r["platform"], r["id"])]
            mv = g["moves"]
            ply = r["ply"]
            board = chess.Board()
            ok = True
            for uci, _clk in mv[: ply - 1]:
                try:
                    board.push_uci(uci)
                except ValueError:
                    ok = False
                    break
            if not ok:
                continue
            prev_board = board.board_fen()
            prev_mv = chess.Move.from_uci(mv[ply - 1][0])
            prev_san = board.san(prev_mv)
            board.push(prev_mv)
            if board.board_fen() != chess.Board(r["fen"]).board_fen():
                continue
            fen = r["fen"]
            res = c["res"]
            # beste Linie: bei Gewinn die Hauptlinie der Tablebase, sonst Zug für Zug
            if res == "w":
                ml = [m["san"] for m in _get("m", fen).get("mainline", [])][:10]
                pv = ml if ml else greedy_line(board, 8)
            else:
                pv = greedy_line(board, 8)
            if not pv:
                continue
            best_san = pv[0]
            best_uci = board.parse_san(best_san).uci()
            lines = [{"san": best_san, "uci": best_uci, "wp": WP[res], "cp": 0, "pv": pv, "ev": [WP[res]] * len(pv)}]
            for san, uci, rr in c["moves"]:
                if rr == res and san != best_san and len(lines) < 5:
                    lines.append({"san": san, "uci": uci, "wp": WP[res], "cp": 0, "pv": [san]})
            psan, puci, pres = c["played"]
            refs = []
            if pres != res:
                after = board.copy()
                after.push_uci(puci)
                follow = greedy_line(after, 4)
                if follow:
                    refs.append([psan, follow, [WP[pres]] * (1 + len(follow))])
            inc = g.get("inc") or 0
            prev_clk = mv[ply - 2][1] if ply >= 2 else g["base"]
            spent = (prev_clk - mv[ply][1] + inc) if ply < len(mv) and prev_clk is not None and mv[ply][1] is not None else None
            rec = {
                "key": f"{g['url']}|{fen}",
                "fen": fen,
                "turn": "w" if board.turn == chess.WHITE else "b",
                "lines": lines,
                "played": {"san": psan, "uci": puci, "wp": WP[pres], "cp": 0},
                "tb": {"res": res, "moves": [[san, rr] for san, _u, rr in c["moves"]], "game": [r["before"], r["after"]]},
                "refs": refs,
                "clock": prev_clk,
                "spent": round(spent, 1) if spent is not None else None,
                "url": g["url"],
                "prev": {"board": prev_board, "uci": prev_mv.uci(), "san": prev_san},
                "error": c["error"],
            }
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            if n % 25 == 0:
                print(f"{n}/{len(picked)} Linien", flush=True)
    print("fertig", flush=True)


if __name__ == "__main__":
    main()
