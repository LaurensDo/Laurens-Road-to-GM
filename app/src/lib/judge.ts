import type { Exercise, Grade, Verdict } from './types';

/** Zug zählt als gleichwertig, wenn er höchstens so viele Prozentpunkte Gewinnchance unter dem besten liegt. */
export const TOLERANCE_WP = 10;
/** Zug ist noch "spielbar", zählt aber nicht als richtig. */
export const PLAYABLE_WP = 25;
/** Unterschied, der als genauso gut gilt (z. B. zwei Mattzüge). */
export const SAME_WP = 0.5;

export interface Judgement {
  verdict: Verdict;
  lossWp: number | null; // null = nicht unter den besten Zügen
  rank: number | null; // 0 = bester
  correct: boolean;
}

/** Bewertet einen Zug (als SAN) anhand der gespeicherten besten Züge der Engine. */
export function judge(ex: Exercise, san: string, tolerance: boolean): Judgement {
  const idx = ex.lines.findIndex((l) => l.san === san);
  if (idx < 0) return { verdict: 'wrong', lossWp: null, rank: null, correct: false };
  const loss = Math.max(0, ex.lines[0].wp - ex.lines[idx].wp);
  let verdict: Verdict;
  if (loss <= SAME_WP) verdict = 'best';
  else if (loss <= TOLERANCE_WP) verdict = tolerance ? 'equal' : 'playable';
  else if (loss <= PLAYABLE_WP) verdict = 'playable';
  else verdict = 'wrong';
  return { verdict, lossWp: loss, rank: idx, correct: verdict === 'best' || verdict === 'equal' };
}

/** Wiederholungsnote: falsch = 1, richtig aber zu langsam = 2, richtig in der Zeit = 3. */
export function gradeFor(correct: boolean, ms: number, limitSeconds: number): Grade {
  if (!correct) return 1;
  if (limitSeconds > 0 && ms > limitSeconds * 1000) return 2;
  return 3;
}

export function isCorrect(v: Verdict): boolean {
  return v === 'best' || v === 'equal';
}
