import { useEffect, useState } from 'preact/hooks';

/**
 * Update-Weg. Eine installierte Web-App auf iOS bleibt tagelang im Speicher, der Service Worker holt eine neue Version zwar
 * im Hintergrund, aber die Seite läuft mit dem alten Code weiter. Deshalb liest die App beim Öffnen und bei der Rückkehr in
 * den Vordergrund `version.json` am Zwischenspeicher vorbei. Ist sie neuer als der laufende Stand, stößt sie den Service
 * Worker an. Danach lädt sie neu, aber nur dort, wo nichts verloren geht (Heute, Fortschritt). Ist gerade ein Satz offen,
 * erscheint danach auf Heute ein Hinweis zum Antippen.
 */

export interface VersionInfo {
  version: string;
  build: string;
}

type Phase = 'idle' | 'updating' | 'ready';
let phase: Phase = 'idle';
let safe: () => boolean = () => false;
let started = false;
let checking = false;
const listeners = new Set<() => void>();

const MARK = 'road-to-gm-update-v1';
/** Build, für den gerade neu geladen werden soll */
let target: string | null = null;

function set(p: Phase) {
  phase = p;
  listeners.forEach((l) => l());
}

/** Ist die Version auf dem Server neuer als die laufende? (ISO-Zeitstempel, vergleichbar als Text) */
export function isNewer(server: Pick<VersionInfo, 'build'> | null, running: string): boolean {
  return !!server && typeof server.build === 'string' && server.build > running;
}

export function useUpdateReady(): boolean {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return phase === 'ready';
}

/**
 * Schutz vor Endlosschleifen: Wurde für genau diesen Build schon neu geladen und die Seite läuft trotzdem noch mit einem älteren
 * (der Service Worker lieferte noch alte Dateien), wird nicht noch einmal geladen. Ein noch neuerer Build ist wieder erlaubt.
 */
function alreadyTried(build: string): boolean {
  try {
    return sessionStorage.getItem(MARK) === build;
  } catch {
    return false;
  }
}

/** Neu laden. Wird auch vom Hinweis zum Antippen aufgerufen. */
export function applyUpdate(): void {
  try {
    if (target) sessionStorage.setItem(MARK, target);
  } catch {
    // ohne Speicher gibt es nur keinen Schutz vor Schleifen
  }
  location.reload();
}

async function readVersion(base: string): Promise<VersionInfo | null> {
  try {
    const res = await fetch(`${base}version.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as VersionInfo;
  } catch {
    return null;
  }
}

/**
 * Sorgt dafür, dass der neueste Service Worker aktiv ist (er hat dann alle neuen Dateien im Zwischenspeicher). Gibt false zurück,
 * wenn das nicht klappt (offline, Zeitlimit). Hat iOS ihn im Hintergrund schon aktiviert, ist nichts zu warten: nur die Seite selbst ist noch alt.
 */
async function ensureLatestWorker(reg: ServiceWorkerRegistration, ms: number): Promise<boolean> {
  try {
    await reg.update();
  } catch {
    return false;
  }
  const w = reg.installing ?? reg.waiting;
  if (!w || w.state === 'activated') return true;
  return new Promise((resolve) => {
    const t = window.setTimeout(() => resolve(false), ms);
    w.addEventListener('statechange', () => {
      if (w.state === 'activated') {
        window.clearTimeout(t);
        resolve(true);
      } else if (w.state === 'redundant') {
        window.clearTimeout(t);
        resolve(false);
      }
    });
  });
}

export async function checkForUpdate(): Promise<void> {
  // offline gibt es nichts zu prüfen (und keine Fehlermeldung in der Konsole)
  if (checking || phase === 'ready' || !('serviceWorker' in navigator) || navigator.onLine === false) return;
  checking = true;
  try {
    const server = await readVersion(import.meta.env.BASE_URL);
    if (!isNewer(server, __BUILD__)) return;
    if (!server || alreadyTried(server.build)) return;
    target = server.build;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    set('updating');
    // Der neue Service Worker (skipWaiting, clientsClaim) holt alle Dateien und übernimmt die Seite. Erst dann ist ein Neuladen sinnvoll.
    const ok = await ensureLatestWorker(reg, 30000);
    if (!ok) {
      set('idle');
      return;
    }
    if (safe()) applyUpdate();
    else set('ready');
  } finally {
    checking = false;
  }
}

/**
 * Startet die Prüfung. `isSafe` sagt, ob gerade neu geladen werden darf (nicht mitten in einem Satz, nicht in den Einstellungen).
 * Ist gerade kein sicherer Moment, meldet useUpdateReady() eine bereitstehende Version (für den Hinweis zum Antippen).
 */
export function startUpdater(isSafe: () => boolean): void {
  safe = isSafe;
  if (started || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  started = true;
  void checkForUpdate();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
}
