import { beforeEach, describe, expect, it } from 'vitest';
import { bigDogFor, momentOf, retryCandidates, situationOf, thenLine } from '../src/lib/setend';
import { POTS, QUOTES } from '../src/lib/quotes';
import { lastDays, windowStats } from '../src/lib/stats';
import { listSets, summarize } from '../src/lib/sets';
import { replay } from '../src/lib/merge';
import type { Exercise, Grade, ReviewEntry } from '../src/lib/types';

/** Satzende (Version 1.14): Damals-Zeile, Moment des Satzes, Big Dog zur Lage, Zweite Chance */

const ex = (id: string, over: Partial<Exercise> = {}): Exercise => ({
  id,
  fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  turn: 'w',
  phase: 'Mittelspiel',
  cat: 'Figur eingestellt',
  motifs: [],
  themes: [],
  lines: [{ san: 'Ng5', uci: 'f3g5', wp: 70, cp: 120, pv: ['Ng5'] }],
  played: { san: 'Bxf7+', uci: 'c4f7', wp: 20, cp: -300 },
  loss: 50,
  clock: 38,
  spent: 1.4,
  date: '2026-10-01',
  url: 'https://example.org/g',
  src: 'chesscom',
  maia: { me: 0.5, up: 0.6, cls: 'Leichtsinn', ok: 0.55 },
  ...over,
});

const T0 = new Date('2026-11-01T10:00:00').getTime();
const e = (id: string, ts: number, ok: boolean, extra: Partial<ReviewEntry> = {}): ReviewEntry => ({
  id,
  ts,
  grade: (ok ? 3 : 1) as Grade,
  verdict: ok ? 'best' : 'wrong',
  ms: 3100,
  dur: 6000,
  san: ok ? 'Ng5' : 'd3',
  ...extra,
});

describe('Damals-Zeile', () => {
  it('Partiezug mit Zeit, Uhr und Kosten, dann heute', () => {
    const x = ex('a', { why: { tags: [], gain: null, against: [['Bxf7+', { pts: 3, words: 'einen Läufer', line: ['Kxf7'] }]] } });
    expect(thenLine(x, e('a', T0, true))).toBe('Damals: Bxf7+ nach 1,4 s, 0:38 auf der Uhr, kostete einen Läufer. Heute: Ng5 in 3,1 s.');
  });
  it('ohne gespeicherte Kosten die verlorenen Punkte; Sicher gewinnen nennt die Denkzeit; bei Misserfolg nichts', () => {
    expect(thenLine(ex('a'), e('a', T0, true))).toContain('50 Punkte Gewinnchance weg');
    expect(thenLine(ex('w', { win: { safe: 80 }, spent: 24, clock: 90 }), e('w', T0, true))).toBe('Damals: 24,0 s nachgedacht, 1:30 auf der Uhr. Heute: Ng5 in 3,1 s.');
    expect(thenLine(ex('a'), e('a', T0, false))).toBeNull();
  });
  it('Endspiel: was aus dem Ergebnis wurde', () => {
    const t = ex('t', { tb: { res: 'w', moves: [], game: ['win', 'draw'] } });
    expect(thenLine(t, e('t', T0, true))).toContain('aus Gewinn wurde Remis');
  });
});

describe('Moment des Satzes', () => {
  it('die gelöste Aufgabe mit dem größten damaligen Verlust, mindestens 30 Punkte', () => {
    const byId = new Map([ex('a', { loss: 35 }), ex('b', { loss: 60 }), ex('c', { loss: 80 })].map((x) => [x.id, x]));
    const m = momentOf([e('a', T0, true), e('b', T0 + 1, true), e('c', T0 + 2, false)], byId);
    expect(m?.ex.id).toBe('b');
    expect(momentOf([e('a', T0, true)], new Map([['a', ex('a', { loss: 20 })]]))).toBeNull();
  });
});

describe('Lage nach dem Satz (Big Dog)', () => {
  const set = (oks: boolean[], ms = 3100) => oks.map((ok, i) => e('x' + i, T0 + i * 1000, ok, { ms, set: { id: 's', n: oks.length } }));

  it('ein Dauerbrenner endlich richtig und in der Zeit geht allem vor', () => {
    const before = [1, 2, 3].map((d) => e('x0', T0 - d * 86400000, false));
    const entries = set([true, false, false, false, false]);
    expect(situationOf(entries, 5, [...before, ...entries])?.pot).toBe('geknackt');
  });
  it('dritter Fehler in derselben Stellung', () => {
    const before = [1, 2].map((d) => e('x1', T0 - d * 86400000, false));
    const entries = set([true, false, true, true, true]);
    const s = situationOf(entries, 5, [...before, ...entries]);
    expect(s).toEqual({ pot: 'dritterFehler', fact: 'Aufgabe 2 war zum 3. Mal falsch. Sie kommt bald wieder.' });
  });
  it('alles richtig, Rückkehr, vorschnell, langsam, schwer', () => {
    const all = set([true, true, true, true, true]);
    expect(situationOf(all, 5, all)?.pot).toBe('perfekt');
    const back = set([true, false, true, false, true]);
    expect(situationOf(back, 5, [e('z', T0 - 6 * 86400000, true), ...back])).toEqual({ pot: 'rueckkehr', fact: 'Erster Satz nach 6 Tagen Pause.' });
    const quick = set([true, false, false, true, true], 1500);
    expect(situationOf(quick, 5, quick)?.pot).toBe('vorschnell');
    const slow = set([true, true, true, false, true]).map((x, i) => (i < 2 ? { ...x, grade: 2 as Grade } : x));
    expect(situationOf(slow, 5, slow)?.pot).toBe('langsam');
    const hard = set([true, false, false, false, false], 9000);
    expect(situationOf(hard, 5, hard)?.pot).toBe('schwer');
    const plain = set([true, true, false, true, true], 9000);
    expect(situationOf(plain, 5, plain)).toBeNull();
  });
});

describe('Big Dog auf der Ergebnisseite', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
  });
  const sit = { pot: 'perfekt' as const, fact: '5 von 5 richtig.' };

  it('höchstens auf jeder zweiten Seite, mit der sachlichen Zeile', () => {
    const a = bigDogFor(sit, true);
    expect(a && POTS.perfekt.includes(a.text) && a.fact === '5 von 5 richtig.' && a.author === 'Big Dog').toBe(true);
    expect(bigDogFor(sit, true)).toBeNull();
    expect(bigDogFor(sit, true)).not.toBeNull();
  });
  it('abgeschaltet oder ohne passende Lage kein Spruch', () => {
    expect(bigDogFor(sit, false)).toBeNull();
    expect(bigDogFor(null, true)).toBeNull();
  });
  it('jeder Topf hat mindestens 10 Sprüche, keiner doppelt, keiner aus dem Startbild', () => {
    const all = Object.values(POTS).flat();
    for (const pot of Object.values(POTS)) expect(pot.length).toBeGreaterThanOrEqual(10);
    expect(new Set(all).size).toBe(all.length);
    expect(all.some((q) => QUOTES.includes(q))).toBe(false);
  });
});

describe('Zweite Chance', () => {
  const entries = [e('a', T0, false), e('b', T0 + 60000, true), e('c', T0 + 120000, false), e('d', T0 + 180000, false), e('f', T0 + 240000, false)];

  it('höchstens drei falsche, frühestens 30 s nach dem Fehler, in neuer Reihenfolge', () => {
    const ids = retryCandidates(entries, T0 - 1000, T0 + 260000, () => 0.99);
    expect(ids.length).toBe(3);
    expect([...ids].sort()).toEqual(['a', 'c', 'd']); // f ist erst 20 s alt
    expect(ids).not.toEqual(['a', 'c', 'd']);
  });
  it('nicht mehr, wenn der Satz schon 15 Minuten läuft', () => {
    expect(retryCandidates(entries, T0 - 15 * 60000, T0 + 260000)).toEqual([]);
  });
  it('Antworten der Zweiten Chance zählen weder im Plan noch in Quoten oder Sätzen, aber als Zeit', () => {
    const r = e('a', T0 + 300000, true, { kind: 'retry', retryOf: 's' });
    const log = [...entries.map((x) => ({ ...x, set: { id: 's', n: 5 } })), r];
    expect(replay(log).a).toEqual(replay(log.slice(0, -1)).a);
    const day = lastDays(log, 1, new Date(T0 + 400000))[0];
    expect(day.n).toBe(5);
    expect(day.dur).toBe(6 * 6000);
    expect(windowStats(log, T0 - 1, T0 + 400000)?.n).toBe(5);
    expect(listSets(log)[0].entries.length).toBe(5);
  });
});

describe('Überschrift der Ergebnisseite', () => {
  it('misst gegen den Richtwert statt fester Stufen', () => {
    const byId = new Map(Array.from({ length: 10 }, (_, i) => [`m${i}`, ex(`m${i}`)]));
    const mk = (right: number) => Array.from({ length: 10 }, (_, i) => e(`m${i}`, T0 + i, i < right));
    const s = (right: number) => summarize(mk(right), 10, byId, { limit: 20, previous: [], tolerance: true });
    expect(s(8).headline).toBe('Über dem Richtwert');
    expect(s(8).sentence).toBe('80 % richtig, erwartet für Spieler deiner Stärke: 55 %.');
    expect(s(5).headline).toBe('Im erwarteten Bereich');
    expect(s(3).headline).toBe('Unter dem Richtwert');
  });
  it('ohne Richtwert gegen die eigenen letzten Sätze, beim ersten Satz die Zahl', () => {
    const w = (id: string) => ex(id, { win: { safe: 80 }, maia: { me: null, up: null, cls: null } });
    const byId = new Map(Array.from({ length: 5 }, (_, i) => [`w${i}`, w(`w${i}`)]));
    const entries = Array.from({ length: 5 }, (_, i) => e(`w${i}`, T0 + i, i < 4));
    expect(summarize(entries, 5, byId, { limit: 20, winLimit: 10, previous: [], tolerance: true }).headline).toBe('4 von 5 sicher gewonnen');
    expect(summarize(entries, 5, byId, { limit: 20, winLimit: 10, previous: [50, 60], tolerance: true }).headline).toBe('Besser als deine letzten Sätze');
  });
});
