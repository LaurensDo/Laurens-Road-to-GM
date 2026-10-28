import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usageReport } from '../src/lib/report';
import { emptyState, type AppState, type Exercise, type ReviewEntry } from '../src/lib/types';

/** Auswertung über beide Geräte und Schutz des gespeicherten Stands (1.13.1) */

const db = new Map<string, unknown>();
const failReads = { n: 0 };
vi.mock('idb-keyval', () => ({
  get: async (k: string) => {
    if (failReads.n > 0) {
      failReads.n--;
      throw new Error('Connection to Indexed Database server lost');
    }
    return db.get(k);
  },
  set: async (k: string, v: unknown) => void db.set(k, v),
  del: async (k: string) => void db.delete(k),
}));

const entry = (id: string, ts: number, verdict: ReviewEntry['verdict'], san: string): ReviewEntry => ({
  id, ts, grade: verdict === 'wrong' ? 1 : 3, verdict, ms: 4000, dur: 6000, san,
});
const NOW = new Date('2026-10-28T12:00:00');
const ctx = { now: NOW, appVersion: '1.13.1', build: 'x', dataVersion: 2, holdoutIds: [], byId: new Map<string, Exercise>(),
  queue: { due: 0, learning: 0, newAvailable: 0, newTotal: 0, total: 0, waiting: 0, backlogDays: 0 } };

describe('Auswertung: welche Geräte und welche Züge', () => {
  it('nennt bei Dauerbrennern die gespielten Züge mit Urteil', () => {
    const t = NOW.getTime() - 86400000;
    const log = [entry('x', t, 'wrong', 'Nc7'), entry('x', t + 1000, 'wrong', 'Nc7'), entry('x', t + 2000, 'playable', 'Rb7'), entry('x', t + 3000, 'best', 'Re8')];
    const st: AppState = { ...emptyState(), log, cards: { x: { lapses: 3, reviews: 4 } as never } };
    const r = usageReport(st, ctx);
    expect(r.dauerbrenner[0].zuege).toEqual(['Nc7 falsch', 'Nc7 falsch', 'Rb7 spielbar', 'Re8 bester']);
  });

  it('sagt, ob die Auswertung beide Geräte umfasst', () => {
    const off = usageReport(emptyState(), { ...ctx, sync: { on: false, last: null, error: null } });
    expect(off.abgleich).toEqual({ aktiv: false, letzter: null, umfasst: 'nur dieses Gerät' });
    const on = usageReport(emptyState(), { ...ctx, sync: { on: true, last: new Date('2026-10-28T11:58:00').getTime(), error: null } });
    expect(on.abgleich).toEqual({ aktiv: true, letzter: '2026-10-28 11:58', umfasst: 'alle abgeglichenen Geräte' });
    const failed = usageReport(emptyState(), { ...ctx, sync: { on: true, last: null, error: 'Offline.' } });
    expect(failed.abgleich).toMatchObject({ aktiv: true, fehler: 'Offline.' });
  });
});

describe('Laden des Stands: nie leer überschreiben', () => {
  beforeEach(() => {
    db.clear();
    failReads.n = 0;
    vi.resetModules();
  });

  it('ein kurzer Lesefehler wird wiederholt, der Stand bleibt', async () => {
    db.set('road-to-gm-state-v1', JSON.stringify({ ...emptyState(), log: [entry('a', 1, 'best', 'e4')] }));
    failReads.n = 2;
    const store = await import('../src/lib/store');
    await store.loadState();
    expect(store.isLoaded()).toBe(true);
    expect(store.getState().log).toHaveLength(1);
  });

  it('bleibt der Speicher unlesbar, startet die App nicht und schreibt nichts', async () => {
    const saved = JSON.stringify({ ...emptyState(), log: [entry('a', 1, 'best', 'e4')] });
    db.set('road-to-gm-state-v1', saved);
    failReads.n = 5;
    // Speichern läuft über window-Zeitgeber: hier nachgebaut, damit update() wie in der App ein Speichern anstößt
    vi.stubGlobal('window', { setTimeout, clearTimeout, addEventListener: () => {} });
    vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' });
    const store = await import('../src/lib/store');
    await expect(store.loadState()).rejects.toThrow(store.READ_FAILED);
    expect(store.isLoaded()).toBe(false);
    store.update((s) => ({ ...s, log: [] }));
    await new Promise((r) => setTimeout(r, 300));
    expect(db.get('road-to-gm-state-v1')).toBe(saved);
    vi.unstubAllGlobals();
  });

  it('unlesbarer Inhalt wird beiseitegelegt, nicht gelöscht', async () => {
    db.set('road-to-gm-state-v1', '{kaputt');
    const store = await import('../src/lib/store');
    await store.loadState();
    expect(store.getState().log).toEqual([]);
    expect([...db.entries()].some(([k, v]) => k.startsWith('road-to-gm-state-v1-defekt-') && v === '{kaputt')).toBe(true);
  });
});
