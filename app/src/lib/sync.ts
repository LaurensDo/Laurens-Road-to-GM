import { canonical, fromRemote, mergeStates, toRemote, type RemoteState } from './merge';
import { emptyState, type AppState } from './types';

/**
 * Abgleich über eine Datei in einem privaten GitHub-Repository (Contents-API).
 * Läuft ohne eigenen Server. Das Token liegt nur auf dem Gerät und gilt nur für dieses eine Repository.
 */

export interface SyncConfig {
  repo: string; // "besitzer/name"
  token: string;
  path: string;
  device: string; // Kurzname des Geräts für die Commit-Nachrichten
}

export const DEFAULT_PATH = 'road-to-gm/state.json';
const API: string = (import.meta.env?.VITE_SYNC_API as string | undefined) ?? 'https://api.github.com';

export type SyncErrorKind = 'auth' | 'access' | 'notfound' | 'public' | 'network' | 'format' | 'conflict' | 'other';

export class SyncError extends Error {
  kind: SyncErrorKind;
  constructor(kind: SyncErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export interface Ctx {
  fetch: typeof fetch;
}

export const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

// ---- Base64 mit UTF-8 (btoa allein kann keine Umlaute und scheitert bei langen Texten)
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function headers(cfg: SyncConfig, accept = 'application/vnd.github+json'): Record<string, string> {
  return { Authorization: `Bearer ${cfg.token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' };
}

async function call(ctx: Ctx, cfg: SyncConfig, url: string, init: RequestInit = {}, accept?: string): Promise<Response> {
  let res: Response;
  try {
    // GitHub erlaubt dem Browser, Antworten 60 s zu cachen (Cache-Control: private, max-age=60). Ohne no-store liest der
    // Abgleich in dieser Zeit einen veralteten Stand, und nach einem Konflikt (409) käme bei jedem neuen Versuch derselbe alte sha.
    res = await ctx.fetch(`${API}${url}`, { ...init, cache: 'no-store', headers: { ...headers(cfg, accept), ...(init.headers as Record<string, string> | undefined) } });
  } catch {
    throw new SyncError('network', 'Keine Verbindung zu GitHub. Der Abgleich läuft, sobald du wieder online bist.');
  }
  if (res.status === 401) throw new SyncError('auth', 'GitHub akzeptiert das Token nicht. Es ist ungültig oder abgelaufen. Erstelle ein neues.');
  if (res.status === 403 || res.status === 429) {
    throw new SyncError('access', 'Zugriff verweigert. Das Token braucht für dieses Repository „Contents: Read and write“. Oder GitHub hat kurz gebremst.');
  }
  return res;
}

/** Prüft Repository, Zugriff und dass es privat ist. */
export async function verify(ctx: Ctx, cfg: SyncConfig): Promise<void> {
  if (!REPO_PATTERN.test(cfg.repo)) throw new SyncError('notfound', 'Das Repository muss so aussehen: besitzer/name');
  const res = await call(ctx, cfg, `/repos/${cfg.repo}`);
  if (res.status === 404) throw new SyncError('notfound', 'Repository nicht gefunden oder das Token hat darauf keinen Zugriff.');
  if (!res.ok) throw new SyncError('other', `GitHub antwortet mit Fehler ${res.status}.`);
  const info = (await res.json()) as { private?: boolean; permissions?: { push?: boolean } };
  if (info.private !== true) {
    throw new SyncError('public', 'Das Repository ist öffentlich. Dein Fortschritt wäre für alle lesbar. Lege ein privates Repository an.');
  }
  if (info.permissions && info.permissions.push === false) {
    throw new SyncError('access', 'Das Token darf in diesem Repository nichts schreiben. Es braucht „Contents: Read and write“.');
  }
}

export interface RemoteFile {
  remote: AppState | null; // null = Datei gibt es noch nicht
  sha: string | null;
}

export async function fetchRemote(ctx: Ctx, cfg: SyncConfig): Promise<RemoteFile> {
  const url = `/repos/${cfg.repo}/contents/${cfg.path}`;
  const res = await call(ctx, cfg, url);
  if (res.status === 404) return { remote: null, sha: null };
  if (!res.ok) throw new SyncError('other', `GitHub antwortet mit Fehler ${res.status}.`);
  const meta = (await res.json()) as { sha?: string; content?: string; encoding?: string; size?: number; type?: string };
  if (Array.isArray(meta) || meta.type === 'dir' || !meta.sha) throw new SyncError('format', 'Der Pfad der Sync-Datei zeigt auf einen Ordner.');
  let text: string;
  if (meta.encoding === 'base64' && typeof meta.content === 'string' && meta.content.length > 0) {
    text = fromBase64(meta.content);
  } else if ((meta.size ?? 0) > 0) {
    // Dateien über 1 MB liefert GitHub nur im Rohformat
    const raw = await call(ctx, cfg, url, {}, 'application/vnd.github.raw+json');
    if (!raw.ok) throw new SyncError('other', `GitHub antwortet mit Fehler ${raw.status}.`);
    text = await raw.text();
  } else {
    text = '';
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SyncError('format', 'Die Sync-Datei im Repository ist nicht lesbar. Sie wird nicht überschrieben.');
  }
  const state = fromRemote(parsed);
  if (!state) throw new SyncError('format', 'Die Sync-Datei hat ein unbekanntes Format. Sie wird nicht überschrieben.');
  return { remote: state, sha: meta.sha };
}

export type PutResult = { ok: true; sha: string } | { ok: false; conflict: true };

export async function putRemote(ctx: Ctx, cfg: SyncConfig, body: RemoteState, sha: string | null): Promise<PutResult> {
  const res = await call(ctx, cfg, `/repos/${cfg.repo}/contents/${cfg.path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Abgleich von ${cfg.device}`,
      content: toBase64(JSON.stringify(body)),
      ...(sha ? { sha } : {}),
    }),
  });
  if (res.status === 409 || res.status === 422) return { ok: false, conflict: true };
  if (res.status === 404) throw new SyncError('notfound', 'Repository nicht gefunden oder das Token darf dort nicht schreiben.');
  if (!res.ok) throw new SyncError('other', `GitHub antwortet mit Fehler ${res.status}.`);
  const json = (await res.json()) as { content?: { sha?: string } };
  return { ok: true, sha: json.content?.sha ?? '' };
}

export interface SyncIO {
  getState: () => AppState;
  setState: (s: AppState) => void;
}

export interface SyncOutcome {
  pushed: boolean;
  at: number;
}

/**
 * Ein Abgleich: lesen, zusammenführen, lokal übernehmen, bei Unterschied zurückschreiben.
 * Bei gleichzeitigem Schreiben von zwei Geräten (Konflikt) wird neu gelesen und erneut zusammengeführt.
 */
export async function syncOnce(ctx: Ctx, cfg: SyncConfig, io: SyncIO, now: () => number = Date.now): Promise<SyncOutcome> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { remote, sha } = await fetchRemote(ctx, cfg);
    const merged = mergeStates(io.getState(), remote ?? emptyState());
    io.setState(merged);
    const body = toRemote(merged);
    if (remote && canonical(body) === canonical(toRemote(remote))) return { pushed: false, at: now() };
    const res = await putRemote(ctx, cfg, body, sha);
    if (res.ok) return { pushed: true, at: now() };
  }
  throw new SyncError('conflict', 'Abgleich nach mehreren Versuchen nicht möglich, weil ein anderes Gerät gleichzeitig schreibt. Versuche es gleich noch einmal.');
}

// ---- Einrichtungscode: Repo und Token für das zweite Gerät, per Zwischenablage übertragbar
const CODE_PREFIX = 'rtgm1.';

function b64url(text: string): string {
  return toBase64(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  return fromBase64(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

export function makeSetupCode(cfg: Pick<SyncConfig, 'repo' | 'token' | 'path'>): string {
  return CODE_PREFIX + b64url(JSON.stringify({ r: cfg.repo, t: cfg.token, p: cfg.path }));
}

export function parseSetupCode(text: string): Pick<SyncConfig, 'repo' | 'token' | 'path'> | null {
  const t = text.trim();
  if (!t.startsWith(CODE_PREFIX)) return null;
  try {
    const o = JSON.parse(unb64url(t.slice(CODE_PREFIX.length))) as { r?: string; t?: string; p?: string };
    if (!o.r || !o.t || !REPO_PATTERN.test(o.r)) return null;
    return { repo: o.r, token: o.t, path: o.p || DEFAULT_PATH };
  } catch {
    return null;
  }
}
