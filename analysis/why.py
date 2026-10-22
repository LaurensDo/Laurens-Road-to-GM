"""Warum ist der beste Zug richtig? Motiv, Gewinn und die Kosten des Partiezugs für jede Übung.

Die App erklärte bisher bei 697 von 1.200 Fehler-Übungen gar kein Motiv, und wo eines stand, beschrieb es meist, was der Gegner ausnutzt, nicht,
warum der beste Zug funktioniert. Hier wird die beste Linie jeder Übung so ausgewertet, wie lichess seine Puzzles auswertet:

  tags   Motive der besten Linie mit dem lichess-Tagger (cook.py aus ornicar/lichess-puzzler, als eigener Checkout, AGPL-3.0): Der letzte Zug des
         Gegners ist der "Fehler", die beste Linie die Lösung, gekürzt bis zum größten Materialgewinn oder Matt (wie in analysis/report.py).
  gain   was die gekürzte Linie bringt: Matt in N oder Material, in Worten ("die Qualität", "eine Figur", "einen Bauern", "Material (+4)")
  line   die gekürzte Linie (SAN), vorsichtig gerechnet: ein Schlag zählt erst nach der Antwort des Gegners,, damit die App "Nach 12.Sd5 Dd8 13.Sxc7 ..." zeigen kann
  against für den Partiezug und die gespeicherten Fehlzüge (refs): was die Widerlegung kostet, ebenso gekürzt und in Worten

Nur Fakten aus Engine-Linien und Material, kein freier Text: Wo nichts Greifbares ist, bleibt das Feld leer, und die App sagt ehrlich, dass es um
die Stellung geht, nicht um eine Taktik.

Aufruf: python analysis/why.py      Liest app/public/data/exercises.json, schreibt data/why.jsonl. Danach: python analysis/build_exercises.py
"""

import json
from pathlib import Path

import chess

import report
from report import THEMES, VALUES, balance, lichess_tags

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
EXERCISES = ROOT / "app" / "public" / "data" / "exercises.json"

ONE = {chess.PAWN: "einen Bauern", chess.KNIGHT: "einen Springer", chess.BISHOP: "einen Läufer", chess.ROOK: "einen Turm", chess.QUEEN: "die Dame"}
MANY = {chess.PAWN: "Bauern", chess.KNIGHT: "Springer", chess.BISHOP: "Läufer", chess.ROOK: "Türme", chess.QUEEN: "Damen"}
NUM = {2: "zwei", 3: "drei", 4: "vier"}


def uci_line(board, sans):
    b = board.copy()
    out = []
    for s in sans:
        try:
            m = b.parse_san(s)
        except ValueError:
            break
        out.append(m.uci())
        b.push(m)
    return out


def san_line(board, ucis):
    b = board.copy()
    out = []
    for u in ucis:
        m = chess.Move.from_uci(u)
        out.append(b.san(m))
        b.push(m)
    return out


def outcome(board, ucis, color):
    """Was die Linie für `color` bringt: ("mate", N) oder ("material", Punkte, Worte), None wenn nichts."""
    b = board.copy()
    start = balance(b, color)
    gained = {t: 0 for t in VALUES}
    for u in ucis:
        m = chess.Move.from_uci(u)
        victim = b.piece_at(m.to_square) if not b.is_en_passant(m) else chess.Piece(chess.PAWN, not b.turn)
        if victim is not None:
            gained[victim.piece_type] += 1 if b.turn == color else -1
        if m.promotion:
            gained[m.promotion] += 1 if b.turn == color else -1
            gained[chess.PAWN] -= 1 if b.turn == color else -1
        b.push(m)
    if b.is_checkmate():
        return ("mate", (len(ucis) + 1) // 2) if b.turn != color else ("mated", (len(ucis) + 1) // 2)
    pts = balance(b, color) - start
    if pts <= 0:
        return None
    pos = {t: n for t, n in gained.items() if n > 0}
    neg = {t: -n for t, n in gained.items() if n < 0}
    if pos == {chess.ROOK: 1} and neg in ({chess.KNIGHT: 1}, {chess.BISHOP: 1}):
        words = "die Qualität"
    elif pos:
        words = pieces(pos) + (f" für {pieces(neg)}" if neg else "")
    else:
        words = f"Material (+{pts})"
    return ("material", pts, words)


def pieces(counts):
    """{Springer: 1, Bauer: 2} -> "einen Springer und zwei Bauern" (wertvollste zuerst)"""
    parts = [ONE[t] if n == 1 else f"{NUM.get(n, n)} {MANY[t]}" for t, n in sorted(counts.items(), key=lambda kv: -VALUES[kv[0]])]
    return " und ".join(parts) if len(parts) <= 2 else ", ".join(parts[:-1]) + " und " + parts[-1]


def best_cut(board, ucis, color):
    """Bis wohin die Linie für `color` am meisten bringt, vorsichtig gerechnet: Nach einem eigenen Zug zählt der Stand erst nach der Antwort des
    Gegners (ein Schlagzug mit Rückschlag ist kein Gewinn). Endet die Linie mit einem eigenen Schlag, der zurückgeschlagen werden kann, zählt er nicht.
    Gibt die Länge der Linie zurück, die gezeigt wird (inklusive der Antwort des Gegners), oder None, wenn nichts gewonnen wird."""
    b = board.copy()
    start = balance(b, color)
    states = []
    for u in ucis:
        m = chess.Move.from_uci(u)
        if m not in b.legal_moves:
            break
        mover = b.turn
        capture = b.is_capture(m)
        b.push(m)
        states.append((balance(b, color) - start, b.is_checkmate(), mover, capture, b.is_attacked_by(not color, m.to_square)))
        if b.is_checkmate():
            break
    best = None
    for i, (g, mate, mover, capture, attacked) in enumerate(states):
        if mover != color:
            continue
        if mate:
            return i + 1
        if i + 1 < len(states):
            safe, end = min(g, states[i + 1][0]), i + 2
        elif capture and attacked:
            continue
        else:
            safe, end = g, i + 1
        if safe > 0 and (best is None or safe > best[0]):
            best = (safe, end)
    return best[1] if best else None


def as_json(o, line_sans):
    if o is None:
        return None
    if o[0] in ("mate", "mated"):
        return {"mate": o[1], "line": line_sans}
    return {"pts": o[1], "words": o[2], "line": line_sans}


def main():
    if report._cook is None:
        raise SystemExit("lichess-Tagger nicht gefunden (../ornicar/lichess-puzzler/tagger oder LICHESS_TAGGER)")
    exercises = json.loads(EXERCISES.read_text())["exercises"]
    out = (DATA / "why.jsonl").open("w")
    stats = {"tags": 0, "gain": 0, "mate": 0, "nichts": 0, "against": 0}
    for e in exercises:
        board = chess.Board(e["fen"])
        me = board.turn
        best = uci_line(board, e["lines"][0]["pv"])
        rec = {"id": e["id"], "tags": [], "gain": None, "against": []}
        # Ausgangslage für den Tagger: Stellung vor dem letzten Zug des Gegners, dann dieser Zug, dann die beste Linie
        prev = e.get("prev")
        if prev and best:
            before = chess.Board(None)
            before.set_board_fen(prev["board"])
            before.turn = not me
            before.castling_rights = board.castling_rights
            try:
                mv = chess.Move.from_uci(prev["uci"])
                if mv in before.legal_moves:
                    b2 = before.copy()
                    b2.push(mv)
                    if b2.board_fen() == board.board_fen():
                        cp = e["lines"][0].get("cp") or 0
                        rec["tags"] = [THEMES[t] for t in (lichess_tags(before, mv, best, cp) or [])]
            except (ValueError, AssertionError):
                pass
        if best:
            end = best_cut(board, best, me)
            if end:
                cut = best[:end]
                rec["gain"] = as_json(outcome(board, cut, me), san_line(board, cut))
        # was die Widerlegung der Fehlzüge kostet (Partiezug und wahrscheinliche Fehlzüge)
        for ref in e.get("refs", []):
            san, pv = ref[0], ref[1]
            try:
                m = board.parse_san(san)
            except ValueError:
                continue
            after = board.copy()
            after.push(m)
            rest = uci_line(after, pv)
            end = best_cut(after, rest, not me)
            if end:
                cut = rest[:end]
                o = outcome(after, cut, not me)
                if o:
                    rec["against"].append([san, as_json(o, san_line(after, cut))])
        stats["tags"] += bool(rec["tags"])
        stats["mate"] += bool(rec["gain"] and "mate" in rec["gain"])
        stats["gain"] += bool(rec["gain"] and "pts" in rec["gain"])
        stats["against"] += bool(rec["against"])
        stats["nichts"] += not rec["tags"] and not rec["gain"]
        out.write(json.dumps(rec, ensure_ascii=False) + "\n")
    out.close()
    print(f"{len(exercises)} Übungen: {stats}")


if __name__ == "__main__":
    main()
