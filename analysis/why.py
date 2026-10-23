"""Warum ist der beste Zug richtig? Motiv, Gewinn und die Kosten des Partiezugs für jede Übung.

Die App erklärte bisher bei 697 von 1.200 Fehler-Übungen gar kein Motiv, und wo eines stand, beschrieb es meist, was der Gegner ausnutzt, nicht,
warum der beste Zug funktioniert. Hier wird die beste Linie jeder Übung so ausgewertet, wie lichess seine Puzzles auswertet:

  tags   Motive der besten Linie mit dem lichess-Tagger (cook.py aus ornicar/lichess-puzzler, als eigener Checkout, AGPL-3.0): Der letzte Zug des
         Gegners ist der "Fehler", die beste Linie die Lösung, gekürzt bis zum größten Materialgewinn oder Matt (wie in analysis/report.py).
  gain   was die gekürzte Linie bringt: Matt in N oder Material, in Worten ("die Qualität", "einen Springer für einen Bauern", "Material (+4)"),
         bei einer Umwandlung "eine neue Dame" (new). Im Remis-Endspiel entfällt der Gewinn: Dort geht es ums Halten.
  line   die gekürzte Linie (SAN), vorsichtig gerechnet (best_cut): ein Schlag zählt erst nach der Antwort des Gegners, der Gewinn muss bis zum
         Ende der Linie halten, und ein Schlag am Linienende nur, wenn die beste Antwort (Stockfish, kurz) nichts zurückholt
  against für den Partiezug und die gespeicherten Fehlzüge (refs): was die Widerlegung kostet, gerechnet ab der Stellung VOR dem Fehlzug (was der
         Fehlzug selbst schlägt, zählt mit), ebenso gekürzt und in Worten

Nur Fakten aus Engine-Linien und Material, kein freier Text: Wo nichts Greifbares ist, bleibt das Feld leer, und die App sagt ehrlich, dass es um
die Stellung geht, nicht um eine Taktik.

Aufruf: python analysis/why.py      Liest app/public/data/exercises.json, schreibt data/why.jsonl. Danach: python analysis/build_exercises.py
"""

import json
from collections import Counter
from pathlib import Path

import chess
import chess.engine

import report
from all_moves import find_stockfish
from report import THEMES, VALUES, balance, lichess_tags

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
EXERCISES = ROOT / "app" / "public" / "data" / "exercises.json"

ONE = {chess.PAWN: "einen Bauern", chess.KNIGHT: "einen Springer", chess.BISHOP: "einen Läufer", chess.ROOK: "einen Turm", chess.QUEEN: "die Dame"}
MANY = {chess.PAWN: "Bauern", chess.KNIGHT: "Springer", chess.BISHOP: "Läufer", chess.ROOK: "Türme", chess.QUEEN: "Damen"}
NUM = {2: "zwei", 3: "drei", 4: "vier"}
NEW = {chess.QUEEN: "eine neue Dame", chess.ROOK: "einen neuen Turm", chess.BISHOP: "einen neuen Läufer", chess.KNIGHT: "einen neuen Springer"}


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
    """Was die Linie für `color` bringt: ("mate", N), ("mated", N) oder ("material", Punkte, Worte, neue Figur), None wenn nichts.

    Worte: geschlagene Figuren, verrechnet mit den eigenen ("einen Springer für einen Bauern", "die Qualität"). Eine Umwandlung ist kein
    Damengewinn: Bleibt die neue Figur stehen, heißt sie "eine neue Dame"; wird sie wieder geschlagen, war sie für ihren Besitzer nur ein Bauer."""
    b = board.copy()
    start = balance(b, color)
    took, lost = Counter(), Counter()
    promoted = {color: {}, not color: {}}  # Feld -> Figur: umgewandelte Figuren, Feld für Feld verfolgt
    for u in ucis:
        m = chess.Move.from_uci(u)
        mover = b.turn
        ep = b.is_en_passant(m)
        victim = chess.PAWN if ep else b.piece_type_at(m.to_square)
        if victim:
            # eine geschlagene umgewandelte Figur war für ihren Besitzer nur ein Bauer
            if not ep and promoted[not mover].pop(m.to_square, None):
                victim = chess.PAWN
            (took if mover == color else lost)[victim] += 1
        if m.from_square in promoted[mover]:
            promoted[mover][m.to_square] = promoted[mover].pop(m.from_square)
        if m.promotion:
            promoted[mover][m.to_square] = m.promotion
        b.push(m)
    if b.is_checkmate():
        return ("mate", (len(ucis) + 1) // 2) if b.turn != color else ("mated", (len(ucis) + 1) // 2)
    pts = balance(b, color) - start
    if pts <= 0:
        return None
    new_mine, new_theirs = list(promoted[color].values()), list(promoted[not color].values())
    net = {t: took[t] - lost[t] for t in VALUES}
    pos = {t: n for t, n in net.items() if n > 0}
    neg = {t: -n for t, n in net.items() if n < 0}
    if new_theirs:  # die Gegenseite hat umgewandelt und trotzdem verloren: zu verschachtelt für einen Satz
        return ("material", pts, f"Material (+{pts})", None)
    new = " und ".join(NEW[t] for t in new_mine) or None
    if pos == {chess.ROOK: 1} and neg in ({chess.KNIGHT: 1}, {chess.BISHOP: 1}) and not new:
        words = "die Qualität"
    elif pos:
        words = pieces(pos) + (f" für {pieces(neg)}" if neg else "")
    else:
        words = None
        if new and neg:
            new += f" für {pieces(neg)}"
    if not words and not new:
        words = f"Material (+{pts})"
    return ("material", pts, words, new)


def pieces(counts):
    """{Springer: 1, Bauer: 2} -> "einen Springer und zwei Bauern" (wertvollste zuerst)"""
    parts = [ONE[t] if n == 1 else f"{NUM.get(n, n)} {MANY[t]}" for t, n in sorted(counts.items(), key=lambda kv: -VALUES[kv[0]])]
    return " und ".join(parts) if len(parts) <= 2 else ", ".join(parts[:-1]) + " und " + parts[-1]


def best_cut(board, ucis, color, reply):
    """Bis wohin die Linie für `color` am meisten bringt, vorsichtig gerechnet. Gibt die Länge der gezeigten Linie zurück, None wenn nichts.

    - Nach einem eigenen Zug zählt der Stand erst nach der Antwort des Gegners (ein Schlagzug mit Rückschlag ist kein Gewinn).
    - Der Gewinn muss bis zum Ende der Linie halten: Holt der Gegner später etwas zurück (etwa nach einem Zwischenschach), zählt nur, was bleibt.
      Schlägt der eigene nächste Zug sofort zurück, zählt der bessere Stand.
    - Endet die Linie mit einem eigenen Schlag oder einer Umwandlung, zählt das nur, wenn die beste Antwort (`reply`, Engine) nichts zurückholt."""
    b = board.copy()
    start = balance(b, color)
    s = []  # (Stand für color nach dem Halbzug, Matt, wer gezogen hat)
    for u in ucis:
        m = chess.Move.from_uci(u)
        if m not in b.legal_moves:
            break
        mover = b.turn
        b.push(m)
        s.append((balance(b, color) - start, b.is_checkmate(), mover))
        if b.is_checkmate():
            break
    n = len(s)

    def kept(j):
        return max(s[j][0], s[j + 1][0]) if j + 1 < n else s[j][0]

    best = None
    for i, (g, mate, mover) in enumerate(s):
        if mover != color:
            continue
        if mate:
            return i + 1
        if i + 1 < n:
            claim, end = s[i + 1][0], i + 2
        else:
            before = s[i - 1][0] if i else 0
            if g <= before:
                continue  # stiller letzter Zug: der Stand davor ist schon gezählt
            answer = reply(b)
            if answer is not None:
                b2 = b.copy(stack=False)
                b2.push(answer)
                if balance(b2, color) - start < g:
                    continue
            claim, end = g, i + 1
        if claim > 0 and all(kept(j) >= claim for j in range(end, n) if s[j][2] != color) and (best is None or claim > best[0]):
            best = (claim, end)
    return best[1] if best else None


def as_json(o, line_sans):
    if o is None:
        return None
    if o[0] in ("mate", "mated"):
        return {"mate": o[1], "line": line_sans}
    return {"pts": o[1], **({"words": o[2]} if o[2] else {}), **({"new": o[3]} if o[3] else {}), "line": line_sans}


def engine_reply(engine, nodes):
    """Beste Antwort der Seite am Zug (Engine, kurz gerechnet), None wenn die Partie zu Ende ist. Für best_cut."""

    def run(board):
        if board.is_game_over():
            return None
        return engine.play(board, chess.engine.Limit(nodes=nodes)).move

    return run


def prev_board(prev, board):
    """Stellung vor dem letzten Zug des Gegners. Rochaderecht und en passant stehen nicht in `prev`: Ist der Zug so nicht legal, werden sie ergänzt."""
    before = chess.Board(None)
    before.set_board_fen(prev["board"])
    before.turn = not board.turn
    before.castling_rights = board.castling_rights
    mv = chess.Move.from_uci(prev["uci"])
    if mv not in before.legal_moves:
        home = chess.BB_RANK_1 if before.turn == chess.WHITE else chess.BB_RANK_8
        before.castling_rights |= before.rooks & before.occupied_co[before.turn] & home
        before.castling_rights = before.clean_castling_rights()
    if mv not in before.legal_moves and before.piece_type_at(mv.from_square) == chess.PAWN and chess.square_file(mv.from_square) != chess.square_file(mv.to_square):
        before.ep_square = mv.to_square
    return before, mv


def main():
    if report._cook is None:
        raise SystemExit("lichess-Tagger nicht gefunden (../ornicar/lichess-puzzler/tagger oder LICHESS_TAGGER)")
    exercises = json.loads(EXERCISES.read_text())["exercises"]
    engine = chess.engine.SimpleEngine.popen_uci(find_stockfish())
    engine.configure({"Threads": 1, "Hash": 64})
    reply = engine_reply(engine, 200_000)
    out = (DATA / "why.jsonl").open("w")
    stats = {"tags": 0, "gain": 0, "mate": 0, "nichts": 0, "against": 0, "neu": 0}
    for e in exercises:
        board = chess.Board(e["fen"])
        me = board.turn
        best = uci_line(board, e["lines"][0]["pv"])
        rec = {"id": e["id"], "tags": [], "gain": None, "against": []}
        # Ausgangslage für den Tagger: Stellung vor dem letzten Zug des Gegners, dann dieser Zug, dann die beste Linie
        prev = e.get("prev")
        if prev and best:
            try:
                before, mv = prev_board(prev, board)
                if mv in before.legal_moves:
                    b2 = before.copy()
                    b2.push(mv)
                    if b2.board_fen() == board.board_fen():
                        cp = e["lines"][0].get("cp") or 0
                        rec["tags"] = [THEMES[t] for t in (lichess_tags(before, mv, best, cp) or [])]
            except (ValueError, AssertionError):
                pass
        # Im Remis-Endspiel geht es ums Halten: "gewinnst du zwei Bauern" wäre dort irreführend
        if best and (e.get("tb") or {}).get("res") != "d":
            end = best_cut(board, best, me, reply)
            if end:
                cut = best[:end]
                rec["gain"] = as_json(outcome(board, cut, me), san_line(board, cut))
        # was die Widerlegung der Fehlzüge kostet (Partiezug und wahrscheinliche Fehlzüge), gerechnet ab der Stellung vor dem Fehlzug:
        # Was der Fehlzug selbst schlägt, zählt mit, sonst hieße ein Abtausch "du verlierst einen Läufer"
        for ref in e.get("refs", []):
            san, pv = ref[0], ref[1]
            try:
                m = board.parse_san(san)
            except ValueError:
                continue
            after = board.copy()
            after.push(m)
            full = [m.uci()] + uci_line(after, pv)
            end = best_cut(board, full, not me, reply)
            if end:
                cut = full[:end]
                o = outcome(board, cut, not me)
                if o and o[0] != "mated":
                    rec["against"].append([san, as_json(o, san_line(after, cut[1:]))])
        stats["tags"] += bool(rec["tags"])
        stats["mate"] += bool(rec["gain"] and "mate" in rec["gain"])
        stats["gain"] += bool(rec["gain"] and "pts" in rec["gain"])
        stats["neu"] += bool(rec["gain"] and "new" in rec["gain"]) + sum("new" in a[1] for a in rec["against"])
        stats["against"] += bool(rec["against"])
        stats["nichts"] += not rec["tags"] and not rec["gain"]
        out.write(json.dumps(rec, ensure_ascii=False) + "\n")
    out.close()
    engine.quit()
    print(f"{len(exercises)} Übungen: {stats}")


if __name__ == "__main__":
    main()
