import { get, set } from 'idb-keyval';
import { useEffect, useState } from 'preact/hooks';
import { getPrefs } from './device';
import { parseChessComArchive, parseLichessNdjson, type GameRec } from './games';

/**
 * Holt die eigenen Partien (chess.com Monatsarchiv, lichess Export) und hält sie im Speicher des Geräts. Nicht im Abgleich:
 * Jedes Gerät holt selbst, die öffentlichen Schnittstellen brauchen kein Passwort und erlauben Abrufe aus dem Browser (CORS).
 */

/** Ab hier zählen Partien (Stichtag der Diagnose): Davor liegt die eingefrorene Basis, sie wird nicht erneut geholt. */
export const SINCE = Date.parse('2026-10-15T00:00:00Z');
const KEY = 'road-to-gm-games-v1';
/** Der aktuelle Monat wird frühestens nach so vielen Minuten wieder geholt (außer auf Knopfdruck) */
const MIN_GAP_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 20000;

/** Stand der Leselogik. Steigt, wenn ältere Versionen Partien übersehen haben: Die betroffene Quelle wird dann einmal neu geholt. */
const PARSER = 2; // 2: lichess-Partien mit zusätzlicher Uhr am Ende (Zeit, Aufgabe), bis 1.5.0 verworfen

interface Stored {
  games: GameRec[];
  /** Zeitpunkt des letzten erfolgreichen Abrufs je Quelle */
  fetched: { chesscom?: number; lichess?: number };
  /** Monate (JJJJ-MM), die nach ihrem Ende vollständig geholt wurden und nicht mehr abgefragt werden */
  done: string[];
  parser?: number;
}

export type GamesState = 'idle' | 'loading' | 'error' | 'offline';

export interface GamesStatus {
  state: GamesState;
  last: number | null;
  message: string | null;
  /** neue Partien beim letzten Abruf */
  added: number;
}

let data: Stored = { games: [], fetched: {}, done: [] };
let status: GamesStatus = { state: 'idle', last: null, message: null, added: 0 };
let started = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());
const setStatus = (p: Partial<GamesStatus>) => {
  status = { ...status, ...p };
  notify();
};

export const getGames = (): GameRec[] => data.games;
export const getGamesStatus = (): GamesStatus => status;

function useStore<T>(read: () => T): T {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return read();
}
export const useGames = () => useStore(getGames);
export const useGamesStatus = () => useStore(getGamesStatus);

/** Monate (JJJJ-MM, UTC) von `since` bis `now`, die für das chess.com-Archiv in Frage kommen. */
export function monthsBetween(since: number, now: number): string[] {
  const out: string[] = [];
  const a = new Date(since);
  const b = new Date(now);
  let y = a.getUTCFullYear();
  let m = a.getUTCMonth();
  while (y < b.getUTCFullYear() || (y === b.getUTCFullYear() && m <= b.getUTCMonth())) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}

/** Ist der Monat vorbei, und liegt der letzte Abruf eine Stunde danach (damit auch Partien kurz vor Monatsende dabei sind)? */
export function monthComplete(month: string, fetchedAt: number | undefined): boolean {
  if (!fetchedAt) return false;
  const [y, m] = month.split('-').map(Number);
  const end = Date.UTC(y, m, 1); // Beginn des Folgemonats
  return fetchedAt >= end + 3600 * 1000;
}

async function fetchText(url: string, accept?: string): Promise<{ status: number; text: string }> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: accept ? { Accept: accept } : undefined });
    return { status: res.status, text: await res.text() };
  } finally {
    window.clearTimeout(t);
  }
}

async function fetchChessCom(name: string, now: number): Promise<{ games: GameRec[]; done: string[] }> {
  const out: GameRec[] = [];
  const done: string[] = [];
  for (const month of monthsBetween(SINCE, now)) {
    if (data.done.includes(month)) continue;
    const [y, m] = month.split('-');
    const { status: s, text } = await fetchText(`https://api.chess.com/pub/player/${encodeURIComponent(name.toLowerCase())}/games/${y}/${m}`);
    if (s === 404) continue; // Monat ohne Partien, oder Name unbekannt
    if (s === 429) throw new Error('chess.com bremst gerade. Später noch einmal versuchen.');
    if (s !== 200) throw new Error(`chess.com antwortet mit Fehler ${s}.`);
    out.push(...parseChessComArchive(JSON.parse(text), name));
    if (monthComplete(month, now)) done.push(month);
  }
  return { games: out, done };
}

async function fetchLichess(name: string): Promise<GameRec[]> {
  const last = Math.max(0, ...data.games.filter((g) => g.src === 'lichess').map((g) => g.end));
  const since = Math.max(SINCE, last + 1);
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(name)}?since=${since}&clocks=true&moves=true&opening=false&perfType=bullet,blitz`;
  const { status: s, text } = await fetchText(url, 'application/x-ndjson');
  if (s === 404) return [];
  if (s === 429) throw new Error('lichess bremst gerade. Später noch einmal versuchen.');
  if (s !== 200) throw new Error(`lichess antwortet mit Fehler ${s}.`);
  return parseLichessNdjson(text, name);
}

/** Neue Partien in den Bestand einsortieren. Gibt die Zahl der neuen zurück. */
export function mergeGames(have: GameRec[], incoming: GameRec[]): { games: GameRec[]; added: number } {
  const map = new Map(have.map((g) => [g.id, g]));
  let added = 0;
  for (const g of incoming) {
    if (g.end < SINCE) continue;
    if (!map.has(g.id)) added++;
    map.set(g.id, g);
  }
  return { games: [...map.values()].sort((a, b) => a.end - b.end), added };
}

async function save() {
  try {
    await set(KEY, { ...data, parser: PARSER });
  } catch {
    // Speicher voll oder gesperrt: bleibt im Speicher dieser Sitzung
  }
}

/** Holt neue Partien. Ohne `force` höchstens alle zehn Minuten. */
export async function fetchGamesNow(force = false): Promise<void> {
  if (inFlight) return inFlight;
  const p = getPrefs();
  if (!p.games && !force) return;
  if (!p.chesscom && !p.lichess) return;
  const now = Date.now();
  const lastAny = Math.max(data.fetched.chesscom ?? 0, data.fetched.lichess ?? 0);
  if (!force && now - lastAny < MIN_GAP_MS) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setStatus({ state: 'offline', message: 'Offline. Die Partien werden geholt, sobald du wieder online bist.' });
    return;
  }
  setStatus({ state: 'loading', message: null });
  inFlight = (async () => {
    const errors: string[] = [];
    let incoming: GameRec[] = [];
    if (p.chesscom) {
      try {
        const cc = await fetchChessCom(p.chesscom, now);
        incoming = incoming.concat(cc.games);
        // abgeschlossene Monate erst merken, wenn alles geklappt hat: sonst gingen ihre Partien bei einem späteren Fehler verloren
        data.done = [...new Set([...data.done, ...cc.done])];
        data.fetched.chesscom = now;
      } catch (e) {
        errors.push(e instanceof Error && e.name !== 'AbortError' && e.name !== 'TypeError' ? e.message : 'chess.com ist gerade nicht erreichbar.');
      }
    }
    if (p.lichess) {
      try {
        incoming = incoming.concat(await fetchLichess(p.lichess));
        data.fetched.lichess = now;
      } catch (e) {
        errors.push(e instanceof Error && e.name !== 'AbortError' && e.name !== 'TypeError' ? e.message : 'lichess ist gerade nicht erreichbar.');
      }
    }
    const m = mergeGames(data.games, incoming);
    data.games = m.games;
    await save();
    setStatus({ state: errors.length ? 'error' : 'idle', last: errors.length ? status.last : Date.now(), message: errors.join(' ') || null, added: m.added });
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Lädt den Bestand vom Gerät und holt neue Partien (beim Start und bei der Rückkehr in den Vordergrund). */
export async function initGames(): Promise<void> {
  if (started) return;
  started = true;
  let migrated = false;
  try {
    const stored = await get<Stored>(KEY);
    if (stored && Array.isArray(stored.games)) data = { games: stored.games.filter((g) => g.end >= SINCE), fetched: stored.fetched ?? {}, done: stored.done ?? [] };
    // Bestand einer älteren Leselogik: lichess-Partien verwerfen, damit der nächste Abruf ab dem Stichtag alles neu holt
    if (stored && (stored.parser ?? 1) < 2) {
      data = { ...data, games: data.games.filter((g) => g.src !== 'lichess') };
      migrated = true;
    }
  } catch {
    // leerer Bestand
  }
  const lastAny = Math.max(data.fetched.chesscom ?? 0, data.fetched.lichess ?? 0);
  setStatus({ last: lastAny || null });
  // nach dem Verwerfen gleich neu holen, nicht erst nach zehn Minuten (außer das Holen ist ausgeschaltet)
  void fetchGamesNow(migrated && getPrefs().games);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void fetchGamesNow();
  });
  window.addEventListener('online', () => void fetchGamesNow());
}

/** Alle Partien vergessen (Einstellungen) und neu holen. */
export async function resetGames(): Promise<void> {
  data = { games: [], fetched: {}, done: [] };
  await save();
  setStatus({ last: null, added: 0, message: null });
  await fetchGamesNow(true);
}
