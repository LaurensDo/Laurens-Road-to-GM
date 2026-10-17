import { applyReview } from './srs';
import { emptyState, type AppState, type CardRecord, type DeviceInfo, type HiddenEntry, type ReviewEntry, type Settings } from './types';
import { normalize } from './normalize';
import { READER_LEVEL } from './version';

/**
 * Abgleich zwischen Geräten.
 *
 * Grundidee: Der Verlauf (jede Antwort mit Zeitpunkt) ist die Wahrheit. Zwei Verläufe werden vereinigt,
 * der Wiederholungsplan jeder Übung wird daraus neu berechnet. Das Ergebnis hängt nicht davon ab, welches
 * Gerät zuerst abgleicht, und ein zweiter Abgleich ändert nichts mehr.
 */

const entryKey = (e: ReviewEntry) => `${e.id}|${e.ts}`;

/** Zählt die Antwort für den Wiederholungsplan? Nur normale Aufgaben aus dem Fehler-Trainer, spätere Arten werden nur mitgeführt. */
export const countsForSchedule = (e: ReviewEntry) => e.kind === undefined || e.kind === 'fehler';

/** Wiederholungsplan aus dem Verlauf neu aufbauen (Verlauf muss nach Zeit sortiert sein). */
export function replay(log: ReviewEntry[]): Record<string, CardRecord> {
  const cards: Record<string, CardRecord> = {};
  for (const e of log) if (countsForSchedule(e)) cards[e.id] = applyReview(cards[e.id], e.grade, new Date(e.ts));
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

/**
 * Epoche: Die jüngere Festlegung gilt. Ein Zurücksetzen setzt sie nach vorn, das Wiederherstellen einer älteren Sicherung
 * wieder zurück. Bei gleichem Zeitpunkt gilt die spätere Epoche.
 */
function mergeEpoch(a: AppState, b: AppState): { epoch: number; epochTs: number } {
  if (a.epochTs !== b.epochTs) return a.epochTs > b.epochTs ? { epoch: a.epoch, epochTs: a.epochTs } : { epoch: b.epoch, epochTs: b.epochTs };
  return { epoch: Math.max(a.epoch, b.epoch), epochTs: a.epochTs };
}

/** Je Gerät gewinnt der jüngere Eintrag. */
function mergeDevices(a: Record<string, DeviceInfo>, b: Record<string, DeviceInfo>): Record<string, DeviceInfo> {
  const out = { ...a };
  for (const [name, d] of Object.entries(b)) if (!out[name] || d.ts > out[name].ts) out[name] = d;
  return out;
}

/** Unbekannte Felder: alle behalten. Bei demselben Schlüssel gewinnt deterministisch die größere Schreibweise. */
function mergeExt(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!(k in out) || JSON.stringify(v) > JSON.stringify(out[k])) out[k] = v;
  }
  return out;
}

export function mergeStates(a: AppState, b: AppState): AppState {
  const { epoch, epochTs } = mergeEpoch(a, b);
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
    epochTs,
    devices: mergeDevices(a.devices, b.devices),
    ext: mergeExt(a.ext, b.ext),
  };
}

/** Was in die Sync-Datei geschrieben wird. Der Wiederholungsplan fehlt bewusst, er wird aus dem Verlauf berechnet. */
export interface RemoteState {
  app: 'road-to-gm';
  /** bleibt 1, weil App-Versionen bis 1.1 genau das verlangen */
  schema: 1;
  /** Erst Geräte mit mindestens dieser Lese-Stufe (version.ts) dürfen die Datei lesen und schreiben */
  minReader: number;
  epoch: number;
  /** fehlt in Dateien älterer Versionen, dann gilt die Epoche selbst */
  epochTs: number;
  log: ReviewEntry[];
  hidden: Record<string, HiddenEntry>;
  settings: Settings;
  settingsTs: number;
  bonus?: { day: string; n: number };
  devices: Record<string, DeviceInfo>;
  /** weitere Felder späterer Versionen kommen hier oben auf dieselbe Ebene und werden unverändert weitergereicht */
  [key: string]: unknown;
}

export function toRemote(s: AppState): RemoteState {
  const log = mergeLogs(s.log, [], s.epoch);
  return {
    ...s.ext,
    app: 'road-to-gm',
    schema: 1,
    minReader: READER_LEVEL,
    epoch: s.epoch,
    epochTs: s.epochTs,
    log,
    hidden: s.hidden,
    settings: s.settings,
    settingsTs: s.settingsTs,
    bonus: s.bonus,
    devices: s.devices,
  };
}

const KNOWN_KEYS = new Set(['app', 'schema', 'minReader', 'epoch', 'epochTs', 'log', 'hidden', 'settings', 'settingsTs', 'bonus', 'devices']);

/** Welche Lese-Stufe braucht diese Datei? Dateien ohne Angabe stammen aus Versionen vor 1.2 (Stufe 1). */
export function readerNeeded(raw: unknown): number {
  const m = raw && typeof raw === 'object' ? (raw as { minReader?: unknown }).minReader : undefined;
  return typeof m === 'number' && Number.isFinite(m) ? m : 1;
}

/** Prüft die Form einer gelesenen Sync-Datei und baut daraus einen Stand. null = unbrauchbar (oder braucht eine neuere App). */
export function fromRemote(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<RemoteState>;
  if (r.app !== 'road-to-gm' || typeof r.schema !== 'number' || !Array.isArray(r.log)) return null;
  if (readerNeeded(raw) > READER_LEVEL) return null;
  const ok = r.log.every(
    (e) => e && typeof e.id === 'string' && typeof e.ts === 'number' && (e.grade === 1 || e.grade === 2 || e.grade === 3 || !countsForSchedule(e)),
  );
  if (!ok) return null;
  const ext = Object.fromEntries(Object.entries(r).filter(([k]) => !KNOWN_KEYS.has(k)));
  const base = normalize({ ...r, cards: {}, ext });
  const log = mergeLogs(base.log, [], base.epoch).map((e) => ({ ...e, dur: typeof e.dur === 'number' ? e.dur : e.ms ?? 0, ms: typeof e.ms === 'number' ? e.ms : 0 }));
  return { ...base, log, cards: replay(log) };
}

/** Feste Schreibweise für Vergleiche: gleiche Daten ergeben denselben Text. */
export function canonical(r: RemoteState): string {
  const hidden = Object.fromEntries(Object.entries(r.hidden).sort(([x], [y]) => (x < y ? -1 : 1)));
  const devices = Object.fromEntries(Object.entries(r.devices).sort(([x], [y]) => (x < y ? -1 : 1)));
  // feste Reihenfolge der Felder auf oberster Ebene, auch bei unbekannten: gleiche Daten ergeben denselben Text
  const all: Record<string, unknown> = { ...r, hidden, devices, bonus: r.bonus ?? null };
  return JSON.stringify(Object.fromEntries(Object.entries(all).sort(([x], [y]) => (x < y ? -1 : 1))));
}

export { emptyState };
