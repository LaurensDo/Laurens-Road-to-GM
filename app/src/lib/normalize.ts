import { DEFAULT_SETTINGS, emptyState, type AppState, type HiddenEntry } from './types';

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

export function normalize(raw: unknown): AppState {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppState> & { hidden?: unknown };
  return {
    version: 1,
    cards: r.cards && typeof r.cards === 'object' ? r.cards : {},
    log: Array.isArray(r.log) ? r.log : [],
    bonus: r.bonus,
    hidden: normalizeHidden(r.hidden),
    epoch: typeof r.epoch === 'number' ? r.epoch : 0,
    settingsTs: typeof r.settingsTs === 'number' ? r.settingsTs : 0,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(r.settings ?? {}),
      filters: { ...DEFAULT_SETTINGS.filters, ...(r.settings?.filters ?? {}) },
    },
  };
}
