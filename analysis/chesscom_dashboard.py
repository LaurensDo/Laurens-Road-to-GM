"""Daten für das Dashboard "Road to GM Blitz": chess.com, Blitz 3+0, eine Zeile je Kalenderwoche, dazu der Wertungsverlauf.

Laurens am 10.11.2026: nur chess.com, Blitz (sein Hauptziel, dort lernt er am meisten), wöchentlich als Dashboard mit Durchschnittswerten und
Verlauf. Relative Werte (je Partie, je 100 Züge, in %), weil die Zahl der Partien je Woche stark schwankt; absolut nur Partien und Wertung.

Schreibt nach data/dashboard/:
  weeks.csv    je Woche (Montag bis Sonntag, die laufende mit partial=1) der letzten 12 Wochen, nur 3+0:
               games, score_pct, rating_end, rating_change, clock20_s, budget20_pct, clock30_s, budget30_pct, pauses_per_game,
               blunders_per100 (ohne Zeitnot), blunders_tt_per100 (in Zeitnot), tt_moves_pct, opp_blunders_per100,
               timeouts_per100, timeouts_notlost_per100 (Zeitverluste in nicht verlorener Stellung je 100 Partien)
  rating.csv   chess.com-Blitzwertung am Ende jeder Woche seit dem ersten Blitzspiel (alle Blitz-Tempi, eine Wertung)
Maßstäbe wie in weekly_games.py (Budget 2:00 bei Zug 20, 1:20 bei Zug 30; Denkpause ab 10 s in Zug 15 bis 35; Patzer: Gewinnchance −30).
Abgeschlossene Monatsarchive liegen in data/chesscom_archives/, Bewertungen in data/weekly_evals.jsonl (wie weekly_games.py).

Aufruf: python analysis/chesscom_dashboard.py [--weeks 12] [--workers 3]
"""

import argparse
import csv
import datetime as dt
import json
import multiprocessing as mp
import time

import fetch_games as fg
from weekly_games import CHESSCOM, DATA, _evaluate, _init, stats

ARCH = DATA / "chesscom_archives"
OUT = DATA / "dashboard"
DRAW_RESULTS = ("agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient")


def archive(url, current):
    """Monatsarchiv; abgeschlossene Monate kommen aus dem Zwischenspeicher."""
    y, m = url.rstrip("/").split("/")[-2:]
    path = ARCH / f"{y}-{m}.json"
    if path.exists() and not current:
        return json.loads(path.read_text())
    data = json.loads(fg.http_get(url))
    if not current:
        path.write_text(json.dumps(data))
    time.sleep(0.3)
    return data


def games_all():
    ARCH.mkdir(parents=True, exist_ok=True)
    urls = json.loads(fg.http_get(f"https://api.chess.com/pub/player/{CHESSCOM}/games/archives"))["archives"]
    today = dt.date.today()
    recent = {f"{today.year}/{today.month:02d}", f"{(today.replace(day=1) - dt.timedelta(days=1)):%Y/%m}"}
    out = []
    for url in urls:
        for g in archive(url, url[-7:] in recent).get("games", []):
            if g.get("rules") != "chess" or g.get("time_class") != "blitz" or not g.get("pgn"):
                continue
            color = "white" if g["white"]["username"].lower() == CHESSCOM.lower() else "black"
            me = g[color]
            res = me.get("result")
            out.append({"key": f"chesscom:{g['url'].rsplit('/', 1)[-1]}", "tc": g.get("time_control"), "end_ts": g["end_time"], "color": color,
                        "rating": me.get("rating"), "pgn": g["pgn"], "res": res,
                        "result": 1.0 if res == "win" else 0.5 if res in DRAW_RESULTS else 0.0})
    return sorted(out, key=lambda g: g["end_ts"])


def monday(ts):
    d = dt.datetime.fromtimestamp(ts).date()
    return d - dt.timedelta(days=d.weekday())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weeks", type=int, default=12)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--nodes", type=int, default=40000)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    blitz = games_all()

    # Wertungsverlauf: letzte Wertung je Woche, alle Blitz-Tempi (chess.com führt eine Blitzwertung)
    weekly = {}
    for g in blitz:
        if g["rating"]:
            w = monday(g["end_ts"])
            weekly.setdefault(w, {"rating": None, "games": 0})
            weekly[w]["rating"] = g["rating"]
            weekly[w]["games"] += 1
    with (OUT / "rating.csv").open("w", newline="") as f:
        wr = csv.writer(f, lineterminator="\n")
        wr.writerow(["week", "rating", "games"])
        for w in sorted(weekly):
            wr.writerow([w.isoformat(), weekly[w]["rating"], weekly[w]["games"]])

    # Kennzahlen: nur 3+0, letzte N Wochen
    this_monday = monday(time.time())
    first = this_monday - dt.timedelta(weeks=args.weeks - 1)
    games = []
    for g in blitz:
        if g["tc"] != "180" or monday(g["end_ts"]) < first:
            continue
        _h, moves = fg.moves_with_clocks(g["pgn"])
        if moves:
            games.append({**g, "platform": "chesscom", "speed": "blitz", "base": 180, "inc": 0, "moves": moves,
                          "timeout": g["result"] == 0.0 and g["res"] == "timeout"})
    evals = {}
    cache = DATA / "weekly_evals.jsonl"
    if cache.exists():
        for line in cache.open():
            r = json.loads(line)
            evals[r["key"]] = r["ev"]
    todo = [g for g in games if g["key"] not in evals]
    print(f"{len(games)} Partien 3+0 in {args.weeks} Wochen, {len(todo)} neu zu bewerten ...", flush=True)
    if todo:
        with mp.Pool(args.workers, initializer=_init, initargs=(args.nodes,)) as pool, cache.open("a") as f:
            for key, ev in pool.imap_unordered(_evaluate, [{"key": g["key"], "moves": g["moves"]} for g in todo], chunksize=2):
                evals[key] = ev
                f.write(json.dumps({"key": key, "ev": ev}) + "\n")

    cols = ["week", "partial", "games", "score_pct", "rating_end", "rating_change", "clock20_s", "budget20_pct", "clock30_s", "budget30_pct",
            "pauses_per_game", "blunders_per100", "blunders_tt_per100", "tt_moves_pct", "opp_blunders_per100", "timeouts_per100",
            "timeouts_notlost_per100", "wins", "draws", "losses", "timeouts", "timeouts_notlost", "n20", "ok20", "n30", "ok30",
            "moves", "blunders", "moves_tt", "blunders_tt", "opp_moves", "opp_blunders"]
    prev_rating = None
    rows = []
    for k in range(args.weeks):
        w = first + dt.timedelta(weeks=k)
        gs = [g for g in games if monday(g["end_ts"]) == w]
        before = [x["rating"] for x in blitz if monday(x["end_ts"]) < w and x["rating"]]
        prev_rating = before[-1] if before else prev_rating
        s = stats(gs, evals) or {}
        n = s.get("partien", 0)
        end = weekly.get(w, {}).get("rating")
        rows.append({
            # sonntags (Lauf am Abend) zählt die laufende Woche als abgeschlossen
            "week": w.isoformat(), "partial": int(w == this_monday and dt.date.today().weekday() < 6), "games": n,
            "score_pct": s.get("punkte_pct"), "rating_end": end, "rating_change": (end - prev_rating) if end and prev_rating else None,
            "clock20_s": s.get("uhr_zug20_median_s"), "budget20_pct": s.get("uhr_zug20_im_budget_pct"),
            "clock30_s": s.get("uhr_zug30_median_s"), "budget30_pct": s.get("uhr_zug30_im_budget_pct"),
            "pauses_per_game": s.get("denkpausen_je_partie"), "blunders_per100": s.get("patzer_je_100_ohne_zeitnot"),
            "blunders_tt_per100": s.get("patzer_je_100_in_zeitnot"), "tt_moves_pct": s.get("zeitnot_anteil_zuege_pct"),
            "opp_blunders_per100": s.get("gegner_patzer_je_100"),
            "timeouts_per100": round(100 * s["zeitverluste"] / n, 1) if n else None,
            "timeouts_notlost_per100": round(100 * s["zeitverluste_nicht_verloren"] / n, 1) if n else None,
            # Zählwerte hinter den Quoten (für "in 6 von 64 Partien")
            "wins": s.get("siege"), "draws": s.get("remis"), "losses": s.get("niederlagen"),
            "timeouts": s.get("zeitverluste"), "timeouts_notlost": s.get("zeitverluste_nicht_verloren"),
            "n20": s.get("n_zug20"), "ok20": s.get("ok_zug20"), "n30": s.get("n_zug30"), "ok30": s.get("ok_zug30"),
            "moves": s.get("zuege_ohne_zeitnot"), "blunders": s.get("patzer_ohne_zeitnot"),
            "moves_tt": s.get("zuege_in_zeitnot"), "blunders_tt": s.get("patzer_in_zeitnot"),
            "opp_moves": s.get("gegner_zuege"), "opp_blunders": s.get("gegner_patzer"),
        })
    with (OUT / "weeks.csv").open("w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
        wr.writeheader()
        for r in rows:
            wr.writerow({c: ("" if r[c] is None else r[c]) for c in cols})
    for r in rows:
        print(r["week"], r["games"], r["score_pct"], r["rating_end"], r["budget20_pct"], r["budget30_pct"], r["blunders_per100"], r["timeouts_notlost_per100"])


if __name__ == "__main__":
    main()
