"""Rechnet chess.com-Blitz-Ratings auf die lichess-Skala um.

Dieselbe Zahl bedeutet auf den beiden Plattformen nicht dieselbe Stärke. Bei Spielern
um 1.100 bis 1.700 liegen lichess-Blitz-Ratings rund 300 bis 400 Punkte höher als
chess.com-Blitz-Ratings (Glicko-2 auf lichess, anderer Spielerpool).

Maia-3 und der lichess Opening Explorer arbeiten mit lichess-Ratings. Deshalb müssen
chess.com-Werte vorher umgerechnet werden.

Stützpunkte: Mittel aus zwei Schätzungen, die jeweils Chess.com-Blitz -> Lichess-Blitz angeben.
    chessgoals.com/rating-comparison   (Umfrage, ca. 1.900 lichess-Spieler, +/- 70)
        1300 -> 1620, 1600 -> 1820
    attackingchess.com, "Ultimate Chess.com vs Lichess Rating Comparison" (Nov 2025)
        1100 -> 1500, 1200 -> 1565, 1300 -> 1635, 1400 -> 1705, 1500 -> 1780,
        1600 -> 1850, 1700 -> 1910
Beide Schätzungen weichen um bis zu etwa 70 Punkte voneinander ab. Eine
ChessDojo-basierte Umrechnung (chess-analysis.org) liegt bei 1.400 sogar rund 100 höher.
Kontrolle an den eigenen Konten (Q4 2025, chess.com-Median 1.283, lichess-Median 1.603):
die Tabelle ergibt für 1.283 etwa 1.620, also 17 Punkte daneben.
"""

# chess.com Blitz -> lichess Blitz (typischer Spieler, Unsicherheit etwa +/- 70)
TABLE = [
    (1000, 1430),
    (1100, 1500),
    (1200, 1562),
    (1300, 1628),
    (1400, 1700),
    (1500, 1775),
    (1600, 1838),
    (1700, 1900),
    (1800, 1965),
]


def chesscom_to_lichess(rating):
    """chess.com-Blitz -> lichess-Blitz, linear zwischen den Stützpunkten, an den Rändern fortgesetzt."""
    r = float(rating)
    pts = TABLE
    if r <= pts[0][0]:
        slope = (pts[1][1] - pts[0][1]) / (pts[1][0] - pts[0][0])
        return pts[0][1] + slope * (r - pts[0][0])
    if r >= pts[-1][0]:
        slope = (pts[-1][1] - pts[-2][1]) / (pts[-1][0] - pts[-2][0])
        return pts[-1][1] + slope * (r - pts[-1][0])
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= r <= x1:
            return y0 + (y1 - y0) * (r - x0) / (x1 - x0)


def to_lichess_scale(platform, rating):
    """Rating einer Partie auf die lichess-Skala bringen (lichess-Werte bleiben unverändert)."""
    if rating is None:
        return None
    return round(rating if platform == "lichess" else chesscom_to_lichess(rating))


# Rating-Gruppen des lichess Opening Explorers: "1600" umfasst 1600 bis 1799 usw.
EXPLORER_BUCKETS = [400, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500]


def explorer_buckets(lichess_rating, count=1):
    """Explorer-Gruppen für ein lichess-Rating: die eigene Gruppe plus ggf. weitere darunter.

    1650 -> [1600] bei count=1, [1400, 1600] bei count=2.
    """
    idx = max(i for i, b in enumerate(EXPLORER_BUCKETS) if b <= lichess_rating)
    return EXPLORER_BUCKETS[max(0, idx - count + 1): idx + 1]


if __name__ == "__main__":
    for r in (1000, 1100, 1283, 1311, 1400, 1516, 1600):
        print(f"chess.com {r} -> lichess {round(chesscom_to_lichess(r))}")
