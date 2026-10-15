"""Baut eine Handy-taugliche Seite zum Kopieren der Übungs-PGNs.

Aufruf:
    python analysis/build_uebungen.py

Liest  analysis/uebungen_template.html, data/uebungen_weiss.pgn, data/uebungen_schwarz.pgn
Schreibt data/uebungen.html
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def main():
    html = (ROOT / "analysis" / "uebungen_template.html").read_text()
    payload = {
        "white": (DATA / "uebungen_weiss.pgn").read_text(),
        "black": (DATA / "uebungen_schwarz.pgn").read_text(),
    }
    blob = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")
    out = DATA / "uebungen.html"
    out.write_text(html.replace("/*__DATA__*/null", blob))
    print(f"{out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
