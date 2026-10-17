"""Prüfsatz: Übungen, die nie im Training erscheinen und nur dem Monats-Check dienen.

Warum: Eine Übung, die man schon geübt hat, misst Erinnerung, nicht Können. Damit sich später ehrlich messen lässt,
ob man auch unbekannte Stellungen besser löst, bleibt ein Teil der Übungen von Anfang an unberührt.

Die Auswahl ist deterministisch und geschichtet nach Fehlerart, Phase und Maia-Klasse über die ganze Datei (die Übungen sind
nach Verlust sortiert, vorn liegen die gröbsten Fehler, hinten die feineren). Die ersten Plätze werden übersprungen, weil sie
im Training meist schon gesehen sind. Die Liste steht in analysis/holdout_ids.json und wächst nur: bestehende IDs bleiben.

Aufruf: python analysis/pick_holdout.py [--n 60] [--skip 150]
Danach: python analysis/build_exercises.py (setzt "hold": true in exercises.json)
"""
import argparse
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXERCISES = ROOT / "app" / "public" / "data" / "exercises.json"
IDS = Path(__file__).resolve().parent / "holdout_ids.json"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=60, help="Größe des Prüfsatzes insgesamt")
    ap.add_argument("--skip", type=int, default=150, help="so viele Plätze am Anfang der Datei werden nicht gewählt")
    args = ap.parse_args()

    exercises = json.loads(EXERCISES.read_text())["exercises"]
    have = json.loads(IDS.read_text()) if IDS.exists() else []
    known = {e["id"] for e in exercises}
    have = [i for i in have if i in known]
    need = args.n - len(have)
    if need <= 0:
        print(f"Prüfsatz hat schon {len(have)} Übungen, nichts zu tun.")
        IDS.write_text(json.dumps(have, indent=1) + "\n")
        return

    taken = set(have)
    strata = defaultdict(list)
    for pos, e in enumerate(exercises):
        if pos < args.skip or e["id"] in taken:
            continue
        strata[(e["cat"], e["phase"], e["maia"].get("cls") or "-")].append(e["id"])

    total = sum(len(v) for v in strata.values())
    # Anteil je Schicht, Reste nach größtem Rest verteilt
    quota = {k: need * len(v) / total for k, v in strata.items()}
    take = {k: int(q) for k, q in quota.items()}
    left = need - sum(take.values())
    for k in sorted(quota, key=lambda k: (-(quota[k] - take[k]), k))[:left]:
        take[k] += 1

    picked = []
    for k in sorted(strata):
        ids = strata[k]
        n = min(take[k], len(ids))
        # gleichmäßig über die Schicht verteilt (jüngere und ältere Stellungen, große und kleine Verluste)
        picked += [ids[int((i + 0.5) * len(ids) / n)] for i in range(n)] if n else []

    out = have + picked
    IDS.write_text(json.dumps(out, indent=1) + "\n")
    by = defaultdict(int)
    for e in exercises:
        if e["id"] in set(out):
            by[(e["cat"], e["phase"])] += 1
    print(f"{len(out)} Übungen im Prüfsatz (neu: {len(picked)}).")
    for k in sorted(by):
        print(f"  {k[0]} · {k[1]}: {by[k]}")


if __name__ == "__main__":
    main()
