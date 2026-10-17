import { countsForSchedule } from './merge';
import { correct } from './stats';
import type { Exercise, ReviewEntry } from './types';

/**
 * Erstversuch-Quote: Nur der erste Versuch an einer unbekannten Stellung misst Können. Spätere Versuche messen auch Erinnerung.
 * Verglichen wird mit dem Richtwert aus Maia (maia.ok: Wahrscheinlichkeit, dass ein Spieler deiner Stärke einen als richtig
 * gewerteten Zug findet). Ein Fenster aus wenigen Dutzend Versuchen schwankt stark, deshalb gibt es immer den normalen Bereich dazu
 * und erst ab MIN_TRIES Versuchen ein Urteil.
 */

export interface FirstTry {
  id: string;
  ts: number;
  ok: boolean;
  /** Richtwert für diese Stellung (0 bis 1), null wenn die Daten ihn nicht kennen */
  exp: number | null;
  cls: string | null;
}

export const WINDOW = 50;
export const MIN_TRIES = 20;

/** Richtwert einer Übung nach der Einstellung (mit oder ohne gleichwertige Züge). Fällt auf p_best zurück, wenn die Daten älter sind. */
export function expectedOf(ex: Exercise, tolerance: boolean): number | null {
  const m = ex.maia;
  const v = tolerance ? m.ok : m.ok0;
  return typeof v === 'number' ? v : typeof m.me === 'number' ? m.me : null;
}

/** Der erste Versuch je Übung, älteste zuerst. Nur normale Aufgaben, und nur Übungen, die die App kennt. */
export function firstTries(log: ReviewEntry[], byId: Map<string, Exercise>, tolerance: boolean): FirstTry[] {
  const first = new Map<string, ReviewEntry>();
  for (const e of log) {
    if (!countsForSchedule(e)) continue;
    const cur = first.get(e.id);
    if (!cur || e.ts < cur.ts) first.set(e.id, e);
  }
  return [...first.values()]
    .map((e) => {
      const ex = byId.get(e.id);
      return ex ? { id: e.id, ts: e.ts, ok: correct(e), exp: expectedOf(ex, tolerance), cls: ex.maia.cls } : null;
    })
    .filter((x): x is FirstTry => x !== null)
    .sort((a, b) => a.ts - b.ts);
}

export type SkillWord = 'over' | 'inside' | 'under';

export interface SkillStat {
  n: number;
  /** beobachtete Quote in Prozent */
  rate: number;
  /** Richtwert in Prozent */
  expected: number;
  /** normaler Bereich um den Richtwert (95 %), in Prozent */
  lo: number;
  hi: number;
  word: SkillWord;
}

/** Quote der letzten `window` Erstversuche gegen den Richtwert. null, solange es zu wenige Versuche mit Richtwert gibt. */
export function skillStat(tries: FirstTry[], window = WINDOW, min = MIN_TRIES): SkillStat | null {
  const xs = tries.filter((t) => t.exp !== null).slice(-window);
  if (xs.length < min) return null;
  const n = xs.length;
  const rate = (100 * xs.filter((t) => t.ok).length) / n;
  const p = xs.map((t) => t.exp as number);
  const expected = (100 * p.reduce((a, x) => a + x, 0)) / n;
  // Streuung der Quote, wenn jede Stellung mit ihrer eigenen Wahrscheinlichkeit gelöst wird
  const sd = (100 * Math.sqrt(p.reduce((a, x) => a + x * (1 - x), 0))) / n;
  const lo = Math.max(0, expected - 1.96 * sd);
  const hi = Math.min(100, expected + 1.96 * sd);
  return { n, rate, expected, lo, hi, word: rate > hi ? 'over' : rate < lo ? 'under' : 'inside' };
}

export const SKILL_TEXT: Record<SkillWord, string> = {
  over: 'über dem Richtwert',
  inside: 'im normalen Bereich',
  under: 'unter dem Richtwert',
};
