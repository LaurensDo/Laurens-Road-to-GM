"""Erzeugt aus Rohpartien + Engine-Analyse den Diagnose-Report.

Aufruf:
    python analysis/report.py

Liest  data/games_raw.jsonl, data/analysis.jsonl
Schreibt data/report.json            (alle Kennzahlen für die Report-Seite)
         data/training_positions.json (eigene Fehlerstellungen als Übungsmaterial)
"""

import collections
import datetime as dt
import json
import logging
import math
import os
import sys
import statistics as st
from pathlib import Path
from zoneinfo import ZoneInfo

import chess
import chess.pgn

DATA = Path(__file__).resolve().parent.parent / "data"
TZ = ZoneInfo("Europe/Berlin")
VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
MATE_CP = 9000

# Schwellen in Gewinnprozent-Punkten (wie lichess)
INACCURACY, MISTAKE, BLUNDER = 10, 20, 30

CATEGORIES = [
    "Zeit abgelaufen",
    "Figur eingestellt",
    "Matt übersehen",
    "Gegnerische Taktik übersehen",
    "Gegnerfehler nicht bestraft",
    "Positioneller Fehler",
    "Kleine Ungenauigkeit",
]
TACTIC_CATS = ("Gegnerische Taktik übersehen", "Matt übersehen")


# ---------------------------------------------------------------- Grundlagen

def win_pct(cp):
    """Gewinnwahrscheinlichkeit (0–100) aus Centipawns, Formel von lichess."""
    if cp is None:
        return None
    if abs(cp) >= MATE_CP:
        return 100.0 if cp > 0 else 0.0
    cp = max(-1000, min(1000, cp))
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


def material(board, color):
    return sum(VALUES[p.piece_type] for p in board.piece_map().values() if p.color == color)


def balance(board, color):
    return material(board, color) - material(board, not color)


def piece_count(board):
    return sum(1 for p in board.piece_map().values() if p.piece_type not in (chess.PAWN, chess.KING))


def phase_of(board, fullmove):
    if piece_count(board) <= 6:
        return "Endspiel"
    if fullmove <= 12:
        return "Eröffnung"
    return "Mittelspiel"


def endgame_type(board):
    kinds = {p.piece_type for p in board.piece_map().values() if p.piece_type not in (chess.PAWN, chess.KING)}
    if not kinds:
        return "Bauernendspiel"
    if kinds == {chess.ROOK}:
        return "Turmendspiel"
    if kinds <= {chess.KNIGHT, chess.BISHOP}:
        return "Leichtfigurenendspiel"
    if kinds == {chess.QUEEN}:
        return "Damenendspiel"
    if chess.QUEEN in kinds:
        return "Damen + weitere Figuren"
    return "Turm + Leichtfigur(en)"


OPENINGS_URL = "https://raw.githubusercontent.com/lichess-org/chess-openings/master/{}.tsv"
OPENINGS_LOCAL = DATA.parent.parent / "lichess-org" / "chess-openings"


def load_openings():
    """EPD -> (ECO, Name) aus dem offenen Eröffnungskatalog von lichess (CC0)."""
    cache = DATA / "openings"
    cache.mkdir(exist_ok=True)
    book = {}
    for part in "abcde":
        local = OPENINGS_LOCAL / f"{part}.tsv"
        cached = cache / f"{part}.tsv"
        if local.exists():
            text = local.read_text()
        elif cached.exists():
            text = cached.read_text()
        else:
            import urllib.request
            text = urllib.request.urlopen(OPENINGS_URL.format(part), timeout=60).read().decode()
            cached.write_text(text)
        for line in text.splitlines()[1:]:
            eco, name, pgn = line.split("\t")
            board = chess.Board()
            for tok in pgn.split():
                if tok.endswith("."):
                    continue
                board.push_san(tok)
            book[board.epd()] = (eco, name)
    return book


def name_opening(moves, book):
    """Tiefster bekannter Katalogeintrag entlang der ersten 30 Halbzüge."""
    board = chess.Board()
    best = None
    for uci, _ in moves[:30]:
        board.push_uci(uci)
        hit = book.get(board.epd())
        if hit:
            best = hit
    return best


def opening_family(name):
    """Katalognamen haben die Form "Familie: Variante, Untervariante"."""
    return name.split(":")[0] if name else "Unbekannt"


def time_trouble_limit(base):
    return 20 if base <= 180 else 30


# ---------------------------------------------------------------- Motive (lichess-Tagger)

# Der Motiv-Tagger von lichess (https://github.com/ornicar/lichess-puzzler, AGPL-3.0) wird
# als separater Checkout eingebunden, nicht ins Repo kopiert. Ohne ihn greift die einfache
# eigene Erkennung weiter unten.
# Gesucht wird neben dem Repo-Ordner (../ornicar/lichess-puzzler) oder über LICHESS_TAGGER.
TAGGER_DIR = Path(os.environ.get("LICHESS_TAGGER", DATA.parent.parent / "ornicar" / "lichess-puzzler" / "tagger"))
try:
    sys.path.insert(0, str(TAGGER_DIR))
    import cook as _cook  # noqa: E402
    from model import Puzzle as _Puzzle  # noqa: E402
    logging.getLogger("cook").setLevel(logging.WARNING)
except ImportError:
    _cook = None

# Motive, die im Report auftauchen: lichess-Schlüssel -> deutscher Name
THEMES = {
    "hangingPiece": "Hängende Figur", "fork": "Gabel", "pin": "Fesselung", "skewer": "Spieß",
    "discoveredAttack": "Abzugsangriff", "doubleCheck": "Doppelschach", "deflection": "Ablenkung",
    "attraction": "Hinlenkung", "overloading": "Überlastung", "trappedPiece": "Gefangene Figur",
    "xRayAttack": "Röntgenangriff", "capturingDefender": "Verteidiger schlagen", "intermezzo": "Zwischenzug",
    "clearance": "Linienräumung", "interference": "Unterbrechung", "quietMove": "Stiller Zug",
    "sacrifice": "Opfer", "exposedKing": "Ungeschützter König", "kingsideAttack": "Königsangriff",
    "advancedPawn": "Vorgerückter Bauer", "promotion": "Umwandlung", "attackingF2F7": "Angriff auf f2/f7",
    "mateIn1": "Matt in 1", "mateIn2": "Matt in 2", "mateIn3": "Matt in 3", "backRankMate": "Grundreihenmatt",
    "smotheredMate": "Ersticktes Matt", "defensiveMove": "Verteidigungszug",
}


def trim_line(board, pv, punisher):
    """Kürzt eine Engine-Variante wie ein Puzzle: endet mit dem Zug des Angreifers,
    der den größten Materialgewinn (oder Matt) erreicht."""
    b = board.copy(stack=False)
    start = balance(b, punisher)
    best_gain, cut = None, 0
    for i, mv in enumerate(pv):
        try:
            m = chess.Move.from_uci(mv)
        except ValueError:
            break
        if m not in b.legal_moves:
            break
        b.push(m)
        if b.is_checkmate():
            return pv[: i + 1]
        if i % 2 == 0:
            gain = balance(b, punisher) - start
            if best_gain is None or gain > best_gain:
                best_gain, cut = gain, i + 1
    return pv[:cut]


def lichess_tags(board, setup_move, pv, cp):
    """Motive nach lichess-Puzzle-Logik für: Ausgangsstellung -> Fehlerzug -> Bestrafung."""
    if _cook is None:
        return None
    after = board.copy(stack=False)
    after.push(setup_move)
    line = trim_line(after, pv, after.turn)
    if not line:
        return []
    # Ohne Zugstapel: from_board würde sonst die ganze Partie ab Zug 1 übernehmen
    game = chess.pgn.Game.from_board(chess.Board(board.fen()))
    node = game.add_variation(setup_move)
    for mv in line:
        node = node.add_variation(chess.Move.from_uci(mv))
    try:
        tags = _cook.cook(_Puzzle("x", game, min(abs(cp), 1000)))
    except Exception:
        return []
    return [t for t in tags if t in THEMES]


# ---------------------------------------------------------------- Motive (eigene Erkennung)

def line_net_loss(board, pv, victim):
    """Materialverlust (Bauerneinheiten) für `victim`, wenn die Variante gespielt wird.
    Konservativ: nimmt den besseren der beiden letzten Stände (kein halber Abtausch)."""
    b = board.copy(stack=False)
    start = balance(b, victim)
    vals = [start]
    for mv in pv:
        try:
            b.push(chess.Move.from_uci(mv))
        except (ValueError, AssertionError):
            break
        vals.append(balance(b, victim))
    tail = vals[-2:] if len(vals) >= 2 else vals
    return start - max(tail), b


def is_hanging_capture(board, move, victim):
    if not board.is_capture(move) or board.is_en_passant(move):
        return False
    target = board.piece_at(move.to_square)
    attacker = board.piece_at(move.from_square)
    if target is None or attacker is None or VALUES[target.piece_type] < 3:
        return False
    defended = bool(board.attackers(victim, move.to_square))
    return (not defended) or VALUES[attacker.piece_type] < VALUES[target.piece_type]


def valuable_targets(board, sq, attacker_color):
    """Gegnerische Figuren, die die Figur auf `sq` sinnvoll angreift."""
    piece = board.piece_at(sq)
    out = []
    for t in board.attacks(sq):
        tp = board.piece_at(t)
        if tp is None or tp.color == attacker_color:
            continue
        if tp.piece_type == chess.KING:
            out.append(t)
        elif VALUES[tp.piece_type] >= 3 and (
            VALUES[tp.piece_type] > VALUES[piece.piece_type] or not board.attackers(not attacker_color, t)
        ):
            out.append(t)
    return out


def motifs_in_line(board, pv, punisher):
    """Erkennt einfache taktische Motive in einer Engine-Variante aus Sicht des `punisher`."""
    tags = []
    b = board.copy(stack=False)
    victim = not punisher
    punisher_moves = 0
    for i, mv in enumerate(pv):
        try:
            move = chess.Move.from_uci(mv)
        except ValueError:
            break
        if move not in b.legal_moves:
            break
        if b.turn == punisher:
            punisher_moves += 1
            if punisher_moves > 3:
                break
            if i == 0 and is_hanging_capture(b, move, victim):
                tags.append("Hängende Figur")
            # Sliding-Angriffe vor dem Zug (für Abzug)
            before = {}
            for sq, p in b.piece_map().items():
                if p.color == punisher and p.piece_type in (chess.BISHOP, chess.ROOK, chess.QUEEN) and sq != move.from_square:
                    before[sq] = set(b.attacks(sq))
            b.push(move)
            to = move.to_square
            # Gabel / Doppelangriff
            if len(valuable_targets(b, to, punisher)) >= 2:
                tags.append("Gabel / Doppelangriff")
            # Abzugsangriff
            for sq, att in before.items():
                if b.piece_at(sq) is None:
                    continue
                new = set(b.attacks(sq)) - att
                for t in new:
                    tp = b.piece_at(t)
                    if tp and tp.color == victim and tp.piece_type in (chess.KING, chess.QUEEN, chess.ROOK):
                        tags.append("Abzugsangriff")
                        break
            # Fesselung durch die gezogene Figur
            for sq, p in b.piece_map().items():
                if p.color == victim and p.piece_type != chess.KING and b.is_pinned(victim, sq):
                    if to in b.pin(victim, sq) and VALUES[p.piece_type] >= 3:
                        tags.append("Fesselung")
                        break
            # Spieß: Langschrittler greift K/D an, dahinter steht eine weitere Figur
            mp = b.piece_at(to)
            if mp and mp.piece_type in (chess.BISHOP, chess.ROOK, chess.QUEEN):
                for t in b.attacks(to):
                    tp = b.piece_at(t)
                    if tp and tp.color == victim and tp.piece_type in (chess.KING, chess.QUEEN):
                        df = chess.square_file(t) - chess.square_file(to)
                        dr = chess.square_rank(t) - chess.square_rank(to)
                        step_f = (df > 0) - (df < 0)
                        step_r = (dr > 0) - (dr < 0)
                        f, r = chess.square_file(t) + step_f, chess.square_rank(t) + step_r
                        while 0 <= f < 8 and 0 <= r < 8:
                            behind = b.piece_at(chess.square(f, r))
                            if behind:
                                if behind.color == victim and VALUES[behind.piece_type] >= 3 and behind.piece_type != chess.KING:
                                    tags.append("Spieß")
                                break
                            f += step_f
                            r += step_r
        else:
            b.push(move)
        if b.is_checkmate():
            king = b.king(victim)
            back = 0 if victim == chess.WHITE else 7
            last = b.peek()
            mover = b.piece_at(last.to_square)
            if (
                king is not None
                and chess.square_rank(king) == back
                and mover
                and mover.piece_type in (chess.ROOK, chess.QUEEN)
                and chess.square_rank(last.to_square) == back
            ):
                tags.append("Grundreihenmatt")
            else:
                tags.append("Mattangriff")
            break
    # Reihenfolge: das aussagekräftigste Motiv zuerst
    order = ["Grundreihenmatt", "Mattangriff", "Gabel / Doppelangriff", "Fesselung", "Spieß", "Abzugsangriff", "Hängende Figur"]
    uniq = [t for t in order if t in tags]
    return uniq


# ---------------------------------------------------------------- Pro Partie

def walk_game(raw, ana):
    """Liefert eine Liste von Zug-Datensätzen (beide Seiten) mit allen Merkmalen."""
    me = chess.WHITE if raw["color"] == "white" else chess.BLACK
    base, inc = raw["base"], raw["inc"] or 0
    plies = ana["plies"]
    board = chess.Board()
    clocks = {chess.WHITE: float(base), chess.BLACK: float(base)}
    out = []
    last_loss_of = {}
    prev_board, prev_move = None, None
    for i, (uci, clk) in enumerate(raw["moves"]):
        entry = plies[i] if i < len(plies) else {}
        mover = board.turn
        move = chess.Move.from_uci(uci)
        cp_before = entry.get("cp")
        cp_after = plies[i + 1].get("cp") if i + 1 < len(plies) else ana.get("final_cp")
        if cp_before is None or cp_after is None:
            prev_board, prev_move = board.copy(stack=False), move
            board.push(move)
            continue
        sign = 1 if mover == chess.WHITE else -1
        wp_before = win_pct(sign * cp_before)
        wp_after = win_pct(sign * cp_after)
        loss = max(0.0, wp_before - wp_after)
        crit = None
        if "cp2" in entry:
            crit = wp_before - win_pct(sign * entry["cp2"])
        clock_before = clocks[mover]
        spent = None
        if clk is not None:
            spent = max(0.0, clock_before - clk + (inc if i >= 2 else 0))
            clocks[mover] = clk
        rec = {
            "ply": i,
            "mover_is_me": mover == me,
            "fullmove": board.fullmove_number,
            "phase": phase_of(board, board.fullmove_number),
            "wp_before": wp_before,
            "wp_after": wp_after,
            "loss": loss,
            "crit": crit,
            "clock": clock_before,
            "spent": spent,
            "time_trouble": clock_before < time_trouble_limit(base),
            "opp_prev_loss": last_loss_of.get(not mover, 0.0) if i > 0 else 0.0,
        }
        if loss >= MISTAKE:
            board_after = board.copy(stack=False)
            board_after.push(move)
            refutation = plies[i + 1].get("pv", []) if i + 1 < len(plies) else []
            net, _ = line_net_loss(board_after, refutation, mover)
            mate_against = cp_after is not None and abs(cp_after) >= MATE_CP and (sign * cp_after) < 0 and not (
                abs(cp_before) >= MATE_CP and sign * cp_before < 0
            )
            first_reply = chess.Move.from_uci(refutation[0]) if refutation else None
            hanging = (
                first_reply is not None
                and first_reply in board_after.legal_moves
                and is_hanging_capture(board_after, first_reply, mover)
                and net >= 2
            )
            missed_punish = rec["opp_prev_loss"] >= MISTAKE
            if mate_against:
                cat = "Matt übersehen"
            elif hanging:
                cat = "Figur eingestellt"
            elif net >= 2:
                cat = "Gegnerische Taktik übersehen"
            elif missed_punish:
                cat = "Gegnerfehler nicht bestraft"
            else:
                cat = "Positioneller Fehler"
            rec["cat"] = cat
            rec["motifs"] = motifs_in_line(board_after, refutation, not mover) if cat in TACTIC_CATS else []
            if missed_punish:
                rec["missed_motifs"] = motifs_in_line(board, entry.get("pv", []), mover)
            if cat in ("Figur eingestellt", "Gegnerische Taktik übersehen", "Matt übersehen"):
                rec["lt"] = lichess_tags(board, move, refutation, cp_after)
            if missed_punish and prev_board is not None:
                rec["lt_missed"] = lichess_tags(prev_board, prev_move, entry.get("pv", []), cp_before)
            rec["fen"] = board.fen()
            rec["epd"] = board.epd()
            rec["san"] = board.san(move)
            rec["uci"] = uci
            rec["best_uci"] = entry.get("best")
            best = entry.get("best")
            try:
                rec["best_san"] = board.san(chess.Move.from_uci(best)) if best else None
                rec["pv_san"] = board.variation_san([chess.Move.from_uci(m) for m in entry.get("pv", [])[:6]])
            except (ValueError, AssertionError):
                rec["best_san"], rec["pv_san"] = None, None
        elif loss >= INACCURACY:
            rec["cat"] = "Kleine Ungenauigkeit"
        if rec["phase"] == "Eröffnung" and mover == me:
            rec["epd"] = board.epd()
            rec["san"] = board.san(move)
            rec["uci"] = uci
            rec["best_uci"] = entry.get("best")
            best = entry.get("best")
            try:
                rec["best_san"] = board.san(chess.Move.from_uci(best)) if best else None
            except (ValueError, AssertionError):
                rec["best_san"] = None
            rec["fen"] = board.fen()
        if piece_count(board) <= 6:
            rec["eg_type"] = endgame_type(board)
        last_loss_of[mover] = loss
        out.append(rec)
        prev_board, prev_move = board.copy(stack=False), move
        board.push(move)
    return out


# ---------------------------------------------------------------- Aggregation

def expected(g):
    return 1 / (1 + 10 ** ((g["opp_rating"] - g["my_rating"]) / 400))


def pct(a, b):
    return round(100 * a / b, 1) if b else None


def mean(xs):
    xs = [x for x in xs if x is not None]
    return round(st.mean(xs), 2) if xs else None


def main():
    raw = {}
    for line in (DATA / "games_raw.jsonl").open():
        g = json.loads(line)
        raw[(g["platform"], g["id"])] = g
    analyses = [json.loads(l) for l in (DATA / "analysis.jsonl").open()]

    book = load_openings()
    games = []
    for a in analyses:
        g = raw[(a["platform"], a["id"])]
        hit = name_opening(g["moves"], book)
        if hit:
            g["eco"], g["opening"] = hit
        g["recs"] = walk_game(g, a)
        if g["recs"]:
            games.append(g)
    games.sort(key=lambda g: g["end_ts"])
    n_games = len(games)
    my_recs = [r for g in games for r in g["recs"] if r["mover_is_me"]]
    opp_recs = [r for g in games for r in g["recs"] if not r["mover_is_me"]]

    report = {"generated": dt.datetime.now(TZ).isoformat(timespec="minutes"), "n_games": n_games}
    report["period"] = [
        dt.datetime.fromtimestamp(games[0]["end_ts"], TZ).date().isoformat(),
        dt.datetime.fromtimestamp(games[-1]["end_ts"], TZ).date().isoformat(),
    ]
    report["platforms"] = collections.Counter(g["platform"] for g in games)
    report["time_controls"] = collections.Counter(f"{g['base'] // 60}+{g['inc']}" for g in games)
    report["score"] = round(st.mean(g["result"] for g in games), 3)

    # ---- Punkte-Verlust nach Kategorie (Summe der verlorenen Gewinnprozente)
    by_cat = collections.Counter()
    by_cat_phase = collections.defaultdict(collections.Counter)
    for g in games:
        for r in g["recs"]:
            if r["mover_is_me"] and r.get("cat") and r["loss"] >= INACCURACY:
                by_cat[r["cat"]] += r["loss"]
                by_cat_phase[r["cat"]][r["phase"]] += r["loss"]
        if g["result"] == 0 and g["termination"] in ("timeout", "outoftime"):
            last_me = [r for r in g["recs"] if r["mover_is_me"]]
            wp_end = last_me[-1]["wp_after"] if last_me else 50
            by_cat["Zeit abgelaufen"] += wp_end
            by_cat_phase["Zeit abgelaufen"][last_me[-1]["phase"] if last_me else "Mittelspiel"] += wp_end
    total = sum(by_cat.values())
    report["loss_by_category"] = [
        {"cat": c, "share": pct(by_cat[c], total), "per_game": round(by_cat[c] / n_games / 100, 3),
         "by_phase": {p: pct(v, by_cat[c]) for p, v in by_cat_phase[c].items()}}
        for c in CATEGORIES
    ]
    phase_tot = collections.Counter()
    for c in by_cat_phase:
        for p, v in by_cat_phase[c].items():
            phase_tot[p] += v
    report["loss_by_phase"] = {p: pct(v, total) for p, v in phase_tot.items()}

    # ---- Benchmark: du vs. Gegner (gleiche Partien)
    def rates(recs, gs):
        moves = len(recs)
        bl = [r for r in recs if r["loss"] >= BLUNDER]
        out = {
            "moves": moves,
            "blunders_per_100": round(100 * len(bl) / moves, 2),
            "mistakes_per_100": round(100 * sum(1 for r in recs if r["loss"] >= MISTAKE) / moves, 2),
            "hung_piece_per_game": round(sum(1 for r in recs if r.get("cat") == "Figur eingestellt") / len(gs), 3),
            "avg_loss": round(st.mean(r["loss"] for r in recs), 2),
        }
        for ph in ("Eröffnung", "Mittelspiel", "Endspiel"):
            pr = [r for r in recs if r["phase"] == ph]
            out[f"blunders_per_100_{ph}"] = round(100 * sum(1 for r in pr if r["loss"] >= BLUNDER) / len(pr), 2) if pr else None
            out[f"avg_loss_{ph}"] = round(st.mean(r["loss"] for r in pr), 2) if pr else None
        nt = [r for r in recs if not r["time_trouble"]]
        tt = [r for r in recs if r["time_trouble"]]
        out["blunders_per_100_no_tt"] = round(100 * sum(1 for r in nt if r["loss"] >= BLUNDER) / len(nt), 2)
        out["blunders_per_100_tt"] = round(100 * sum(1 for r in tt if r["loss"] >= BLUNDER) / len(tt), 2) if tt else None
        return out

    report["benchmark"] = {"me": rates(my_recs, games), "opp": rates(opp_recs, games)}
    report["timeouts"] = {
        "lost_on_time": sum(1 for g in games if g["result"] == 0 and g["termination"] in ("timeout", "outoftime")),
        "won_on_time": sum(1 for g in games if g["result"] == 1 and g["termination"] in ("timeout", "outoftime")),
        "losses": sum(1 for g in games if g["result"] == 0),
    }
    lot = []
    for g in games:
        if g["result"] == 0 and g["termination"] in ("timeout", "outoftime"):
            last_me = [r for r in g["recs"] if r["mover_is_me"]]
            if last_me:
                lot.append(last_me[-1]["wp_after"])
    report["timeouts"]["lost_on_time_winning"] = sum(1 for w in lot if w >= 70)
    report["timeouts"]["lost_on_time_equal"] = sum(1 for w in lot if 30 <= w < 70)
    report["timeouts"]["lost_on_time_losing"] = sum(1 for w in lot if w < 30)

    # ---- Uhr: Restzeit nach Zugnummer, du vs. Gegner (nur 3+0)
    clock_curve = {}
    for mvno in (5, 10, 15, 20, 25, 30, 35, 40):
        mine, theirs = [], []
        for g in games:
            if g["base"] != 180 or g["inc"]:
                continue
            for r in g["recs"]:
                if r["fullmove"] == mvno:
                    (mine if r["mover_is_me"] else theirs).append(r["clock"])
        if len(mine) >= 30:
            clock_curve[mvno] = {"me": mean(mine), "opp": mean(theirs), "n": len(mine)}
    report["clock_curve_3_0"] = clock_curve

    # Zeit pro Zug nach Phase und Kritikalität
    def spent_stats(recs):
        return {"avg": mean(r["spent"] for r in recs), "n": len(recs)}

    crit = [r for r in my_recs if r["crit"] is not None and r["crit"] >= 20 and not r["time_trouble"]]
    easy = [r for r in my_recs if r["crit"] is not None and r["crit"] < 5 and not r["time_trouble"]]
    report["time_use"] = {
        "by_phase": {ph: spent_stats([r for r in my_recs if r["phase"] == ph and not r["time_trouble"]])
                     for ph in ("Eröffnung", "Mittelspiel", "Endspiel")},
        "opp_by_phase": {ph: spent_stats([r for r in opp_recs if r["phase"] == ph and not r["time_trouble"]])
                         for ph in ("Eröffnung", "Mittelspiel", "Endspiel")},
        "critical": spent_stats(crit),
        "easy": spent_stats(easy),
    }
    # Fehlerquote in kritischen Stellungen nach Bedenkzeit
    buckets = [("< 2 s", 0, 2), ("2–5 s", 2, 5), ("5–10 s", 5, 10), ("> 10 s", 10, 1e9)]
    report["critical_by_spent"] = []
    for label, lo, hi in buckets:
        rs = [r for r in crit if r["spent"] is not None and lo <= r["spent"] < hi]
        report["critical_by_spent"].append({
            "bucket": label, "n": len(rs), "share_of_critical": pct(len(rs), len(crit)),
            "mistake_rate": pct(sum(1 for r in rs if r["loss"] >= MISTAKE), len(rs)),
        })
    # Fehlerquote nach Restzeit
    clock_b = [("< 10 s", 0, 10), ("10–20 s", 10, 20), ("20–40 s", 20, 40), ("40–80 s", 40, 80), ("> 80 s", 80, 1e9)]
    report["blunder_by_clock"] = []
    for label, lo, hi in clock_b:
        rs = [r for r in my_recs if lo <= r["clock"] < hi]
        os_ = [r for r in opp_recs if lo <= r["clock"] < hi]
        report["blunder_by_clock"].append({
            "bucket": label, "n": len(rs),
            "me": pct(sum(1 for r in rs if r["loss"] >= BLUNDER), len(rs)),
            "opp": pct(sum(1 for r in os_ if r["loss"] >= BLUNDER), len(os_)),
        })
    # Anteil der Fehler (>= MISTAKE) außerhalb Zeitnot, die in < 2 s gespielt wurden
    mist_nt = [r for r in my_recs if r["loss"] >= MISTAKE and not r["time_trouble"] and r["spent"] is not None]
    opp_mist_nt = [r for r in opp_recs if r["loss"] >= MISTAKE and not r["time_trouble"] and r["spent"] is not None]
    report["fast_mistakes"] = {
        "me": pct(sum(1 for r in mist_nt if r["spent"] < 2), len(mist_nt)),
        "opp": pct(sum(1 for r in opp_mist_nt if r["spent"] < 2), len(opp_mist_nt)),
        "n_me": len(mist_nt),
    }

    # ---- Motive (lichess-Themen, mehrere pro Fehler möglich)
    report["motif_source"] = "lichess-puzzler" if _cook is not None else "eigene Erkennung"

    def motif_counts(recs, key_lt, key_old):
        c = collections.Counter()
        for r in recs:
            if r["loss"] < MISTAKE:
                continue
            tags = r.get(key_lt) if _cook is not None else r.get(key_old)
            for t in set(tags or []):
                c[t] += 1
        return c

    def motif_rows(me_c, opp_c):
        rows = []
        for k in set(me_c) | set(opp_c):
            rows.append({"key": k, "motif": THEMES.get(k, k),
                         "me": round(100 * me_c[k] / n_games, 1), "opp": round(100 * opp_c[k] / n_games, 1),
                         "n": me_c[k]})
        rows.sort(key=lambda r: -r["me"])
        return rows

    report["motifs_against_me"] = motif_rows(motif_counts(my_recs, "lt", "motifs"), motif_counts(opp_recs, "lt", "motifs"))
    report["motifs_missed"] = motif_rows(motif_counts(my_recs, "lt_missed", "missed_motifs"),
                                         motif_counts(opp_recs, "lt_missed", "missed_motifs"))
    cats_me = collections.Counter(r["cat"] for r in my_recs if r["loss"] >= MISTAKE)
    cats_opp = collections.Counter(r["cat"] for r in opp_recs if r["loss"] >= MISTAKE)
    report["mistake_types_per_100_games"] = [
        {"cat": c, "me": round(100 * cats_me[c] / n_games, 1), "opp": round(100 * cats_opp[c] / n_games, 1)}
        for c in CATEGORIES[1:]
    ]

    # ---- Eröffnungen
    fam = collections.defaultdict(list)
    for g in games:
        fam[(g["color"], opening_family(g["opening"]))].append(g)
    fam_rows = []
    for (color, name), gs in fam.items():
        if len(gs) < 15:
            continue
        wp12 = []
        oloss = []
        for g in gs:
            r12 = [r for r in g["recs"] if r["mover_is_me"] and r["fullmove"] == 12]
            if r12:
                wp12.append(r12[0]["wp_before"])
            oloss.append(sum(r["loss"] for r in g["recs"] if r["mover_is_me"] and r["phase"] == "Eröffnung") / 100)
        fam_rows.append({
            "color": color, "family": name, "n": len(gs),
            "score": round(st.mean(g["result"] for g in gs), 3),
            "resid": round(st.mean(g["result"] - expected(g) for g in gs), 3),
            "wp_move12": mean(wp12),
            "opening_loss_per_game": round(st.mean(oloss), 3),
        })
    fam_rows.sort(key=lambda r: -r["n"])
    report["opening_families"] = fam_rows

    # Wiederkehrende Eröffnungsfehler: gleiche Stellung, wiederholt ungenau gespielt
    pos = collections.defaultdict(list)
    for g in games:
        for r in g["recs"]:
            if r["mover_is_me"] and r["phase"] == "Eröffnung" and "epd" in r:
                pos[r["epd"]].append((g, r))
    leaks = []
    for epd, items in pos.items():
        bad = [(g, r) for g, r in items if r["loss"] >= 8]
        if len(bad) < 3:
            continue
        moves_played = collections.Counter(r["san"] for _, r in bad)
        leaks.append({
            "fen": bad[0][1]["fen"],
            "seen": len(items),
            "bad": len(bad),
            "total_loss": round(sum(r["loss"] for _, r in bad) / 100, 2),
            "avg_loss": round(st.mean(r["loss"] for _, r in bad), 1),
            "played": moves_played.most_common(3),
            "best": collections.Counter(r["best_san"] for _, r in bad if r.get("best_san")).most_common(1)[0][0],
            "played_uci": {r["san"]: r["uci"] for _, r in bad}[moves_played.most_common(1)[0][0]],
            "best_uci": collections.Counter(r["best_uci"] for _, r in bad if r.get("best_uci")).most_common(1)[0][0],
            "color": bad[0][0]["color"],
            "opening": bad[0][0]["opening"],
            "fullmove": bad[0][1]["fullmove"],
            "example": bad[-1][0]["url"],
        })
    leaks.sort(key=lambda x: -x["total_loss"])
    leaks = leaks[:20]

    # Praxis-Check mit dem lichess Opening Explorer (data/explorer.json, optional):
    # Wie schneiden Spieler deiner Stärke mit deinem Zug und mit dem Engine-Zug ab?
    ex_path = DATA / "explorer.json"
    if ex_path.exists():
        ex = json.loads(ex_path.read_text())
        report["explorer"] = {"bucket": ex["bucket"], "upper": ex["upper"], "lichess_level": ex["lichess_level"]}
        for leak in leaks:
            e = ex["positions"].get(leak["fen"], {}).get("level")
            if not e:
                continue
            by_uci = {m["uci"]: m for m in e["moves"]}
            played, best = by_uci.get(leak["played_uci"]), by_uci.get(leak["best_uci"])
            top = e["moves"][0] if e["moves"] else None
            if played and best:
                diff = best["score"] - played["score"]
                verdict = "bestätigt" if diff >= 2.5 else ("widerspricht" if diff <= -1.0 else "kaum Unterschied")
            else:
                verdict = "selten gespielt"
            leak["explorer"] = {"total": e["total"], "played": played, "best": best, "top": top, "verdict": verdict}
        # In der Praxis bestätigte Lecks zuerst, danach nach Verlust
        order = {"bestätigt": 0, "selten gespielt": 1, "kaum Unterschied": 2, "widerspricht": 3}
        def gap(l):
            e = l.get("explorer") or {}
            return (e["best"]["score"] - e["played"]["score"]) if e.get("best") and e.get("played") else 0

        leaks.sort(key=lambda l: (order.get(l.get("explorer", {}).get("verdict"), 1), -gap(l), -l["total_loss"]))
    report["opening_leaks"] = leaks

    # ---- Endspiele: jeder Endspielzug nach Typ, du vs. Gegner
    def eg_stats(recs):
        nt = [r for r in recs if not r["time_trouble"]]
        return {
            "moves": len(recs),
            "blunders_no_tt": round(100 * sum(1 for r in nt if r["loss"] >= BLUNDER) / len(nt), 2) if nt else None,
            "avg_loss_no_tt": round(st.mean(r["loss"] for r in nt), 2) if nt else None,
            "tt_share": pct(len(recs) - len(nt), len(recs)),
        }

    eg_rows = []
    for t in sorted({r["eg_type"] for r in my_recs if "eg_type" in r}):
        mine = [r for r in my_recs if r.get("eg_type") == t]
        theirs = [r for r in opp_recs if r.get("eg_type") == t]
        if len(mine) < 200:
            continue
        eg_rows.append({"type": t, "me": eg_stats(mine), "opp": eg_stats(theirs),
                        "games": len({id(g) for g in games for r in g["recs"] if r.get("eg_type") == t and r["mover_is_me"]})})
    eg_rows.sort(key=lambda r: -r["me"]["moves"])
    report["endgames"] = eg_rows
    eg_me = [r for r in my_recs if r["phase"] == "Endspiel"]
    eg_opp = [r for r in opp_recs if r["phase"] == "Endspiel"]
    report["endgame_overall"] = {
        "games_reaching": sum(1 for g in games if any("eg_type" in r for r in g["recs"])),
        "me_blunders_per_100_no_tt": pct(sum(1 for r in eg_me if r["loss"] >= BLUNDER and not r["time_trouble"]),
                                         sum(1 for r in eg_me if not r["time_trouble"])),
        "me_blunders_per_100_tt": pct(sum(1 for r in eg_me if r["loss"] >= BLUNDER and r["time_trouble"]),
                                      sum(1 for r in eg_me if r["time_trouble"])),
        "opp_blunders_per_100_no_tt": pct(sum(1 for r in eg_opp if r["loss"] >= BLUNDER and not r["time_trouble"]),
                                          sum(1 for r in eg_opp if not r["time_trouble"])),
        "opp_blunders_per_100_tt": pct(sum(1 for r in eg_opp if r["loss"] >= BLUNDER and r["time_trouble"]),
                                       sum(1 for r in eg_opp if r["time_trouble"])),
        "me_tt_share": pct(sum(1 for r in eg_me if r["time_trouble"]), len(eg_me)),
        "opp_tt_share": pct(sum(1 for r in eg_opp if r["time_trouble"]), len(eg_opp)),
    }

    # ---- Endspieldatenbank (≤ 7 Steine): Züge, die das theoretische Ergebnis verschlechtern
    tb_path = DATA / "tablebase.jsonl"
    if tb_path.exists():
        tb_value = {"win": 1, "cursed-win": 0, "draw": 0, "blessed-loss": 0, "loss": -1}
        by_game = {(g["platform"], g["id"]): g for g in games}
        tb = [json.loads(l) for l in tb_path.open()]
        tb = [t for t in tb if (t["platform"], t["id"]) in by_game]
        known = []
        for t in tb:
            vb, va = tb_value.get(t["before"]), tb_value.get(t["after"])
            if vb is None or va is None:
                continue
            g = by_game[(t["platform"], t["id"])]
            mover = chess.WHITE if g["color"] == "white" else chess.BLACK
            # Restzeit vor dem Zug: Uhr nach dem eigenen vorherigen Zug
            prev = [c for k, (_, c) in enumerate(g["moves"][: t["ply"]]) if k % 2 == t["ply"] % 2 and c is not None]
            clock = prev[-1] if prev else g["base"]
            known.append({**t, "vb": vb, "va": va, "clock": clock,
                          "tt": clock < time_trouble_limit(g["base"]),
                          "eg_type": endgame_type(chess.Board(t["fen"])), "url": g["url"], "color": g["color"],
                          "date": dt.datetime.fromtimestamp(g["end_ts"], TZ).date().isoformat()})
        errs = [k for k in known if k["va"] < k["vb"]]
        kinds = collections.Counter(
            {(1, 0): "Gewinn → Remis", (1, -1): "Gewinn → Verlust", (0, -1): "Remis → Verlust"}[(k["vb"], k["va"])] for k in errs)
        per_type = collections.defaultdict(lambda: {"moves": 0, "errors": 0})
        for k in known:
            per_type[k["eg_type"]]["moves"] += 1
            per_type[k["eg_type"]]["errors"] += k["va"] < k["vb"]
        won_games = {(k["platform"], k["id"]) for k in known if k["vb"] == 1}
        drawn_games = {(k["platform"], k["id"]) for k in known if k["vb"] == 0} - won_games
        nt = [k for k in known if not k["tt"]]
        tt = [k for k in known if k["tt"]]
        ex, seen_games = [], set()
        for k in sorted([k for k in errs if k["clock"] >= 15 and k["best"]], key=lambda k: k["date"], reverse=True):
            if k["url"] not in seen_games:
                seen_games.add(k["url"])
                ex.append(k)
        report["tablebase"] = {
            "games": len({(k["platform"], k["id"]) for k in known}),
            "moves": len(known),
            "errors": len(errs),
            "kinds": dict(kinds),
            "error_rate_no_tt": pct(sum(1 for k in nt if k["va"] < k["vb"]), len(nt)),
            "error_rate_tt": pct(sum(1 for k in tt if k["va"] < k["vb"]), len(tt)),
            "tt_share": pct(len(tt), len(known)),
            "won_games": len(won_games),
            "won_games_converted": sum(1 for key in won_games if by_game[key]["result"] == 1),
            "drawn_games": len(drawn_games),
            "drawn_games_lost": sum(1 for key in drawn_games if by_game[key]["result"] == 0),
            "by_type": sorted([{"type": t, **v, "rate": pct(v["errors"], v["moves"])} for t, v in per_type.items()],
                              key=lambda r: -r["moves"]),
            "examples": [{"fen": k["fen"], "played": k["played_san"], "played_uci": k["uci"], "best": k["best"],
                          "kind": {(1, 0): "Gewinn → Remis", (1, -1): "Gewinn → Verlust", (0, -1): "Remis → Verlust"}[(k["vb"], k["va"])],
                          "eg_type": k["eg_type"], "clock": k["clock"], "url": k["url"], "color": k["color"],
                          "date": k["date"]} for k in ex[:4]],
        }

    # ---- Verwertung / Rettung
    def conversion(threshold_hi, side_me=True):
        res = collections.Counter()
        for g in games:
            wps = [r["wp_before"] if r["mover_is_me"] else 100 - r["wp_before"] for r in g["recs"] if r["fullmove"] >= 8]
            if not wps:
                continue
            hit = any(w >= threshold_hi for w in wps) if side_me else any(w <= 100 - threshold_hi for w in wps)
            if hit:
                key = {1.0: "win", 0.5: "draw", 0.0: "loss"}[g["result"]]
                res[key] += 1
                if key == "loss" and g["termination"] in ("timeout", "outoftime"):
                    res["loss_on_time"] += 1
        n = res["win"] + res["draw"] + res["loss"]
        return {"n": n, "win": pct(res["win"], n), "draw": pct(res["draw"], n), "loss": pct(res["loss"], n),
                "loss_on_time": res["loss_on_time"]}

    report["conversion"] = {"winning_90": conversion(90, True), "losing_10": conversion(90, False)}
    # Gegner als Vergleich: wie oft verwerten deine Gegner ihre Gewinnstellungen?
    opp_conv = collections.Counter()
    for g in games:
        wps = [100 - r["wp_before"] if r["mover_is_me"] else r["wp_before"] for r in g["recs"] if r["fullmove"] >= 8]
        if wps and any(w >= 90 for w in wps):
            opp_conv[{1.0: "loss", 0.5: "draw", 0.0: "win"}[g["result"]]] += 1
    n = sum(opp_conv.values())
    report["conversion"]["opp_winning_90"] = {"n": n, "win": pct(opp_conv["win"], n)}

    # ---- Rating, Sessions, Tageszeit (Metadaten)
    report["rating_chesscom_blitz"] = [
        {"date": dt.datetime.fromtimestamp(g["end_ts"], TZ).date().isoformat(), "rating": g["my_rating"]}
        for g in games if g["platform"] == "chesscom" and g["rated"]
    ]
    sessions, cur = [], []
    for g in games:
        if g["platform"] != "chesscom":
            continue
        if cur and g["end_ts"] - cur[-1]["end_ts"] > 30 * 60:
            sessions.append(cur)
            cur = []
        cur.append(g)
    if cur:
        sessions.append(cur)
    streak_groups = collections.defaultdict(list)
    idx_groups = collections.defaultdict(list)
    for s in sessions:
        losses = 0
        for i, g in enumerate(s):
            streak_groups[min(losses, 3)].append(g)
            idx_groups["1–5" if i < 5 else "6–10" if i < 10 else "11+"].append(g)
            losses = losses + 1 if g["result"] == 0 else 0
    report["tilt"] = {
        "sessions": len(sessions),
        "median_len": st.median(len(s) for s in sessions),
        "after_losses": [{"k": f"{k}{'+' if k == 3 else ''}", "n": len(v),
                          "resid": round(st.mean(g["result"] - expected(g) for g in v), 3)}
                         for k, v in sorted(streak_groups.items())],
        "by_index": [{"k": k, "n": len(v), "resid": round(st.mean(g["result"] - expected(g) for g in v), 3)}
                     for k, v in sorted(idx_groups.items(), key=lambda kv: kv[0])],
    }
    report["by_time_control"] = [
        {"tc": tc, "n": len(v), "score": round(st.mean(g["result"] for g in v), 3),
         "resid": round(st.mean(g["result"] - expected(g) for g in v), 3)}
        for tc, v in sorted(collections.defaultdict(list, {
            k: [g for g in games if f"{g['base'] // 60}+{g['inc']}" == k]
            for k in {f"{g['base'] // 60}+{g['inc']}" for g in games}}).items(), key=lambda kv: -len(kv[1]))
        if len(v) >= 20
    ]

    # ---- Übungsmaterial: eigene Fehlerstellungen
    training = []
    for g in games:
        for r in g["recs"]:
            if r["mover_is_me"] and r["loss"] >= MISTAKE and r.get("best_san") and r["clock"] >= 5:
                training.append({
                    "fen": r["fen"], "played": r["san"], "best": r["best_san"], "pv": r.get("pv_san"),
                    "played_uci": r["uci"], "best_uci": r.get("best_uci"),
                    "loss": round(r["loss"], 1), "cat": r["cat"],
                    "motifs": [THEMES[t] for t in (r.get("lt") or [])] if _cook else r.get("motifs", []),
                    "missed_motifs": [THEMES[t] for t in (r.get("lt_missed") or [])] if _cook else r.get("missed_motifs", []),
                    "themes": r.get("lt") or [], "missed_themes": r.get("lt_missed") or [], "phase": r["phase"],
                    "clock": r["clock"], "spent": r["spent"], "url": g["url"],
                    "date": dt.datetime.fromtimestamp(g["end_ts"], TZ).date().isoformat(),
                })
    report["training_positions"] = len(training)

    # ---- Maia-3: Wie menschlich sind deine Fehler? (falls data/maia.jsonl existiert)
    maia_path = DATA / "maia.jsonl"
    if maia_path.exists():
        maia = {(m["url"], m["fen"]): m for m in map(json.loads, maia_path.open())}
        for t in training:
            m = maia.get((t["url"], t["fen"]))
            if not m:
                continue
            t.update({k: m[k] for k in ("p_best_me", "p_best_up", "p_played_me", "p_played_up")})
            if m["p_best_me"] >= 0.5:
                t["maia_class"] = "Leichtsinn"
            elif m["p_best_up"] >= 0.3:
                t["maia_class"] = "Nächste Stufe"
            else:
                t["maia_class"] = "Schwer"
            t["trap"] = m["p_played_me"] >= 0.3
        mt = [t for t in training if "maia_class" in t]
        classes = ("Leichtsinn", "Nächste Stufe", "Schwer")

        def share(xs, cls):
            return pct(sum(1 for t in xs if t["maia_class"] == cls), len(xs))

        fast = [t for t in mt if t["spent"] is not None and t["spent"] < 2]
        slow = [t for t in mt if t["spent"] is not None and t["spent"] >= 5]
        report["maia"] = {
            "n": len(mt),
            "classes": {c: share(mt, c) for c in classes},
            "loss_share": {c: pct(sum(t["loss"] for t in mt if t["maia_class"] == c), sum(t["loss"] for t in mt))
                           for c in classes},
            "by_phase": {ph: {c: share([t for t in mt if t["phase"] == ph], c) for c in classes}
                         for ph in ("Eröffnung", "Mittelspiel", "Endspiel")},
            "fast_leichtsinn": share(fast, "Leichtsinn"),
            "slow_leichtsinn": share(slow, "Leichtsinn"),
            "n_fast": len(fast), "n_slow": len(slow),
            "traps": pct(sum(1 for t in mt if t["trap"]), len(mt)),
            "avg_p_best_me": round(st.mean(t["p_best_me"] for t in mt), 3),
            "avg_p_best_up": round(st.mean(t["p_best_up"] for t in mt), 3),
        }
        nxt = sorted([t for t in mt if t["maia_class"] == "Nächste Stufe" and t["clock"] >= 30 and t.get("pv")],
                     key=lambda t: (t["p_best_up"] - t["p_best_me"]), reverse=True)
        report["maia_examples"] = [{**t, "color": "white" if " w " in t["fen"] else "black"} for t in nxt[:4]]
    # Typische Beispiele je Fehlerart: jüngste, deutliche Fehler ohne Zeitnot
    examples = []
    for cat in ("Figur eingestellt", "Gegnerische Taktik übersehen", "Gegnerfehler nicht bestraft", "Matt übersehen"):
        xs = [t for t in training if t["cat"] == cat and t["loss"] >= 30 and t["clock"] >= 30 and t["pv"]]
        xs.sort(key=lambda t: t["date"], reverse=True)
        for t in xs[:2]:
            examples.append({**t, "color": "white" if " w " in t["fen"] else "black"})
    report["examples"] = examples
    (DATA / "training_positions.json").write_text(json.dumps(training, ensure_ascii=False, indent=1))
    (DATA / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    print(json.dumps(report, ensure_ascii=False, indent=1)[:6000])


if __name__ == "__main__":
    main()
