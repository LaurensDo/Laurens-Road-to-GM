"""Schätzt mit Maia-3, wie "menschlich" deine Fehler sind.

Aufruf:
    python analysis/maia_difficulty.py --model 79m --step 300

Maia-3 ist auf lichess-Partien trainiert und erwartet lichess-Ratings. chess.com-Ratings
werden deshalb vorher umgerechnet (siehe ratings.py): dieselbe Zahl bedeutet auf chess.com
deutlich mehr Stärke.

Benötigt Maia-3 (https://github.com/CSSLab/maia3, AGPL-3.0) als separat installiertes
Paket (`pip install -e <maia3-checkout>`) plus PyTorch. Maia-3 sagt für eine Stellung
voraus, mit welcher Wahrscheinlichkeit ein Mensch einer bestimmten Elo-Stärke welchen
Zug spielt.

Für jede deiner Fehlerstellungen (data/training_positions.json) wird berechnet:
    p_best_me   Wahrscheinlichkeit, dass ein Spieler deiner Stärke den Engine-Zug spielt
    p_best_up   dasselbe für einen Spieler `--step` Elo stärker
    p_played_me Wahrscheinlichkeit, dass ein Spieler deiner Stärke deinen (falschen) Zug spielt

Schreibt data/maia.jsonl.
"""

import argparse
import json
from collections import deque
from pathlib import Path

import chess
import torch
from maia3.uci import Maia3UCIEngine, parse_args
from maia3.utils import mirror_move

from ratings import to_lichess_scale

DATA = Path(__file__).resolve().parent.parent / "data"


class Maia:
    def __init__(self, model):
        cfg = parse_args(["--model", model, "--device", "cpu", "--no-use-amp", "--use-uci-history"])
        self.eng = Maia3UCIEngine(cfg)
        self.eng.ensure_model_loaded()
        torch.set_grad_enabled(False)

    def set_game(self, moves_uci):
        self.eng.cmd_position("position startpos moves " + " ".join(moves_uci))

    def move_probs(self, elos, opp_elo):
        """Policy-Verteilung über alle legalen Züge, eine pro Elo-Stufe (ein Batch)."""
        eng = self.eng
        legal = list(eng.board.legal_moves)
        t = eng._tokens_from_history(eng.history)
        tokens = t.unsqueeze(0).repeat(len(elos), *([1] * t.dim()))
        self_elos = torch.tensor(elos, dtype=torch.long)
        oppo_elos = torch.tensor([opp_elo] * len(elos), dtype=torch.long)
        logits, _, _ = eng.model(tokens, self_elos, oppo_elos)
        idx = []
        for mv in legal:
            key = mv.uci() if eng.board.turn == chess.WHITE else mirror_move(mv.uci())
            idx.append(eng.all_moves_dict[key])
        sel = logits[:, idx].float()
        probs = torch.softmax(sel, dim=-1)
        return [{mv.uci(): float(p) for mv, p in zip(legal, row)} for row in probs]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="79m")
    ap.add_argument("--step", type=int, default=300)
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    raw = {}
    for line in (DATA / "games_raw.jsonl").open():
        g = json.loads(line)
        raw[g["url"]] = g
    positions = json.loads((DATA / "training_positions.json").read_text())
    if args.limit:
        positions = positions[: args.limit]

    out = DATA / "maia.jsonl"
    done = set()
    if out.exists():
        done = {(r["url"], r["fen"]) for r in map(json.loads, out.open())}

    maia = Maia(args.model)
    with out.open("a") as f:
        for i, p in enumerate(positions, 1):
            if (p["url"], p["fen"]) in done:
                continue
            g = raw[p["url"]]
            # Zugfolge bis zur Fehlerstellung (für die Stellungshistorie, die Maia nutzt)
            board = chess.Board()
            prefix = []
            for uci, _ in g["moves"]:
                if board.fen() == p["fen"]:
                    break
                prefix.append(uci)
                board.push_uci(uci)
            if board.fen() != p["fen"]:
                continue
            maia.set_game(prefix)
            me = to_lichess_scale(g["platform"], g["my_rating"]) or 1500
            opp = to_lichess_scale(g["platform"], g["opp_rating"]) or me
            low, high = maia.move_probs([me, me + args.step], opp)
            f.write(json.dumps({
                "url": p["url"], "fen": p["fen"], "elo": me, "elo_raw": g["my_rating"], "platform": g["platform"],
                "p_best_me": round(low.get(p["best_uci"], 0.0), 4),
                "p_best_up": round(high.get(p["best_uci"], 0.0), 4),
                "p_played_me": round(low.get(p["played_uci"], 0.0), 4),
                "p_played_up": round(high.get(p["played_uci"], 0.0), 4),
                "top_me": max(low, key=low.get),
            }) + "\n")
            if i % 250 == 0:
                print(f"{i}/{len(positions)}", flush=True)
                f.flush()
    print("fertig", flush=True)


if __name__ == "__main__":
    main()
