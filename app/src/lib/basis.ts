/**
 * Eingefrorene Basis der Uhr-Auswertung (public/data/uhr-basis.json, erzeugt von tools/make-baseline.mjs aus den Partien vor dem
 * 15.10.2026) und der Vergleich damit. Ein Urteil gibt es erst ab einer Mindestmenge von Partien, und nur in drei Wörtern.
 */

export interface MeanSd {
  mean: number | null;
  sd: number | null;
}

export interface BasisBlock {
  n: number;
  reach30: number;
  period: [string, string];
  own1629: MeanSd;
  lead30: MeanSd;
  lead20: MeanSd;
  pauses: { mean: number | null; sd: number | null; opp: number | null };
  budget20: number | null;
  budget30: number | null;
  timeLosses: number;
  losses: number;
  lostOnTimeAhead: number;
  brake: { fast: number; bad: number; per100: number | null };
}

export interface UhrBasis {
  version: number;
  chesscom30: BasisBlock;
  lichess10: BasisBlock;
  monthly: { lead30: { lo: number; hi: number }; own1629: { lo: number; hi: number }; pauses: { lo: number; hi: number } };
  minGames: { chesscom30: number; lichess10: number };
}

export type Word = 'better' | 'inside' | 'worse';

export const WORD_TEXT: Record<Word, string> = {
  better: 'besser als vorher',
  inside: 'im normalen Bereich',
  worse: 'schlechter als vorher',
};

/**
 * Vergleicht den Mittelwert von `n` neuen Partien mit der Basis (Mittelwert und Streuung der Einzelwerte, `baseN` Partien).
 * Als "im normalen Bereich" gilt, was der Zufall bei zwei Stichproben dieser Größe erklärt (95 %).
 */
export function compare(value: number, n: number, base: MeanSd, baseN: number, lowerIsBetter: boolean): Word | null {
  if (base.mean === null || base.sd === null || n < 2 || baseN < 2) return null;
  const se = Math.sqrt((base.sd * base.sd) / n + (base.sd * base.sd) / baseN);
  const diff = value - base.mean;
  if (Math.abs(diff) <= 1.96 * se) return 'inside';
  return (diff < 0) === lowerIsBetter ? 'better' : 'worse';
}

/** Ab so vielen Partien (mit Uhr vor Zug 30) gibt es ein vorläufiges Urteil, gemessen am Bereich der Monatswerte statt am Zufallsbereich. */
export const PRELIM_MIN = 20;

/** Vorläufiges Urteil: Liegt der Wert im Bereich, den deine Monate abgedeckt haben, ist er normal, sonst besser oder schlechter. */
export function compareRange(value: number, range: { lo: number; hi: number }, lowerIsBetter: boolean): Word {
  if (value >= range.lo && value <= range.hi) return 'inside';
  return (value < range.lo) === lowerIsBetter ? 'better' : 'worse';
}

/** Wie viele Partien (mit Uhr vor Zug 30) fehlen noch bis zur ersten Aussage? */
export const missing = (reach30: number, min: number): number => Math.max(0, min - reach30);
