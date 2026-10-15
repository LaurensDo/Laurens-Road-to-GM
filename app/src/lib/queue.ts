import { State, dueDate, cardState } from './srs';
import { dayKey } from './format';
import type { AppState, Exercise, Filters } from './types';

export function matchesFilters(ex: Exercise, f: Filters): boolean {
  if (f.phase !== 'alle' && ex.phase !== f.phase) return false;
  if (f.cat !== 'alle' && ex.cat !== f.cat) return false;
  if (f.motif !== 'alle' && !ex.motifs.includes(f.motif)) return false;
  return true;
}

export interface QueueCounts {
  due: number; // jetzt fällig
  learning: number; // in den nächsten Minuten fällig (Lernschritte)
  newAvailable: number; // heute noch neu verfügbar
  newTotal: number; // noch nie gesehen (im Filter)
  total: number; // Übungen im Filter
}

const LEARN_AHEAD_MS = 20 * 60 * 1000;

export function newIntroducedToday(state: AppState, now: Date): number {
  const today = dayKey(now.getTime());
  return Object.values(state.cards).filter((c) => dayKey(c.firstSeen) === today).length;
}

/** Wie viele neue Aufgaben heute noch freigegeben sind (Tageskontingent plus Bonus). */
export function newQuotaLeft(state: AppState, now: Date): number {
  const today = dayKey(now.getTime());
  const bonus = state.bonus && state.bonus.day === today ? state.bonus.n : 0;
  return Math.max(0, state.settings.newPerDay + bonus - newIntroducedToday(state, now));
}

export function isHidden(state: AppState, id: string): boolean {
  return state.hidden?.[id]?.on === true;
}

export function hiddenCount(state: AppState): number {
  return Object.values(state.hidden ?? {}).filter((h) => h.on).length;
}

export function poolOf(exercises: Exercise[], state: AppState): Exercise[] {
  return exercises.filter((e) => !isHidden(state, e.id) && matchesFilters(e, state.settings.filters));
}

export function counts(exercises: Exercise[], state: AppState, now: Date): QueueCounts {
  const pool = poolOf(exercises, state);
  let due = 0;
  let learning = 0;
  let newTotal = 0;
  for (const ex of pool) {
    const rec = state.cards[ex.id];
    if (!rec) {
      newTotal++;
      continue;
    }
    const d = dueDate(rec).getTime();
    if (d <= now.getTime()) due++;
    else if (d <= now.getTime() + LEARN_AHEAD_MS && cardState(rec) !== State.Review) learning++;
  }
  const quota = newQuotaLeft(state, now);
  return { due, learning, newAvailable: Math.min(quota, newTotal), newTotal, total: pool.length };
}

export type PickKind = 'due' | 'learning' | 'new';

/**
 * Nächste Aufgabe: zuerst Fälliges, dann Neues im Tageskontingent. Lernschritte der nächsten Minuten werden nur
 * vorgezogen, wenn sonst nichts mehr da ist. So kommt ein Fehler nach etwa einer Minute und einigen anderen Aufgaben wieder.
 */
export function pickNext(
  exercises: Exercise[],
  state: AppState,
  now: Date,
  last?: { id: string; cat: string },
  /** Übungen, die in diesem Satz schon vorkamen und nicht noch einmal gewählt werden */
  exclude?: ReadonlySet<string>,
): { ex: Exercise; kind: PickKind } | null {
  const pool = poolOf(exercises, state).filter((e) => !exclude?.has(e.id));
  const t = now.getTime();

  const dueList: { ex: Exercise; d: number }[] = [];
  const learnList: { ex: Exercise; d: number }[] = [];
  const fresh: Exercise[] = [];
  for (const ex of pool) {
    const rec = state.cards[ex.id];
    if (!rec) {
      fresh.push(ex);
      continue;
    }
    const d = dueDate(rec).getTime();
    if (d <= t) dueList.push({ ex, d });
    else if (d <= t + LEARN_AHEAD_MS && cardState(rec) !== State.Review) learnList.push({ ex, d });
  }

  const byDue = (a: { d: number }, b: { d: number }) => a.d - b.d;
  dueList.sort(byDue);
  learnList.sort(byDue);

  const notLast = <T extends { ex: Exercise }>(xs: T[]) => xs.find((x) => x.ex.id !== last?.id) ?? xs[0];

  if (dueList.length) return { ex: notLast(dueList).ex, kind: 'due' };

  const quota = newQuotaLeft(state, now);
  if (quota > 0 && fresh.length) {
    // leicht durchmischen: unter den nächsten Kandidaten eine andere Fehlerart als zuletzt
    const window = fresh.slice(0, 8);
    const pick = window.find((e) => e.cat !== last?.cat) ?? window[0];
    return { ex: pick, kind: 'new' };
  }
  // Nichts mehr fällig und nichts Neues: Lernschritte der nächsten Minuten vorziehen, damit die Sitzung sauber endet
  if (learnList.length) return { ex: notLast(learnList).ex, kind: 'learning' };
  return null;
}
