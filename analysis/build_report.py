"""Setzt die Report-Seite aus Vorlage, Kennzahlen und Befund-Texten zusammen.

Aufruf:
    python analysis/build_report.py

Liest  analysis/report_template.html, data/report.json, data/findings.json
Schreibt data/diagnose.html
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def embed(obj):
    return json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")


def main():
    html = (ROOT / "analysis" / "report_template.html").read_text()
    report = json.loads((DATA / "report.json").read_text())
    findings = json.loads((DATA / "findings.json").read_text())
    html = html.replace("/*__REPORT__*/null", embed(report)).replace("/*__FINDINGS__*/null", embed(findings))
    out = DATA / "diagnose.html"
    out.write_text(html)
    print(f"{out} ({len(html) // 1024} KB)")


if __name__ == "__main__":
    main()
