import { useEffect, useState } from 'preact/hooks';

/**
 * Einstellungen, die nur für dieses Gerät gelten (nicht im Abgleich): iPhone und iPad dürfen unterschiedlich laut sein.
 * Liegen in localStorage, damit sie beim ersten Ton schon da sind.
 */

export type TimerSound = 'off' | 'end' | 'standard' | 'every';

export interface DevicePrefs {
  sound: boolean;
  /** 1 leise, 2 mittel, 3 laut */
  volume: 1 | 2 | 3;
  timerSound: TimerSound;
  /** Ton auch bei aktivem Stummschalter (iOS 16.4+) */
  ignoreMute: boolean;
  /** Startbild beim Öffnen der App */
  splash: boolean;
  /** Eigene Partien beim Öffnen automatisch holen (chess.com und lichess) */
  games: boolean;
  /** Spielernamen für den Abruf (öffentliche Schnittstellen, kein Passwort). Leer = nicht holen. */
  chesscom: string;
  lichess: string;
}

export const DEFAULT_PREFS: DevicePrefs = {
  sound: true,
  volume: 2,
  timerSound: 'standard',
  ignoreMute: false,
  splash: true,
  games: true,
  chesscom: 'laurens3495',
  lichess: 'Poquitonator',
};

const KEY = 'road-to-gm-device-v1';
let prefs: DevicePrefs = load();
const listeners = new Set<() => void>();

function load(): DevicePrefs {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) return clean(JSON.parse(raw));
  } catch {
    // gesperrter Speicher: Standardwerte
  }
  return { ...DEFAULT_PREFS };
}

export function clean(raw: unknown): DevicePrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<DevicePrefs>;
  return {
    sound: typeof r.sound === 'boolean' ? r.sound : DEFAULT_PREFS.sound,
    volume: r.volume === 1 || r.volume === 2 || r.volume === 3 ? r.volume : DEFAULT_PREFS.volume,
    timerSound: r.timerSound === 'off' || r.timerSound === 'end' || r.timerSound === 'standard' || r.timerSound === 'every' ? r.timerSound : DEFAULT_PREFS.timerSound,
    ignoreMute: typeof r.ignoreMute === 'boolean' ? r.ignoreMute : DEFAULT_PREFS.ignoreMute,
    splash: typeof r.splash === 'boolean' ? r.splash : DEFAULT_PREFS.splash,
    games: typeof r.games === 'boolean' ? r.games : DEFAULT_PREFS.games,
    chesscom: typeof r.chesscom === 'string' ? r.chesscom.trim().slice(0, 40) : DEFAULT_PREFS.chesscom,
    lichess: typeof r.lichess === 'string' ? r.lichess.trim().slice(0, 40) : DEFAULT_PREFS.lichess,
  };
}

export function getPrefs(): DevicePrefs {
  return prefs;
}

export function setPrefs(patch: Partial<DevicePrefs>): void {
  prefs = clean({ ...prefs, ...patch });
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // bleibt im Speicher
  }
  listeners.forEach((l) => l());
}

export function usePrefs(): DevicePrefs {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return prefs;
}
