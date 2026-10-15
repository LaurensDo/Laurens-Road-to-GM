import { State, cardState, stability } from './srs';
import { dayKey } from './format';
import type { AppState, Exercise, ReviewEntry } from './types';

export const correct = (e: ReviewEntry) => e.verdict === 'best' || e.verdict === 'equal';

export interface DayStat {
  key: string;
  n: number;
  right: number;
  ms: number; // Summe Antwortzeit
  dur: number; // Summe Trainingszeit
}

export function lastDays(log: ReviewEntry[], days: number, now: Date): DayStat[] {
  const out: DayStat[] = [];
  const index = new Map<string, DayStat>();
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(now.getTime() - i * 86400000);
    const s = { key, n: 0, right: 0, ms: 0, dur: 0 };
    out.push(s);
    index.set(key, s);
  }
  for (const e of log) {
    const s = index.get(dayKey(e.ts));
    if (!s) continue;
    s.n++;
    if (correct(e)) s.right++;
    s.ms += e.ms;
    s.dur += e.dur;
  }
  return out;
}

export function today(log: ReviewEntry[], now: Date) {
  const s = lastDays(log, 1, now)[0];
  return {
    n: s.n,
    right: s.right,
    rate: s.n ? (100 * s.right) / s.n : null,
    avgMs: s.n ? s.ms / s.n : null,
    minutes: s.dur / 60000,
  };
}

/** Anzahl aufeinanderfolgender Tage mit mindestens einer Aufgabe. Zählt ab gestern, wenn heute noch nichts war. */
export function streak(log: ReviewEntry[], now: Date): number {
  const days = new Set(log.map((e) => dayKey(e.ts)));
  let n = 0;
  let t = now.getTime();
  if (!days.has(dayKey(t))) t -= 86400000;
  while (days.has(dayKey(t))) {
    n++;
    t -= 86400000;
  }
  return n;
}

export function cardCounts(state: AppState, exercises: Exercise[]) {
  const c = { neu: 0, lernen: 0, wiederholen: 0, gefestigt: 0 };
  const hidden = new Set(state.hidden ?? []);
  for (const ex of exercises) {
    if (hidden.has(ex.id)) continue;
    const rec = state.cards[ex.id];
    if (!rec) c.neu++;
    else if (cardState(rec) !== State.Review) c.lernen++;
    else if (stability(rec) >= 21) c.gefestigt++;
    else c.wiederholen++;
  }
  return c;
}

export interface Row {
  label: string;
  n: number;
  rate: number;
  avgMs: number;
}

export function breakdown(log: ReviewEntry[], byId: Map<string, Exercise>, field: 'cat' | 'phase' | 'motif'): Row[] {
  const acc = new Map<string, { n: number; right: number; ms: number }>();
  const add = (label: string, e: ReviewEntry) => {
    const a = acc.get(label) ?? { n: 0, right: 0, ms: 0 };
    a.n++;
    if (correct(e)) a.right++;
    a.ms += e.ms;
    acc.set(label, a);
  };
  for (const e of log) {
    const ex = byId.get(e.id);
    if (!ex) continue;
    if (field === 'motif') ex.motifs.forEach((m) => add(m, e));
    else add(ex[field], e);
  }
  return [...acc.entries()]
    .map(([label, a]) => ({ label, n: a.n, rate: (100 * a.right) / a.n, avgMs: a.ms / a.n }))
    .sort((x, y) => y.n - x.n);
}

export function windowStats(log: ReviewEntry[], fromTs: number, toTs: number) {
  const xs = log.filter((e) => e.ts >= fromTs && e.ts < toTs);
  if (!xs.length) return null;
  return {
    n: xs.length,
    rate: (100 * xs.filter(correct).length) / xs.length,
    avgMs: xs.reduce((a, e) => a + e.ms, 0) / xs.length,
  };
}
