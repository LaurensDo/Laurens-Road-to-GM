import { beforeEach, describe, expect, it } from 'vitest';
import { clean, DEFAULT_PREFS } from '../src/lib/device';
import { isCapture, positionOf } from '../src/lib/chess';
import { counts, pickNext } from '../src/lib/queue';
import { listSets, loadActive, newSetId, rateOf, RESUME_WINDOW_MS, saveActive, summarize } from '../src/lib/sets';
import { startCue, timerCue } from '../src/lib/sound';
import { fromRemote, mergeStates, toRemote } from '../src/lib/merge';
import { emptyState, type Exercise, type ReviewEntry, type Verdict } from '../src/lib/types';

const ex = (id: string, over: Partial<Exercise> = {}): Exercise => ({
  id,
  fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  turn: 'w',
  phase: 'Mittelspiel',
  cat: 'Figur eingestellt',
  motifs: [],
  themes: [],
  lines: [{ san: 'Nf3', uci: 'g1f3', wp: 55, cp: 20, pv: ['Nf3'] }],
  played: { san: 'Qh5', uci: 'd1h5', wp: 30, cp: -50 },
  loss: 25,
  clock: 120,
  spent: 3,
  date: '2026-10-01',
  url: 'https://example.org/g',
  src: 'lichess',
  maia: { me: 0.5, up: 0.7, cls: 'Leichtsinn' },
  ...over,
});

const entry = (id: string, verdict: Verdict, ms: number, ts: number, set = { id: 's1', n: 5 }): ReviewEntry => ({
  id,
  ts,
  verdict,
  ms,
  dur: ms,
  grade: verdict === 'best' || verdict === 'equal' ? 3 : 1,
  set,
});

const byIdOf = (xs: Exercise[]) => new Map(xs.map((e) => [e.id, e]));

describe('summarize', () => {
  const exs = [
    ex('a', { phase: 'Endspiel', maia: { me: 0.4, up: 0.6, cls: null } }),
    ex('b', { phase: 'Endspiel', maia: { me: 0.4, up: 0.6, cls: null } }),
    ex('c', { phase: 'Eröffnung', cat: 'Matt übersehen', motifs: ['Gabel'], maia: { me: 0.4, up: 0.6, cls: null } }),
    ex('d', { phase: 'Eröffnung', cat: 'Matt übersehen', motifs: ['Gabel'], maia: { me: 0.4, up: 0.6, cls: null } }),
    ex('e', { maia: { me: 0.4, up: 0.6, cls: null } }),
  ];
  const byId = byIdOf(exs);

  it('starker Satz: viel richtig, im Zeitlimit', () => {
    const es = ['a', 'b', 'c', 'd', 'e'].map((id, i) => entry(id, 'best', 4000, 1000 + i));
    const s = summarize(es, 5, byId, { limit: 10, previous: [] });
    expect(s.tier).toBe('strong');
    expect(s.right).toBe(5);
    expect(s.inTime).toBe(5);
    expect(s.complete).toBe(true);
    expect(s.expected).toBeCloseTo(40, 5);
    expect(s.lines[0]).toContain('deutlich darüber');
    expect(s.weak).toBeNull();
  });

  it('richtig, aber nach dem Limit: Tempo-Hinweis, kein starker Satz bei wenig Tempo', () => {
    const es = ['a', 'b', 'c', 'd', 'e'].map((id, i) => entry(id, 'best', 12000, 1000 + i));
    const s = summarize(es, 5, byId, { limit: 10, previous: [] });
    expect(s.slowRight).toBe(5);
    expect(s.tier).toBe('solid');
    expect(s.lines.join(' ')).toContain('nach dem Limit');
    expect(s.tip).toContain('erzwingenden Züge');
  });

  it('vorschnelle Fehler werden erkannt und haben Vorrang beim Tipp', () => {
    const es = [
      entry('a', 'wrong', 1200, 1),
      entry('b', 'wrong', 2500, 2),
      entry('c', 'best', 5000, 3),
      entry('d', 'best', 5000, 4),
      entry('e', 'best', 5000, 5),
    ];
    const s = summarize(es, 5, byId, { limit: 10, previous: [] });
    expect(s.quickWrong).toBe(2);
    expect(s.tip).toContain('bis zwei');
    expect(s.lines.join(' ')).toContain('vorschnelles Ziehen');
  });

  it('Aufgeben zählt nicht als vorschnell', () => {
    const es = [entry('a', 'gaveup', 500, 1), entry('b', 'gaveup', 600, 2), entry('c', 'best', 5000, 3)];
    const s = summarize(es, 3, byId, { limit: 10, previous: [] });
    expect(s.quickWrong).toBe(0);
    expect(s.gaveUp).toBe(2);
  });

  it('stark und schwach nach Gruppen mit mindestens zwei Aufgaben', () => {
    const es = [
      entry('a', 'best', 4000, 1), // Endspiel 2/2
      entry('b', 'best', 4000, 2),
      entry('c', 'wrong', 6000, 3), // Eröffnung/Matt übersehen/Gabel 0/2
      entry('d', 'wrong', 6000, 4),
      entry('e', 'best', 4000, 5),
    ];
    const s = summarize(es, 5, byId, { limit: 10, previous: [] });
    // größte Gruppe mit mindestens 80 %: "Figur eingestellt" umfasst a, b und e
    expect(s.strong).toMatchObject({ label: 'Figur eingestellt', right: 3, n: 3 });
    expect(s.weak).toMatchObject({ right: 0, n: 2 });
    expect(['Eröffnung', 'Matt übersehen', 'Gabel']).toContain(s.weak!.label);
  });

  it('Stufen nach Quote', () => {
    const mk = (right: number) => Array.from({ length: 10 }, (_, i) => entry('a', i < right ? 'best' : 'wrong', 4000, i + 1));
    const t = (r: number) => summarize(mk(r), 10, byId, { limit: 10, previous: [] }).tier;
    expect([t(9), t(7), t(5), t(2)]).toEqual(['strong', 'solid', 'mixed', 'hard']);
  });

  it('Vergleich mit den letzten Sätzen und Hinweis bei kurzem Satz', () => {
    const es = [entry('a', 'best', 4000, 1), entry('b', 'best', 4000, 2)];
    const s = summarize(es, 5, byId, { limit: 10, previous: [40, 50, 60] });
    expect(s.complete).toBe(false);
    expect(s.lines.join(' ')).toContain('letzten 3 Sätze');
    expect(s.lines.join(' ')).toContain('besser');
    expect(s.lines.join(' ')).toContain('Kurzer Satz');
  });

  it('ohne Maia-Werte keine Erwartung', () => {
    const noMaia = byIdOf([ex('a', { maia: { me: null, up: null, cls: null } })]);
    const s = summarize([entry('a', 'best', 4000, 1)], 1, noMaia, { limit: 10, previous: [] });
    expect(s.expected).toBeNull();
    expect(s.lines[0]).not.toContain('Richtwert');
  });

  it('Zeitlimit aus: kein Tempo-Urteil', () => {
    const s = summarize([entry('a', 'best', 40000, 1)], 1, byId, { limit: 0, previous: [] });
    expect(s.slowRight).toBe(0);
    expect(s.lines[1]).toContain('Im Schnitt');
  });
});

describe('listSets', () => {
  it('gruppiert nach Satz und lässt Einzelantworten weg', () => {
    const solo: ReviewEntry = { id: 'z', ts: 5, verdict: 'best', ms: 1, dur: 1, grade: 3 };
    const log = [entry('a', 'best', 1, 10, { id: 's1', n: 3 }), solo, entry('b', 'wrong', 1, 20, { id: 's1', n: 3 }), entry('c', 'best', 1, 30, { id: 's2', n: 2 })];
    const runs = listSets(log);
    expect(runs.map((r) => [r.id, r.entries.length, r.planned])).toEqual([
      ['s1', 2, 3],
      ['s2', 1, 2],
    ]);
    expect(rateOf(runs[0])).toBe(50);
  });
});

describe('aktiver Satz', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
  });

  it('speichert, lädt und läuft nach sechs Stunden ab', () => {
    const now = 1_000_000_000;
    saveActive({ id: newSetId(now), startedAt: now, size: 10, served: ['a', 'b'] });
    expect(loadActive(now + 1000)?.served).toEqual(['a', 'b']);
    expect(loadActive(now + RESUME_WINDOW_MS + 1)).toBeNull();
    saveActive(null);
    expect(loadActive(now)).toBeNull();
  });

  it('kaputte Daten ergeben keinen Satz', () => {
    localStorage.setItem('road-to-gm-activeset-v1', '{"id":5}');
    expect(loadActive()).toBeNull();
  });
});

describe('pickNext mit Ausschluss', () => {
  it('wählt keine Aufgabe, die im Satz schon vorkam', () => {
    const exs = [ex('a'), ex('b', { cat: 'Matt übersehen' }), ex('c', { cat: 'Positioneller Fehler' })];
    const st = emptyState();
    const now = new Date();
    const first = pickNext(exs, st, now)!;
    const second = pickNext(exs, st, now, undefined, new Set([first.ex.id]))!;
    const third = pickNext(exs, st, now, undefined, new Set([first.ex.id, second.ex.id]))!;
    expect(new Set([first.ex.id, second.ex.id, third.ex.id]).size).toBe(3);
    expect(pickNext(exs, st, now, undefined, new Set(['a', 'b', 'c']))).toBeNull();
  });

  it('zählt beim Tageskontingent weiter wie bisher', () => {
    const exs = Array.from({ length: 30 }, (_, i) => ex(`x${i}`));
    expect(counts(exs, emptyState(), new Date()).newAvailable).toBe(15);
  });
});

describe('Uhr-Töne', () => {
  const seq = (mode: Parameters<typeof timerCue>[0], limit: number) =>
    Array.from({ length: limit + 2 }, (_, i) => timerCue(mode, limit, i + 1)?.sfx ?? '-');

  it('Standard: Ticks in den letzten drei Sekunden, Ton beim Ablauf', () => {
    expect(seq('standard', 10)).toEqual(['-', '-', '-', '-', '-', '-', 'tick', 'tick', 'tickLast', 'timeUp', '-', '-']);
  });
  it('kurzes Limit: Ticks beginnen früher', () => {
    expect(seq('standard', 5)).toEqual(['-', 'tick', 'tick', 'tickLast', 'timeUp', '-', '-']);
  });
  it('Nur Ende, Aus und Zeitlimit aus', () => {
    expect(seq('end', 5).filter((x) => x !== '-')).toEqual(['timeUp']);
    expect(seq('off', 5).filter((x) => x !== '-')).toEqual([]);
    expect(seq('standard', 0).filter((x) => x !== '-')).toEqual([]);
  });
  it('Jede Sekunde: leiser Tick auch davor', () => {
    const c = timerCue('every', 10, 2);
    expect(c).toEqual({ sfx: 'tick', gain: 0.5 });
  });
  it('Start-Ton nur bei Standard und Jede Sekunde mit Limit', () => {
    expect([startCue('standard', 10), startCue('every', 10), startCue('end', 10), startCue('off', 10), startCue('standard', 0)]).toEqual([true, true, false, false, false]);
  });
});

describe('Schlagzug und Geräteeinstellungen', () => {
  it('erkennt Schlagen, en passant und stille Züge', () => {
    const pos = positionOf('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
    expect(isCapture(pos, 'e5', 'f6')).toBe(true); // en passant
    expect(isCapture(pos, 'e5', 'e6')).toBe(false);
    expect(isCapture(positionOf('rnbqkbnr/pppppppp/8/8/8/5n2/PPPPPPPP/RNBQKB1R w KQkq - 0 1'), 'g2', 'f3')).toBe(true);
  });
  it('bereinigt kaputte Einstellungen', () => {
    expect(clean(null)).toEqual(DEFAULT_PREFS);
    expect(clean({ sound: 'ja', volume: 9, timerSound: 'laut' })).toEqual(DEFAULT_PREFS);
    expect(clean({ sound: false, volume: 3, timerSound: 'off', ignoreMute: true, splash: false })).toEqual({
      sound: false,
      volume: 3,
      timerSound: 'off',
      ignoreMute: true,
      splash: false,
    });
  });
});

describe('Satz-Markierung im Abgleich', () => {
  it('bleibt beim Zusammenführen und Hin- und Rückschreiben erhalten', () => {
    const a = { ...emptyState(), log: [entry('a', 'best', 1000, 100, { id: 's9', n: 4 })] };
    const b = { ...emptyState(), log: [entry('b', 'wrong', 2000, 200, { id: 's9', n: 4 })] };
    const merged = mergeStates(a, b);
    expect(merged.log.map((e) => e.set)).toEqual([{ id: 's9', n: 4 }, { id: 's9', n: 4 }]);
    const back = fromRemote(JSON.parse(JSON.stringify(toRemote(merged))))!;
    expect(listSets(back.log)).toHaveLength(1);
    expect(listSets(back.log)[0].entries).toHaveLength(2);
  });
});

describe('Begrüßung', () => {
  it('nach Tageszeit', async () => {
    const { greeting } = await import('../src/lib/format');
    expect([4, 5, 10, 11, 17, 18, 23].map(greeting)).toEqual([
      'Guten Abend',
      'Guten Morgen',
      'Guten Morgen',
      'Guten Tag',
      'Guten Tag',
      'Guten Abend',
      'Guten Abend',
    ]);
  });
});
