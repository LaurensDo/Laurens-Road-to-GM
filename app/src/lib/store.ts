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

/** Meldung, wenn der Speicher sich nicht lesen ließ. Die App startet dann nicht, damit nichts den echten Stand überschreibt. */
export const READ_FAILED = 'Der Trainingsstand auf diesem Gerät ließ sich gerade nicht lesen. Schließe die App ganz und öffne sie neu. Es wurde nichts überschrieben.';

/**
 * Lädt den Stand. Ein Lesefehler (IndexedDB unter iOS gelegentlich nach dem Aufwachen) wird wiederholt und endet sonst mit einem Fehler:
 * Früher startete die App dann leer, und das nächste Speichern überschrieb den echten Stand. Unlesbarer Inhalt wird beiseitegelegt, nicht gelöscht.
 */
export async function loadState(): Promise<void> {
  let stored: string | undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      stored = await get<string>(KEY);
      break;
    } catch {
      if (attempt >= 2) throw new Error(READ_FAILED);
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  if (stored) {
    try {
      state = normalize(JSON.parse(stored));
    } catch {
      try {
        await set(`${KEY}-defekt-${Date.now()}`, stored);
      } catch {
        throw new Error(READ_FAILED);
      }
      state = emptyState();
    }
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
