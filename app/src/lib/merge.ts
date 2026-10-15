import { applyReview } from './srs';
import { emptyState, type AppState, type CardRecord, type HiddenEntry, type ReviewEntry, type Settings } from './types';
import { normalize } from './normalize';

/**
 * Abgleich zwischen Geräten.
 *
 * Grundidee: Der Verlauf (jede Antwort mit Zeitpunkt) ist die Wahrheit. Zwei Verläufe werden vereinigt,
 * der Wiederholungsplan jeder Übung wird daraus neu berechnet. Das Ergebnis hängt nicht davon ab, welches
 * Gerät zuerst abgleicht, und ein zweiter Abgleich ändert nichts mehr.
 */

const entryKey = (e: ReviewEntry) => `${e.id}|${e.ts}`;

/** Wiederholungsplan aus dem Verlauf neu aufbauen (Verlauf muss nach Zeit sortiert sein). */
export function replay(log: ReviewEntry[]): Record<string, CardRecord> {
  const cards: Record<string, CardRecord> = {};
  for (const e of log) cards[e.id] = applyReview(cards[e.id], e.grade, new Date(e.ts));
  return cards;
}

export function mergeLogs(a: ReviewEntry[], b: ReviewEntry[], epoch: number): ReviewEntry[] {
  const map = new Map<string, ReviewEntry>();
  for (const e of [...a, ...b]) {
    if (e.ts < epoch) continue;
    const k = entryKey(e);
    const prev = map.get(k);
    // dieselbe Antwort kann mit unterschiedlich weit nachgetragener Dauer vorliegen: die längere gewinnt
    if (!prev || e.dur > prev.dur) map.set(k, e);
  }
  return [...map.values()].sort((x, y) => x.ts - y.ts || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

function mergeHidden(a: Record<string, HiddenEntry>, b: Record<string, HiddenEntry>): Record<string, HiddenEntry> {
  const out: Record<string, HiddenEntry> = { ...a };
  for (const [id, h] of Object.entries(b)) {
    const cur = out[id];
    if (!cur || h.ts > cur.ts || (h.ts === cur.ts && h.on && !cur.on)) out[id] = h;
  }
  return out;
}

function mergeBonus(a: AppState['bonus'], b: AppState['bonus']): AppState['bonus'] {
  if (!a) return b;
  if (!b) return a;
  if (a.day !== b.day) return a.day > b.day ? a : b;
  return { day: a.day, n: Math.max(a.n, b.n) };
}

export function mergeStates(a: AppState, b: AppState): AppState {
  const epoch = Math.max(a.epoch, b.epoch);
  const log = mergeLogs(a.log, b.log, epoch);
  const useB = b.settingsTs > a.settingsTs;
  return {
    version: 1,
    cards: replay(log),
    log,
    settings: useB ? b.settings : a.settings,
    settingsTs: Math.max(a.settingsTs, b.settingsTs),
    bonus: mergeBonus(a.bonus, b.bonus),
    hidden: mergeHidden(a.hidden, b.hidden),
    epoch,
  };
}

/** Was in die Sync-Datei geschrieben wird. Der Wiederholungsplan fehlt bewusst, er wird aus dem Verlauf berechnet. */
export interface RemoteState {
  app: 'road-to-gm';
  schema: 1;
  epoch: number;
  log: ReviewEntry[];
  hidden: Record<string, HiddenEntry>;
  settings: Settings;
  settingsTs: number;
  bonus?: { day: string; n: number };
}

export function toRemote(s: AppState): RemoteState {
  const log = mergeLogs(s.log, [], s.epoch);
  return { app: 'road-to-gm', schema: 1, epoch: s.epoch, log, hidden: s.hidden, settings: s.settings, settingsTs: s.settingsTs, bonus: s.bonus };
}

/** Prüft die Form einer gelesenen Sync-Datei und baut daraus einen Stand. null = unbrauchbar. */
export function fromRemote(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<RemoteState>;
  if (r.app !== 'road-to-gm' || r.schema !== 1 || !Array.isArray(r.log)) return null;
  const ok = r.log.every((e) => e && typeof e.id === 'string' && typeof e.ts === 'number' && (e.grade === 1 || e.grade === 2 || e.grade === 3));
  if (!ok) return null;
  const base = normalize({ ...r, cards: {} });
  const log = mergeLogs(base.log, [], base.epoch).map((e) => ({ ...e, dur: typeof e.dur === 'number' ? e.dur : e.ms ?? 0, ms: typeof e.ms === 'number' ? e.ms : 0 }));
  return { ...base, log, cards: replay(log) };
}

/** Feste Schreibweise für Vergleiche: gleiche Daten ergeben denselben Text. */
export function canonical(r: RemoteState): string {
  const hidden = Object.fromEntries(Object.entries(r.hidden).sort(([x], [y]) => (x < y ? -1 : 1)));
  return JSON.stringify({ ...r, hidden, bonus: r.bonus ?? null });
}

export { emptyState };
