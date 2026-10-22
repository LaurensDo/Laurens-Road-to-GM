import type { Exercise, Grade, Verdict } from './types';

/** Zug zählt als gleichwertig, wenn er höchstens so viele Prozentpunkte Gewinnchance unter dem besten liegt. */
export const TOLERANCE_WP = 10;
/** Zug ist noch "spielbar", zählt aber nicht als richtig. */
export const PLAYABLE_WP = 25;
/** Unterschied, der als genauso gut gilt (z. B. zwei Mattzüge). */
export const SAME_WP = 0.5;

/** Ergebnis eines Zuges in einer Tablebase-Stellung (aus Sicht des Spielers), null wenn der Zug nicht in der Liste steht */
export function tbResultOf(ex: Exercise, san: string): 'w' | 'd' | 'l' | null {
  return ex.tb?.moves.find((m) => m[0] === san)?.[1] ?? null;
}

/** Gewinnchance, die die App für exakte Ergebnisse zeigt (Balken, Varianten): Gewinn 100, Remis 50, Verlust 0 */
export const TB_WP = { w: 100, d: 50, l: 0 } as const;

/** Wörter für exakte Ergebnisse */
export const TB_TEXT = { w: 'Gewinn', d: 'Remis', l: 'Verlust' } as const;

/** Bei "Sicher gewinnen": so viele Punkte unter der Sicherheitsgrenze gilt ein Zug noch als "spielbar", darunter als falsch. */
export const WIN_PLAYABLE = 15;

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
  // "Endspiel": Die Tablebase kennt jeden Zug exakt. Richtig ist jeder Zug, der das Ergebnis hält, der schnellste Weg heißt "bester Zug".
  if (ex.tb) {
    const r = tbResultOf(ex, san);
    const wp = r ? TB_WP[r] : null;
    const verdict: Verdict = r !== ex.tb.res ? 'wrong' : san === ex.lines[0].san ? 'best' : 'equal';
    return { verdict, lossWp: wp === null ? null : Math.max(0, ex.lines[0].wp - wp), wp, correct: isCorrect(verdict) };
  }
  const wp = wpOf(ex, san);
  // "Sicher gewinnen": jeder Zug, der die Gewinnstellung hält, ist richtig, unabhängig von der Einstellung "Gleichwertige Züge"
  if (ex.win && wp !== null) {
    const loss = Math.max(0, ex.lines[0].wp - wp);
    const verdict: Verdict = wp >= ex.win.safe ? (loss <= SAME_WP ? 'best' : 'equal') : wp >= ex.win.safe - WIN_PLAYABLE ? 'playable' : 'wrong';
    return { verdict, lossWp: loss, wp, correct: isCorrect(verdict) };
  }
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
  const safe = ex.win?.safe;
  if (ex.tb) {
    const res = ex.tb.res;
    return ex.tb.moves.filter((m) => m[1] === res && m[0] !== ex.lines[0].san).map(([san]) => ({ san, wp: TB_WP[res] }));
  }
  return [...ex.lines.slice(1).map((l) => ({ san: l.san, wp: l.wp })), ...(ex.more ?? []).map(([san, wp]) => ({ san, wp }))]
    .filter((m) => (safe !== undefined ? m.wp >= safe : best - m.wp <= limit))
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
