import { State, cardState, dueDate, retrievability } from './srs';
import { countsForSchedule } from './merge';
import { dayKey } from './format';
import type { AppState, Exercise, Filters } from './types';

export function matchesFilters(ex: Exercise, f: Filters): boolean {
  if (f.phase !== 'alle' && ex.phase !== f.phase) return false;
  if (f.cat !== 'alle' && ex.cat !== f.cat) return false;
  if (f.motif !== 'alle' && !ex.motifs.includes(f.motif)) return false;
  return true;
}

export interface QueueCounts {
  due: number; // heute dran: fällige Wiederholungen (im Rückstand gedeckelt) plus Lernschritte, die gerade fällig sind
  learning: number; // in den nächsten Minuten fällig (Lernschritte)
  newAvailable: number; // heute noch neu verfügbar
  newTotal: number; // noch nie gesehen (im Filter)
  total: number; // Übungen im Filter
  /** Wiederholungen, die wegen des Tagesdeckels erst an den nächsten Tagen drankommen */
  waiting: number;
  /** über so viele Tage (heute eingerechnet) verteilt sich der Rückstand, 0 = kein Rückstand */
  backlogDays: number;
}

/**
 * Lernschritte, die in so vielen Minuten fällig werden, zählen als "gleich" (Anzeige) und werden am Ende des Tages vorgezogen. Kürzer als die
 * Wartezeit nach einem Fehler (srs.ts, 10 Minuten), sonst käme ein Fehler am Ende des Kontingents sofort wieder.
 */
const LEARN_AHEAD_MS = 2 * 60 * 1000;

/** Nach einer Pause kommen nie alle Fälligen auf einmal: höchstens so viele Wiederholungen pro Tag. */
export const DUE_CAP = 30;
/** Im Rückstand kommen trotzdem so viele neue Aufgaben pro Tag dazu (statt des normalen Kontingents). */
export const BACKLOG_NEW = 3;
/** Ab so vielen Tagen Pause beginnt der erste Satz mit den sichersten fälligen Karten. */
export const COMEBACK_DAYS = 4;
/** So viele sichere Karten zum Wiedereinstieg. */
export const COMEBACK_CARDS = 5;
/** Jede WIN_EVERY-te neue Aufgabe ist eine "Sicher gewinnen"-Stellung (die dritte, achte, ... aller je gesehenen) */
export const WIN_EVERY = 5;
export const WIN_OFFSET = 2;

/** Mindestens so viele neue Aufgaben am Tag, auch wenn die Wiederholungen das Tagesziel schon füllen würden */
export const MIN_NEW = 3;
/** Annahme für die Zeit je Aufgabe, solange zu wenige Antworten vorliegen */
export const DEFAULT_TASK_S = 30;

/** Typische Zeit je Aufgabe in Sekunden (Median der letzten Antworten ohne die Zeit in Varianten), für die Planung des Tages. */
export function taskSeconds(state: AppState, now: Date): number {
  const cutoff = now.getTime() - 30 * 86400000;
  const xs = state.log
    .filter((e) => countsForSchedule(e) && e.ts >= cutoff)
    .slice(-150)
    .map((e) => Math.max(0, e.dur - (e.pv ?? 0)) / 1000)
    .filter((x) => x > 0);
  if (xs.length < 20) return DEFAULT_TASK_S;
  xs.sort((a, b) => a - b);
  const m = xs.length >> 1;
  const med = xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
  return Math.min(90, Math.max(8, med));
}

export function newIntroducedToday(state: AppState, now: Date): number {
  const today = dayKey(now.getTime());
  return Object.values(state.cards).filter((c) => dayKey(c.firstSeen) === today).length;
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

/** Wie viele verschiedene ältere Karten wurden heute schon wiederholt? */
export function reviewedToday(state: AppState, now: Date): number {
  const today = dayKey(now.getTime());
  const ids = new Set<string>();
  for (const e of state.log) {
    if (!countsForSchedule(e) || dayKey(e.ts) !== today) continue;
    const rec = state.cards[e.id];
    if (rec && dayKey(rec.firstSeen) !== today) ids.add(e.id);
  }
  return ids.size;
}

/** Ganze Kalendertage seit der letzten Antwort vor heute. null, wenn es davor keine gab. */
export function daysAway(state: AppState, now: Date): number | null {
  const today = dayKey(now.getTime());
  let last = -Infinity;
  for (const e of state.log) if (dayKey(e.ts) !== today && e.ts > last) last = e.ts;
  if (last === -Infinity) return null;
  const midnight = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  return Math.round((midnight(now.getTime()) - midnight(last)) / 86400000);
}

interface Scan {
  /** fällig und im Review-Zustand: das sind die Wiederholungen, die der Deckel betrifft */
  dueReview: { ex: Exercise; d: number }[];
  /** fällig im Lernschritt (nach einem Fehler): immer erlaubt */
  dueLearn: { ex: Exercise; d: number }[];
  /** in den nächsten Minuten fällig im Lernschritt */
  ahead: { ex: Exercise; d: number }[];
  fresh: Exercise[];
  /** ab hier ist der Rückstand gedeckelt */
  backlog: boolean;
  /** Wiederholungen, die heute noch drankommen dürfen (Infinity ohne Rückstand) */
  reviewLeft: number;
  newQuota: number;
}

function scan(pool: Exercise[], state: AppState, now: Date): Scan {
  const t = now.getTime();
  const dueReview: Scan['dueReview'] = [];
  const dueLearn: Scan['dueLearn'] = [];
  const ahead: Scan['ahead'] = [];
  const fresh: Exercise[] = [];
  for (const ex of pool) {
    const rec = state.cards[ex.id];
    if (!rec) {
      fresh.push(ex);
      continue;
    }
    const d = dueDate(rec).getTime();
    const review = cardState(rec) === State.Review;
    if (d <= t) (review ? dueReview : dueLearn).push({ ex, d });
    else if (d <= t + LEARN_AHEAD_MS && !review) ahead.push({ ex, d });
  }
  const byDue = (a: { d: number }, b: { d: number }) => a.d - b.d;
  dueReview.sort(byDue);
  dueLearn.sort(byDue);
  ahead.sort(byDue);
  // Rückstand: Fällige heute plus die heute schon erledigten überschreiten den Tagesdeckel
  const done = reviewedToday(state, now);
  const backlog = dueReview.length + done > DUE_CAP;
  const reviewLeft = backlog ? Math.max(0, DUE_CAP - done) : Infinity;
  const today = dayKey(now.getTime());
  const bonus = state.bonus && state.bonus.day === today ? state.bonus.n : 0;
  const base = backlog ? Math.min(state.settings.newPerDay, BACKLOG_NEW) : state.settings.newPerDay;
  // Neue Aufgaben pro Tag sind eine Obergrenze: Was das Tagesziel in Minuten nach den Wiederholungen übrig lässt, ist der Rahmen
  const committed = done + Math.min(dueReview.length, reviewLeft) + dueLearn.length;
  const fit = Math.floor((state.settings.goalMinutes * 60) / taskSeconds(state, now)) - committed;
  const introduced = newIntroducedToday(state, now);
  // schon gezeigte neue Aufgaben nimmt die Obergrenze nicht zurück (sonst täte "5 weitere neue" nichts, wenn sie später kleiner wird)
  const cap = Math.max(introduced, backlog ? base : Math.min(base, Math.max(MIN_NEW, fit)));
  const newQuota = Math.max(0, cap + bonus - introduced);
  return { dueReview, dueLearn, ahead, fresh, backlog, reviewLeft, newQuota };
}

export function counts(exercises: Exercise[], state: AppState, now: Date): QueueCounts {
  const pool = poolOf(exercises, state);
  const sc = scan(pool, state, now);
  const reviews = Math.min(sc.dueReview.length, sc.reviewLeft);
  const waiting = sc.dueReview.length - reviews;
  return {
    due: reviews + sc.dueLearn.length,
    learning: sc.ahead.length,
    newAvailable: Math.min(sc.newQuota, sc.fresh.length),
    newTotal: sc.fresh.length,
    total: pool.length,
    waiting,
    backlogDays: waiting > 0 ? Math.ceil(sc.dueReview.length / DUE_CAP) : 0,
  };
}

export type PickKind = 'due' | 'learning' | 'new';

/**
 * Nächste Aufgabe: zuerst Fälliges, dann Neues im Tageskontingent. Lernschritte der nächsten Minuten werden nur
 * vorgezogen, wenn sonst nichts mehr da ist. So kommt ein Fehler frühestens nach zehn Minuten wieder (srs.ts), meist im nächsten Satz oder am nächsten Tag.
 * Nach einer Pause von mindestens COMEBACK_DAYS Tagen beginnt der Tag mit den sichersten fälligen Karten, und im Rückstand
 * gilt der Tagesdeckel DUE_CAP.
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
  const sc = scan(pool, state, now);

  const notLast = <T extends { ex: Exercise }>(xs: T[]) => xs.find((x) => x.ex.id !== last?.id) ?? xs[0];

  // Learnschritte nach einem Fehler zuerst, dann Wiederholungen (gedeckelt)
  if (sc.dueLearn.length) return { ex: notLast(sc.dueLearn).ex, kind: 'due' };
  if (sc.dueReview.length && sc.reviewLeft > 0) {
    const away = daysAway(state, now);
    const answeredToday = state.log.filter((e) => dayKey(e.ts) === dayKey(now.getTime())).length;
    if (away !== null && away >= COMEBACK_DAYS && answeredToday < COMEBACK_CARDS) {
      const sure = [...sc.dueReview].sort((a, b) => retrievability(state.cards[b.ex.id], now) - retrievability(state.cards[a.ex.id], now));
      return { ex: notLast(sure).ex, kind: 'due' };
    }
    return { ex: notLast(sc.dueReview).ex, kind: 'due' };
  }

  if (sc.newQuota > 0 && sc.fresh.length) {
    // "Sicher gewinnen" kommt als jede fünfte neue Aufgabe dazwischen, unabhängig davon, wie viele schon gesehen sind
    const wins = sc.fresh.filter((e) => e.win);
    const regular = sc.fresh.filter((e) => !e.win);
    const wantWin = wins.length > 0 && (regular.length === 0 || Object.keys(state.cards).length % WIN_EVERY === WIN_OFFSET);
    const from = wantWin || regular.length === 0 ? wins : regular;
    // leicht durchmischen: unter den nächsten Kandidaten eine andere Fehlerart als zuletzt
    const window = from.slice(0, 8);
    const pick = window.find((e) => e.cat !== last?.cat) ?? window[0];
    return { ex: pick, kind: 'new' };
  }
  // Nichts mehr fällig und nichts Neues: Lernschritte der nächsten Minuten vorziehen, damit die Sitzung sauber endet
  if (sc.ahead.length) return { ex: notLast(sc.ahead).ex, kind: 'learning' };
  return null;
}
