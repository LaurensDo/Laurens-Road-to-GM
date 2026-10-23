import { DEFAULT_SETTINGS, emptyState, type AppState, type DeviceInfo, type HiddenEntry } from './types';

function normalizeHidden(raw: unknown): Record<string, HiddenEntry> {
  if (Array.isArray(raw)) return Object.fromEntries(raw.map((id) => [String(id), { on: true, ts: 0 }]));
  if (raw && typeof raw === 'object') {
    const out: Record<string, HiddenEntry> = {};
    for (const [id, v] of Object.entries(raw as Record<string, Partial<HiddenEntry>>)) {
      if (v && typeof v === 'object') out[id] = { on: v.on === true, ts: typeof v.ts === 'number' ? v.ts : 0 };
    }
    return out;
  }
  return {};
}

function normalizeDevices(raw: unknown): Record<string, DeviceInfo> {
  const out: Record<string, DeviceInfo> = {};
  if (raw && typeof raw === 'object') {
    for (const [name, v] of Object.entries(raw as Record<string, Partial<DeviceInfo>>)) {
      if (v && typeof v === 'object' && typeof v.v === 'string') out[name] = { v: v.v, ts: typeof v.ts === 'number' ? v.ts : 0 };
    }
  }
  return out;
}

type Bonus = { day: string; n: number };
const bonusOk = (v: unknown): v is Bonus => !!v && typeof v === 'object' && typeof (v as Bonus).day === 'string' && typeof (v as Bonus).n === 'number';

function normalizeBonusBy(raw: unknown): AppState['bonusBy'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: NonNullable<AppState['bonusBy']> = {};
  if (bonusOk(r.sicher)) out.sicher = { day: r.sicher.day, n: r.sicher.n };
  if (bonusOk(r.endspiel)) out.endspiel = { day: r.endspiel.day, n: r.endspiel.n };
  return out.sicher || out.endspiel ? out : undefined;
}

export function normalize(raw: unknown): AppState {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppState> & { hidden?: unknown; devices?: unknown; ext?: unknown };
  const epoch = typeof r.epoch === 'number' ? r.epoch : 0;
  const settingsTs = typeof r.settingsTs === 'number' ? r.settingsTs : 0;
  const bonusBy = normalizeBonusBy(r.bonusBy);
  return {
    version: 1,
    cards: r.cards && typeof r.cards === 'object' ? r.cards : {},
    log: Array.isArray(r.log) ? r.log : [],
    bonus: r.bonus,
    ...(bonusBy ? { bonusBy } : {}),
    hidden: normalizeHidden(r.hidden),
    epoch,
    // ältere Stände kennen nur die Epoche: Sie wurde beim Zurücksetzen auf die damalige Uhrzeit gesetzt
    epochTs: typeof r.epochTs === 'number' ? r.epochTs : epoch,
    devices: normalizeDevices(r.devices),
    ext: r.ext && typeof r.ext === 'object' && !Array.isArray(r.ext) ? (r.ext as Record<string, unknown>) : {},
    settingsTs,
    // Nie geändert (Zeitpunkt 0): Dann gelten die aktuellen Vorgaben, auch wenn eine ältere Version andere gespeichert hat (Zeitlimit früher 10 s)
    settings:
      settingsTs === 0
        ? { ...DEFAULT_SETTINGS, filters: { ...DEFAULT_SETTINGS.filters } }
        : {
            ...DEFAULT_SETTINGS,
            ...(r.settings ?? {}),
            filters: { ...DEFAULT_SETTINGS.filters, ...(r.settings?.filters ?? {}) },
          },
  };
}
