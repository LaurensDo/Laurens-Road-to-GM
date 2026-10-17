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

export function normalize(raw: unknown): AppState {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppState> & { hidden?: unknown; devices?: unknown; ext?: unknown };
  const epoch = typeof r.epoch === 'number' ? r.epoch : 0;
  return {
    version: 1,
    cards: r.cards && typeof r.cards === 'object' ? r.cards : {},
    log: Array.isArray(r.log) ? r.log : [],
    bonus: r.bonus,
    hidden: normalizeHidden(r.hidden),
    epoch,
    // ältere Stände kennen nur die Epoche: Sie wurde beim Zurücksetzen auf die damalige Uhrzeit gesetzt
    epochTs: typeof r.epochTs === 'number' ? r.epochTs : epoch,
    devices: normalizeDevices(r.devices),
    ext: r.ext && typeof r.ext === 'object' && !Array.isArray(r.ext) ? (r.ext as Record<string, unknown>) : {},
    settingsTs: typeof r.settingsTs === 'number' ? r.settingsTs : 0,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(r.settings ?? {}),
      filters: { ...DEFAULT_SETTINGS.filters, ...(r.settings?.filters ?? {}) },
    },
  };
}
