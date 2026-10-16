import { get, del, set } from 'idb-keyval';
import { useEffect, useState } from 'preact/hooks';
import { applyMerged, getState, isLoaded, onLocalChange } from './store';
import { DEFAULT_PATH, REPO_PATTERN, SyncError, makeSetupCode, parseSetupCode, syncOnce, verify, type SyncConfig } from './sync';

export type SyncState = 'off' | 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncStatus {
  state: SyncState;
  repo: string | null;
  last: number | null; // letzter erfolgreicher Abgleich
  message: string | null;
  errorKind: string | null;
}

const CFG_KEY = 'road-to-gm-sync-config-v1';
const DEBOUNCE_MS = 15000;
const MIN_GAP_MS = 30000;

let config: SyncConfig | null = null;
let status: SyncStatus = { state: 'off', repo: null, last: null, message: null, errorKind: null };
const listeners = new Set<() => void>();
let timer: number | undefined;
let inFlight: Promise<void> | null = null;
let again = false;
let started = false;

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function useSyncStatus(): SyncStatus {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return status;
}

export function isConnected(): boolean {
  return config !== null;
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const kind = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : 'Gerät';
  return `${kind}-${Math.random().toString(36).slice(2, 6)}`;
}

function describe(e: unknown): { message: string; kind: string } {
  if (e instanceof SyncError) return { message: e.message, kind: e.kind };
  return { message: 'Unerwarteter Fehler beim Abgleich.', kind: 'other' };
}

export async function syncNow(): Promise<void> {
  if (!config || !isLoaded()) return;
  if (inFlight) {
    again = true;
    return inFlight;
  }
  if (!navigator.onLine) {
    setStatus({ state: 'offline', message: 'Offline. Der Abgleich läuft, sobald du wieder online bist.', errorKind: 'network' });
    return;
  }
  window.clearTimeout(timer);
  setStatus({ state: 'syncing', message: null, errorKind: null });
  const cfg = config;
  inFlight = (async () => {
    try {
      const out = await syncOnce({ fetch: window.fetch.bind(window) }, cfg, { getState, setState: applyMerged });
      // Inzwischen getrennt oder neu verbunden: Das Ergebnis gehört zur alten Verbindung und darf den Status nicht überschreiben
      if (config === cfg) setStatus({ state: 'idle', last: out.at, message: null, errorKind: null });
    } catch (e) {
      if (config === cfg) {
        const d = describe(e);
        setStatus({ state: d.kind === 'network' ? 'offline' : 'error', message: d.message, errorKind: d.kind });
      }
    } finally {
      inFlight = null;
      if (again) {
        again = false;
        void syncNow();
      }
    }
  })();
  return inFlight;
}

function schedule(ms = DEBOUNCE_MS) {
  if (!config) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), ms);
}

export async function initSync(): Promise<void> {
  if (started) return;
  started = true;
  try {
    config = (await get<SyncConfig>(CFG_KEY)) ?? null;
  } catch {
    config = null;
  }
  if (config) {
    setStatus({ state: 'idle', repo: config.repo });
    void syncNow();
  }
  onLocalChange(() => schedule());
  document.addEventListener('visibilitychange', () => {
    if (!config) return;
    if (document.visibilityState === 'hidden') void syncNow();
    else if (!status.last || Date.now() - status.last > MIN_GAP_MS) void syncNow();
  });
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => config && setStatus({ state: 'offline', message: 'Offline. Der Abgleich läuft, sobald du wieder online bist.' }));
}

export interface ConnectInput {
  repo: string;
  token: string;
  path?: string;
}

export async function connect(input: ConnectInput): Promise<{ ok: boolean; message: string }> {
  const repo = input.repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  const token = input.token.trim();
  if (!REPO_PATTERN.test(repo)) return { ok: false, message: 'Das Repository muss so aussehen: besitzer/name' };
  if (!token) return { ok: false, message: 'Bitte füge das Token ein.' };
  const cfg: SyncConfig = { repo, token, path: input.path || DEFAULT_PATH, device: config?.device ?? deviceName() };
  try {
    await verify({ fetch: window.fetch.bind(window) }, cfg);
  } catch (e) {
    return { ok: false, message: describe(e).message };
  }
  await set(CFG_KEY, cfg);
  config = cfg;
  setStatus({ state: 'idle', repo, message: null, errorKind: null });
  await syncNow();
  if (status.state === 'error') return { ok: false, message: status.message ?? 'Abgleich fehlgeschlagen.' };
  return { ok: true, message: 'Verbunden. Der Fortschritt wird ab jetzt automatisch abgeglichen.' };
}

export async function disconnect(): Promise<void> {
  window.clearTimeout(timer);
  config = null;
  try {
    await del(CFG_KEY);
  } catch {
    // egal
  }
  setStatus({ state: 'off', repo: null, last: null, message: null, errorKind: null });
}

export function currentSetupCode(): string | null {
  return config ? makeSetupCode(config) : null;
}

export { parseSetupCode };
