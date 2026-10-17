import type { Exercise, Grade, Verdict } from './types';

/** Zug zählt als gleichwertig, wenn er höchstens so viele Prozentpunkte Gewinnchance unter dem besten liegt. */
export const TOLERANCE_WP = 10;
/** Zug ist noch "spielbar", zählt aber nicht als richtig. */
export const PLAYABLE_WP = 25;
/** Unterschied, der als genauso gut gilt (z. B. zwei Mattzüge). */
export const SAME_WP = 0.5;

/** Hat eine Übung die Liste `more`, liegt jeder Zug, der in keiner Liste steht, mindestens so viele Prozentpunkte hinter dem besten. */
export const COVER_WP = 30;

export interface Judgement {
  verdict: Verdict;
  /** Prozentpunkte hinter dem besten Zug. null = nicht bekannt (mindestens COVER_WP, wenn die Übung `more` hat) */
  lossWp: number | null;
  /** Gewinnchance des gespielten Zuges, null = nicht bekannt */
  wp: number | null;
  correct: boolean;
}

/** Gewinnchance eines Zuges (SAN) aus den Daten der Übung, null wenn der Zug dort nicht steht. */
export function wpOf(ex: Exercise, san: string): number | null {
  const line = ex.lines.find((l) => l.san === san);
  if (line) return line.wp;
  const more = ex.more?.find((m) => m[0] === san);
  return more ? more[1] : null;
}

/** Bewertet einen Zug (als SAN) anhand der gespeicherten Bewertungen aller Züge, die nicht viel schlechter sind. */
export function judge(ex: Exercise, san: string, tolerance: boolean): Judgement {
  const wp = wpOf(ex, san);
  // unbekannter Zug: weit hinter dem besten (oder, bei älteren Daten ohne `more`, nicht unter den besten Zügen)
  if (wp === null) return { verdict: 'wrong', lossWp: null, wp: null, correct: false };
  const loss = Math.max(0, ex.lines[0].wp - wp);
  let verdict: Verdict;
  if (loss <= SAME_WP) verdict = 'best';
  else if (loss <= TOLERANCE_WP) verdict = tolerance ? 'equal' : 'playable';
  else if (loss <= PLAYABLE_WP) verdict = 'playable';
  else verdict = 'wrong';
  return { verdict, lossWp: loss, wp, correct: isCorrect(verdict) };
}

/** Alle Züge außer dem besten, die als gleichwertig gelten (nach der Einstellung), beste zuerst. */
export function equalMoves(ex: Exercise, tolerance: boolean): { san: string; wp: number }[] {
  const limit = tolerance ? TOLERANCE_WP : SAME_WP;
  const best = ex.lines[0].wp;
  return [...ex.lines.slice(1).map((l) => ({ san: l.san, wp: l.wp })), ...(ex.more ?? []).map(([san, wp]) => ({ san, wp }))]
    .filter((m) => best - m.wp <= limit)
    .sort((a, b) => b.wp - a.wp);
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
