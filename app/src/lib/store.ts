import { get, set } from 'idb-keyval';
import { useEffect, useState } from 'preact/hooks';
import { DEFAULT_SETTINGS, emptyState, type AppState } from './types';

const KEY = 'road-to-gm-state-v1';
let state: AppState = emptyState();
const listeners = new Set<() => void>();
let saveTimer: number | undefined;
let loaded = false;

function notify() {
  listeners.forEach((l) => l());
}

function normalize(raw: unknown): AppState {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppState>;
  return {
    version: 1,
    cards: r.cards && typeof r.cards === 'object' ? r.cards : {},
    log: Array.isArray(r.log) ? r.log : [],
    bonus: r.bonus,
    hidden: Array.isArray(r.hidden) ? r.hidden : [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...(r.settings ?? {}),
      filters: { ...DEFAULT_SETTINGS.filters, ...(r.settings?.filters ?? {}) },
    },
  };
}

export async function loadState(): Promise<void> {
  try {
    const stored = await get<string>(KEY);
    if (stored) state = normalize(JSON.parse(stored));
  } catch {
    // Beschädigter oder nicht lesbarer Speicher: mit leerem Stand starten
    state = emptyState();
  }
  loaded = true;
  try {
    await navigator.storage?.persist?.();
  } catch {
    // optional
  }
  notify();
}

async function saveNow() {
  window.clearTimeout(saveTimer);
  saveTimer = undefined;
  if (!loaded) return;
  try {
    await set(KEY, JSON.stringify(state));
  } catch {
    // Speicher voll oder gesperrt: der Stand bleibt im Speicher, Export bleibt möglich
  }
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 250);
}

export function getState(): AppState {
  return state;
}

export function update(fn: (s: AppState) => AppState): void {
  state = fn(state);
  notify();
  scheduleSave();
}

export function replaceState(raw: unknown): void {
  state = normalize(raw);
  notify();
  void saveNow();
}

export function useAppState(): AppState {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void saveNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void saveNow();
  });
}

export function exportJson(): string {
  return JSON.stringify({ app: 'road-to-gm', exported: new Date().toISOString(), state }, null, 1);
}

export function importJson(text: string): { ok: boolean; message: string } {
  try {
    const parsed = JSON.parse(text);
    const raw = parsed?.state ?? parsed;
    if (!raw || typeof raw !== 'object' || !('cards' in raw) || !('log' in raw)) {
      return { ok: false, message: 'Die Datei enthält keinen gültigen Trainingsstand.' };
    }
    replaceState(raw);
    return { ok: true, message: 'Trainingsstand wiederhergestellt.' };
  } catch {
    return { ok: false, message: 'Der Text ist kein gültiges JSON.' };
  }
}
