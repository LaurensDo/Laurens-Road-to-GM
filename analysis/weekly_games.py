"""Wochenauswertung deiner Partien: Blitz und Bullet, chess.com und lichess, mit denselben Maßstäben wie die Diagnose.

Laurens am 09.11.2026: Die App nutzt er nicht mehr täglich, die Auswertung seiner Partien soll wöchentlich dazukommen.

Je Tempo (Blitz, Bullet) und Zeitraum (letzte 7 Tage, die 7 Tage davor, Schnitt der 4 Wochen davor):
  Partien, Ergebnis       Siege, Remis, Niederlagen, Punkte in %; Wertung je Plattform am Anfang und Ende des Zeitraums
  Uhr                     Restzeit nach Zug 20 und 30 (Median) und Anteil der Partien im Budget (3+0: 2:00 und 1:20, Bullet anteilig)
  Denkpausen              lange Züge in Zug 15 bis 35 je Partie (3+0: ab 10 s, Bullet anteilig)
  Patzer                  je 100 eigene Züge ab Zug 6 (Gewinnchance fällt um 30 Punkte oder mehr, wie lichess), ohne und in Zeitnot,
                          zum Vergleich die Gegner
  Zeitverluste            Niederlagen auf Zeit, davon in nicht verlorener Stellung (Gewinnchance am Ende mindestens 30 %)
Stockfish bewertet jede Stellung kurz (--nodes). Bewertete Partien liegen in data/weekly_evals.jsonl und werden nicht neu gerechnet.

Aufruf: python analysis/weekly_games.py [--workers 3]
Gibt die Auswertung als Text aus und speichert die Zahlen in data/weekly_games/<Datum>.json. Gegnernamen werden nicht gespeichert.
"""

import argparse
import datetime as dt
import json
import multiprocessing as mp
import statistics
import time
from pathlib import Path

import chess
import chess.engine

import fetch_games as fg
from all_moves import find_stockfish, to_cp, win_pct

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DAY = 86400
LICHESS, CHESSCOM = "Poquitonator", "laurens3495"
BLUNDER = 30

_engine = None
_nodes = 40000


def _init(nodes):
    global _engine, _nodes
    _nodes = nodes
    _engine = chess.engine.SimpleEngine.popen_uci(find_stockfish())
    _engine.configure({"Threads": 1, "Hash": 64})


def _evaluate(g):
    """Bewertung (Weiß-Sicht, Centipawns) jeder Stellung der Partie, vor dem ersten Zug bis nach dem letzten."""
    board = chess.Board()
    out = []
    for i in range(len(g["moves"]) + 1):
        if board.is_checkmate():
            out.append(-10000 if board.turn == chess.WHITE else 10000)
        elif board.is_game_over():
            out.append(0)
        else:
            info = _engine.analyse(board, chess.engine.Limit(nodes=_nodes))
            out.append(to_cp(info["score"].white()))
        if i < len(g["moves"]):
            board.push_uci(g["moves"][i][0])
    return g["key"], out


def fetch(since):
    """Partien seit `since` (Unix-Zeit) von beiden Plattformen, ohne Gegnernamen."""
    games = []
    for perf in ("blitz", "bullet"):
        url = (f"https://lichess.org/api/games/user/{LICHESS}?perfType={perf}&since={int(since * 1000)}"
               "&clocks=true&evals=false&opening=true&pgnInJson=true")
        text = fg.http_get(url, accept="application/x-ndjson")
        for line in text.splitlines():
            if not line.strip():
                continue
            g = json.loads(line)
            if g.get("variant") != "standard" or g.get("status") in ("aborted", "noStart"):
                continue
            w, b = g["players"]["white"], g["players"]["black"]
            color = "white" if w.get("user", {}).get("name", "").lower() == LICHESS.lower() else "black"
            me = w if color == "white" else b
            winner = g.get("winner")
            _h, moves = fg.moves_with_clocks(g.get("pgn", ""))
            clock = g.get("clock") or {}
            if moves and clock.get("initial"):
                games.append({"key": f"lichess:{g['id']}", "platform": "lichess", "speed": g.get("speed"), "base": clock["initial"],
                              "inc": clock.get("increment") or 0, "end_ts": g.get("lastMoveAt", g["createdAt"]) // 1000, "color": color,
                              "rating": me.get("rating"), "result": 0.5 if winner is None else (1.0 if winner == color else 0.0),
                              "timeout": g.get("status") == "outoftime", "moves": moves})
    archives = json.loads(fg.http_get(f"https://api.chess.com/pub/player/{CHESSCOM}/games/archives"))["archives"]
    first = dt.datetime.fromtimestamp(since, dt.timezone.utc)
    for arch in archives:
        y, m = (int(x) for x in arch.rstrip("/").split("/")[-2:])
        if (y, m) < (first.year, first.month):
            continue
        for g in json.loads(fg.http_get(arch)).get("games", []):
            if g.get("rules") != "chess" or not g.get("pgn") or g.get("end_time", 0) < since or g.get("time_class") not in ("blitz", "bullet"):
                continue
            color = "white" if g["white"]["username"].lower() == CHESSCOM.lower() else "black"
            me, opp = (g["white"], g["black"]) if color == "white" else (g["black"], g["white"])
            res = me.get("result")
            result = 1.0 if res == "win" else 0.5 if res in ("agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient") else 0.0
            base, inc = fg.parse_time_control(g.get("time_control"))
            _h, moves = fg.moves_with_clocks(g["pgn"])
            if moves and base:
                games.append({"key": f"chesscom:{g['url'].rsplit('/', 1)[-1]}", "platform": "chesscom", "speed": g["time_class"], "base": base,
                              "inc": inc or 0, "end_ts": g["end_time"], "color": color, "rating": me.get("rating"), "result": result,
                              "timeout": result == 0.0 and res == "timeout", "moves": moves})
        time.sleep(0.3)
    return sorted(games, key=lambda g: g["end_ts"])


def own_clocks(g):
    """Je eigenem Zug (Zugnummer ab 1): Restzeit danach und verbrauchte Zeit."""
    off = 0 if g["color"] == "white" else 1
    out, prev = [], g["base"]
    for i in range(off, len(g["moves"]), 2):
        clk = g["moves"][i][1]
        if clk is None:
            return []
        out.append((i // 2 + 1, clk, prev - clk + g["inc"], i))
        prev = clk
    return out


def opp_clock_at(g, n):
    i = 2 * (n - 1) + (1 if g["color"] == "white" else 0)
    return g["moves"][i][1] if i < len(g["moves"]) else None


def stats(games, evals):
    """Kennzahlen für eine Gruppe von Partien (ein Tempo, ein Zeitraum)."""
    if not games:
        return None
    n = len(games)
    wins, draws = sum(g["result"] == 1 for g in games), sum(g["result"] == 0.5 for g in games)
    s = {"partien": n, "siege": wins, "remis": draws, "niederlagen": n - wins - draws, "punkte_pct": round(100 * (wins + draws / 2) / n)}
    c20, c30, ok20, ok30, pauses, games15 = [], [], 0, 0, [], 0
    mine = {"n": 0, "patzer": 0, "n_tt": 0, "patzer_tt": 0}
    opp = {"n": 0, "patzer": 0}
    lot, lot_ok = 0, 0
    for g in games:
        scale = g["base"] / 180  # Budget und Zeitnot je Partie, anteilig zur Grundzeit (3+0 = 1)
        cl = own_clocks(g)
        by = {mv: (clk, spent, i) for mv, clk, spent, i in cl}
        if 20 in by:
            c20.append(by[20][0])
            ok20 += by[20][0] >= 120 * scale
        if 30 in by:
            c30.append(by[30][0])
            ok30 += by[30][0] >= 80 * scale
        if 15 in by:
            games15 += 1
            pauses.append(sum(1 for mv, (clk, spent, i) in by.items() if 15 <= mv <= 35 and spent >= 10 * scale))
        ev = evals.get(g["key"])
        tt_limit = 20 * scale
        if ev:
            me_white = g["color"] == "white"
            for ply in range(len(g["moves"])):
                mover_white = ply % 2 == 0
                if ply // 2 + 1 < 6:
                    continue
                sign = 1 if mover_white else -1
                loss = win_pct(sign * ev[ply]) - win_pct(sign * ev[ply + 1])
                if mover_white == me_white:
                    clk = g["moves"][ply][1]
                    tt = clk is not None and clk < tt_limit
                    key = "_tt" if tt else ""
                    mine["n" + key] += 1
                    mine["patzer" + key] += loss >= BLUNDER
                else:
                    opp["n"] += 1
                    opp["patzer"] += loss >= BLUNDER
        if g["timeout"] and g["result"] == 0:
            lot += 1
            if ev:
                sign = 1 if g["color"] == "white" else -1
                lot_ok += win_pct(sign * ev[-1]) >= 30
    per100 = lambda a, b: round(100 * a / b, 1) if b else None
    s.update({
        "uhr_zug20_median_s": round(statistics.median(c20)) if c20 else None,
        "uhr_zug20_im_budget_pct": round(100 * ok20 / len(c20)) if c20 else None,
        "uhr_zug30_median_s": round(statistics.median(c30)) if c30 else None,
        "uhr_zug30_im_budget_pct": round(100 * ok30 / len(c30)) if c30 else None,
        "denkpausen_je_partie": round(statistics.mean(pauses), 2) if pauses else None,
        "patzer_je_100_ohne_zeitnot": per100(mine["patzer"], mine["n"]),
        "patzer_je_100_in_zeitnot": per100(mine["patzer_tt"], mine["n_tt"]),
        "zeitnot_anteil_zuege_pct": per100(mine["n_tt"], mine["n"] + mine["n_tt"]),
        "gegner_patzer_je_100": per100(opp["patzer"], opp["n"]),
        "zeitverluste": lot,
        "zeitverluste_nicht_verloren": lot_ok,
    })
    return s


def ratings(games):
    out = {}
    for plat in ("chesscom", "lichess"):
        rs = [g["rating"] for g in games if g["platform"] == plat and g["rating"]]
        if rs:
            out[plat] = {"von": rs[0], "bis": rs[-1]}
    return out


def fmt(v, unit=""):
    return "–" if v is None else f"{v}{unit}".replace(".", ",")


def text_report(rep):
    lines = [f"Partien bis {rep['stand']} (letzte 7 Tage, davor, Schnitt 4 Wochen davor)"]
    rows = [("Partien", "partien", ""), ("Punkte", "punkte_pct", " %"), ("Uhr nach Zug 20 (Median)", "uhr_zug20_median_s", " s"),
            ("… im Budget", "uhr_zug20_im_budget_pct", " %"), ("Uhr nach Zug 30 (Median)", "uhr_zug30_median_s", " s"),
            ("… im Budget", "uhr_zug30_im_budget_pct", " %"), ("Denkpausen je Partie (Zug 15–35)", "denkpausen_je_partie", ""),
            ("Patzer je 100 Züge, ohne Zeitnot", "patzer_je_100_ohne_zeitnot", ""), ("Patzer je 100 Züge, in Zeitnot", "patzer_je_100_in_zeitnot", ""),
            ("Züge in Zeitnot", "zeitnot_anteil_zuege_pct", " %"), ("Gegner: Patzer je 100 Züge", "gegner_patzer_je_100", ""),
            ("Zeitverluste", "zeitverluste", ""), ("… davon nicht verloren", "zeitverluste_nicht_verloren", "")]
    for speed in ("blitz", "bullet"):
        w = rep["tempi"].get(speed)
        if not w:
            continue
        lines.append(f"\n{speed.upper()}  Wertung: " + ", ".join(f"{p} {r['von']} → {r['bis']}" for p, r in w["wertung"].items()))
        lines.append(f"{'':34} {'7 Tage':>8} {'davor':>8} {'4 Wo.':>8}")
        for label, k, unit in rows:
            vals = [fmt((w[z] or {}).get(k), unit) for z in ("woche", "vorwoche", "vier_wochen_schnitt")]
            lines.append(f"{label:34} {vals[0]:>8} {vals[1]:>8} {vals[2]:>8}")
    return "\n".join(lines)


def avg(groups):
    """Schnitt mehrerer Wochen: Mittel der Kennzahlen über Wochen mit Partien, Partien als Summe je Woche"""
    xs = [g for g in groups if g]
    if not xs:
        return None
    out = {}
    for k in xs[0]:
        vals = [x[k] for x in xs if x.get(k) is not None]
        out[k] = round(statistics.mean(vals), 1) if vals else None
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--nodes", type=int, default=40000)
    args = ap.parse_args()
    now = time.time()
    games = fetch(now - 42 * DAY)
    DATA.mkdir(exist_ok=True)
    cache_path = DATA / "weekly_evals.jsonl"
    evals = {}
    if cache_path.exists():
        for line in cache_path.open():
            r = json.loads(line)
            evals[r["key"]] = r["ev"]
    todo = [g for g in games if g["key"] not in evals]
    print(f"{len(games)} Partien in 6 Wochen, {len(todo)} neu zu bewerten ...", flush=True)
    if todo:
        with mp.Pool(args.workers, initializer=_init, initargs=(args.nodes,)) as pool, cache_path.open("a") as f:
            for key, ev in pool.imap_unordered(_evaluate, todo, chunksize=2):
                evals[key] = ev
                f.write(json.dumps({"key": key, "ev": ev}) + "\n")
    rep = {"stand": dt.date.today().isoformat(), "tempi": {}}
    for speed in ("blitz", "bullet"):
        gs = [g for g in games if g["speed"] == speed]
        win = lambda a, b: [g for g in gs if now - b * DAY <= g["end_ts"] < now - a * DAY]
        week, prev = win(0, 7), win(7, 14)
        earlier = [stats(win(7 * k, 7 * k + 7), evals) for k in range(2, 6)]
        rep["tempi"][speed] = {"woche": stats(week, evals), "vorwoche": stats(prev, evals), "vier_wochen_schnitt": avg(earlier),
                               "wertung": ratings(week)}
    out = DATA / "weekly_games"
    out.mkdir(exist_ok=True)
    (out / f"{rep['stand']}.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1))
    print(text_report(rep))


if __name__ == "__main__":
    main()
