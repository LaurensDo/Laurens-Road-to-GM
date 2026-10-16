import { get, set } from 'idb-keyval';
import { useEffect, useState } from 'preact/hooks';
import { normalize } from './normalize';
import { emptyState, type AppState } from './types';

const KEY = 'road-to-gm-state-v1';
let state: AppState = emptyState();
const listeners = new Set<() => void>();
let saveTimer: number | undefined;
let loaded = false;

function notify() {
  listeners.forEach((l) => l());
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

const changeHooks = new Set<() => void>();

/** Wird bei jeder lokalen Änderung aufgerufen (nicht beim Übernehmen eines Abgleichs). */
export function onLocalChange(fn: () => void): () => void {
  changeHooks.add(fn);
  return () => changeHooks.delete(fn);
}

export function update(fn: (s: AppState) => AppState): void {
  state = fn(state);
  notify();
  scheduleSave();
  changeHooks.forEach((h) => h());
}

/** Übernimmt einen zusammengeführten Stand aus dem Abgleich, ohne einen weiteren Abgleich anzustoßen. */
export function applyMerged(next: AppState): void {
  state = next;
  notify();
  scheduleSave();
}

export function isLoaded(): boolean {
  return loaded;
}

export function replaceState(raw: unknown): void {
  state = normalize(raw);
  notify();
  void saveNow();
  changeHooks.forEach((h) => h());
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
    // Die Epoche der Sicherung gilt ab jetzt, auch gegenüber einem späteren Zurücksetzen auf einem anderen Gerät.
    // Sonst würde der Abgleich die wiederhergestellten Antworten gleich wieder verwerfen.
    replaceState({ ...raw, epochTs: Date.now() });
    return { ok: true, message: 'Trainingsstand wiederhergestellt.' };
  } catch {
    return { ok: false, message: 'Der Text ist kein gültiges JSON.' };
  }
}
