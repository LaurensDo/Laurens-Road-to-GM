"""Exportiert die wichtigsten eigenen Fehlerstellungen als PGN zum Üben.

Aufruf:
    python analysis/export_pgn.py --count 60

Auswahl: zuerst die Maia-Klassen "Leichtsinn" und "Nächste Stufe" (die Fehler, die
du realistisch abstellen kannst), nach Verlust sortiert, je Partie höchstens eine
Stellung. Jede Stellung wird ein eigenes Kapitel: Ausgangsstellung = vor deinem
Fehler, Hauptvariante = richtige Lösung, dein Zug als Nebenvariante.

Die Datei lässt sich in eine lichess-Studie importieren (max. 64 Kapitel pro Studie).
Schreibt data/uebungen.pgn.
"""

import argparse
import json
import re
from pathlib import Path

import chess
import chess.pgn

DATA = Path(__file__).resolve().parent.parent / "data"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=60)
    args = ap.parse_args()

    positions = json.loads((DATA / "training_positions.json").read_text())
    pool = [p for p in positions if p.get("maia_class") in ("Leichtsinn", "Nächste Stufe") and p.get("best_uci")]
    if not pool:
        pool = [p for p in positions if p.get("best_uci")]
    pool.sort(key=lambda p: (-p["loss"], p["date"]))

    chosen, seen = [], set()
    for p in pool:
        if p["url"] in seen:
            continue
        seen.add(p["url"])
        chosen.append(p)
        if len(chosen) >= args.count:
            break

    out = []
    for n, p in enumerate(chosen, 1):
        board = chess.Board(p["fen"])
        game = chess.pgn.Game()
        game.setup(board)
        side = "Weiß" if board.turn == chess.WHITE else "Schwarz"
        game.headers["Event"] = f"Road to GM {n:02d}: {side} am Zug"
        game.headers["Site"] = p["url"]
        game.headers["Date"] = p["date"].replace("-", ".")
        game.headers["White"] = "?"
        game.headers["Black"] = "?"
        game.headers["Annotator"] = p.get("maia_class", "")
        # Kein Lösungshinweis im Kapitel-Kommentar: nur Phase und Uhr
        game.comment = f"{p['phase']} · in der Partie {p['clock']:.0f} s auf der Uhr"
        # Lösung: Engine-Variante aus der SAN-Notation ("36...f6 37. Nd7 Kf7 ...")
        node = game
        b = board.copy()
        for tok in (p.get("pv") or "").split():
            san = re.sub(r"^\d+\.+", "", tok)
            if not san:
                continue
            try:
                mv = b.parse_san(san)
            except ValueError:
                break
            node = node.add_variation(mv)
            b.push(mv)
        if not game.variations:
            game.add_variation(chess.Move.from_uci(p["best_uci"]))
        played = game.add_variation(chess.Move.from_uci(p["played_uci"]))
        maia = ""
        if "p_best_me" in p:
            maia = f" Maia: dein Niveau findet den richtigen Zug zu {100 * p['p_best_me']:.0f} %, +300 Elo zu {100 * p['p_best_up']:.0f} %."
        punish = f" Bestrafung: {', '.join(p['motifs'][:2])}." if p.get("motifs") else ""
        played.comment = (f"Dein Zug in der Partie ({p['cat']}), kostete {p['loss']:.0f} Prozentpunkte "
                          f"Gewinnchance.{punish}{maia}")
        out.append(str(game))

    path = DATA / "uebungen.pgn"
    path.write_text("\n\n".join(out) + "\n")
    print(f"{path}: {len(out)} Stellungen")


if __name__ == "__main__":
    main()
