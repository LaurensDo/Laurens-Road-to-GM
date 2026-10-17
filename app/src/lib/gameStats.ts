import type { GameRec } from './games';

/**
 * Uhr-Auswertung einer Partie. Alle Definitionen stehen hier an einer Stelle und gelten für die App und für die eingefrorene
 * Basis (tools/make-baseline.mjs rechnet mit derselben Funktion die alten Partien aus):
 *
 *  - "Uhr vor Zug N" ist die Restzeit nach dem eigenen Zug N-1 (bei der Diagnose: Zug 20 mit 119,6 s, Zug 30 mit 65,4 s).
 *  - Eigene Zeit von Zug 16 bis 29: Uhr vor Zug 16 minus Uhr vor Zug 30.
 *  - Denkpause: 10 s oder länger für einen eigenen Zug zwischen Zug 15 und 35 (Inkrement abgerechnet).
 *  - Budget ("Zeitbudget für 3+0"): Uhr vor Zug 20 mindestens 2:00, vor Zug 30 mindestens 1:20. Bei längerer Bedenkzeit ohne Inkrement
 *    im selben Verhältnis. Mit Inkrement und im Bullet gibt es kein Budget.
 *  - Qualitätsbremse: Materialverlust von mindestens 2 Bauerneinheiten bis zu deinem übernächsten Halbzug (dein Zug, Antwort, dein
 *    nächster Zug) nach einem schnellen eigenen Zug (unter 2 s, bei mindestens 30 s Restzeit, Zug 10 bis 35). Gezählt wird je 100 solcher
 *    Züge. Schutz davor, dass Tempo mit Qualität bezahlt wird.
 */

export const PAUSE_S = 10;
export const FAST_S = 2;

export interface Pause {
  move: number;
  secs: number;
  san: string;
}

export interface Metrics {
  /** eigene Züge */
  moves: number;
  before16: number | null;
  before20: number | null;
  before30: number | null;
  oppBefore20: number | null;
  oppBefore30: number | null;
  /** Vorsprung (positiv) oder Rückstand (negativ) gegenüber dem Gegner vor Zug 30, in Sekunden */
  lead30: number | null;
  /** Vorsprung vor Zug 20 */
  lead20: number | null;
  /** eigene Zeit für die Züge 16 bis 29 */
  own1629: number | null;
  pauses: Pause[];
  oppPauses: number;
  ok20: boolean | null;
  ok30: boolean | null;
  /** auf Zeit verloren, obwohl mindestens 2 Bauerneinheiten vorn */
  lostOnTimeAhead: boolean;
  fast: number;
  fastBad: number;
}

/** Budget (Sekunden Restzeit vor Zug 20 und vor Zug 30), null ohne Budget */
export function budgetOf(g: Pick<GameRec, 'base' | 'inc'>): { b20: number; b30: number } | null {
  if (g.inc !== 0 || g.base < 180) return null;
  const f = g.base / 180;
  return { b20: 120 * f, b30: 80 * f };
}

const ply = (g: GameRec, k: number, mine: boolean) => 2 * (k - 1) + ((g.color === 'w') === mine ? 0 : 1);

/** Halbzug-Index (ab 0) deines Zuges Nummer k. Davor wurden so viele Halbzüge gespielt. */
export const ownPly = (g: Pick<GameRec, 'color'>, k: number): number => 2 * (k - 1) + (g.color === 'w' ? 0 : 1);

export function metricsOf(g: GameRec): Metrics {
  const sideClocks = (mine: boolean) => g.clk.filter((_, i) => i % 2 === ((g.color === 'w') === mine ? 0 : 1));
  const own = sideClocks(true);
  const opp = sideClocks(false);
  const before = (arr: number[], n: number) => (n <= arr.length + 1 && n >= 2 ? arr[n - 2] : null);
  const spent = (arr: number[], k: number) => (k === 1 ? g.base : arr[k - 2]) - arr[k - 1] + g.inc;

  const before16 = before(own, 16);
  const before20 = before(own, 20);
  const before30 = before(own, 30);
  const oppBefore20 = before(opp, 20);
  const oppBefore30 = before(opp, 30);
  const budget = budgetOf(g);

  const pauses: Pause[] = [];
  for (let k = 15; k <= Math.min(35, own.length); k++) {
    const s = spent(own, k);
    if (s >= PAUSE_S) pauses.push({ move: k, secs: s, san: g.sans[ply(g, k, true)] ?? '' });
  }
  let oppPauses = 0;
  for (let k = 15; k <= Math.min(35, opp.length); k++) if (spent(opp, k) >= PAUSE_S) oppPauses++;

  const sign = g.color === 'w' ? 1 : -1;
  const bal = (i: number) => (i < 0 ? 0 : sign * (g.mat[Math.min(i, g.mat.length - 1)] ?? 0));
  const hasMat = g.mat.length > 0;
  let fast = 0;
  let fastBad = 0;
  if (hasMat) {
    for (let k = 10; k <= Math.min(35, own.length); k++) {
      const prev = k === 1 ? g.base : own[k - 2];
      if (spent(own, k) >= FAST_S || prev < 30) continue;
      fast++;
      const p = ply(g, k, true);
      if (bal(p - 1) - bal(p + 2) >= 2) fastBad++;
    }
  }

  return {
    moves: own.length,
    before16,
    before20,
    before30,
    oppBefore20,
    oppBefore30,
    lead30: before30 !== null && oppBefore30 !== null ? before30 - oppBefore30 : null,
    lead20: before20 !== null && oppBefore20 !== null ? before20 - oppBefore20 : null,
    own1629: before16 !== null && before30 !== null ? before16 - before30 : null,
    pauses,
    oppPauses,
    ok20: budget && before20 !== null ? before20 >= budget.b20 : null,
    ok30: budget && before30 !== null ? before30 >= budget.b30 : null,
    lostOnTimeAhead: g.timeLoss && hasMat && bal(g.mat.length - 1) >= 2,
    fast,
    fastBad,
  };
}

// ---- Auswertung über mehrere Partien

export interface Summary {
  n: number;
  /** Partien, in denen die Uhr vor Zug 30 bekannt ist */
  reach30: number;
  reach20: number;
  own1629: number | null;
  lead30: number | null;
  lead20: number | null;
  /** Denkpausen je Partie (nur Partien, die Zug 30 erreichen) */
  pauses: number | null;
  oppPauses: number | null;
  /** Anteil der Partien mit Budget vor Zug 20 / 30, in Prozent */
  budget20: number | null;
  budget30: number | null;
  losses: number;
  lostOnTime: number;
  lostOnTimeAhead: number;
  /** Qualitätsbremse: schnelle Züge und davon die mit Materialverlust */
  fast: number;
  fastBad: number;
}

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null);

export function summarize(games: GameRec[]): Summary {
  const ms = games.map((g) => ({ g, m: metricsOf(g) }));
  const r30 = ms.filter((x) => x.m.before30 !== null);
  const r20 = ms.filter((x) => x.m.before20 !== null);
  const share = (xs: (boolean | null)[]) => {
    const k = xs.filter((x): x is boolean => x !== null);
    return k.length ? (100 * k.filter(Boolean).length) / k.length : null;
  };
  return {
    n: games.length,
    reach30: r30.length,
    reach20: r20.length,
    own1629: mean(ms.map((x) => x.m.own1629).filter((x): x is number => x !== null)),
    lead30: mean(ms.map((x) => x.m.lead30).filter((x): x is number => x !== null)),
    lead20: mean(ms.map((x) => x.m.lead20).filter((x): x is number => x !== null)),
    pauses: r30.length ? r30.reduce((a, x) => a + x.m.pauses.length, 0) / r30.length : null,
    oppPauses: r30.length ? r30.reduce((a, x) => a + x.m.oppPauses, 0) / r30.length : null,
    budget20: share(r20.map((x) => x.m.ok20)),
    budget30: share(r30.map((x) => x.m.ok30)),
    losses: games.filter((g) => g.result === 'l').length,
    lostOnTime: games.filter((g) => g.timeLoss).length,
    lostOnTimeAhead: ms.filter((x) => x.m.lostOnTimeAhead).length,
    fast: ms.reduce((a, x) => a + x.m.fast, 0),
    fastBad: ms.reduce((a, x) => a + x.m.fastBad, 0),
  };
}

/** Standardabweichung der Einzelwerte, für den normalen Bereich im Vergleich mit der Basis */
export function sd(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = xs.reduce((a, x) => a + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}
