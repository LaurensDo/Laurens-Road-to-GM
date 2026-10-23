import { describe, expect, it } from 'vitest';
import { activeFilters, addBonus, bonusOf, counts, taskSeconds } from '../src/lib/queue';
import { applyReview } from '../src/lib/srs';
import { emptyState, type AppState, type Exercise, type Grade, type ReviewEntry } from '../src/lib/types';
import { fromRemote, mergeStates, toRemote } from '../src/lib/merge';
import { normalize } from '../src/lib/normalize';
import { summarize } from '../src/lib/sets';

/** Prüft die Korrekturen aus der Durchsicht von 1.8 bis 1.11 (Arten getrennt, Abgleich der Einstellungen, Satzauswertung) */

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
const winEx = (id: string) => ex(id, { cat: 'Sicher gewinnen', win: { safe: 80 } });
const endEx = (id: string) => ex(id, { phase: 'Endspiel', cat: 'Endspiel', tb: { res: 'w', moves: [['Nf3', 'w']] } });

const DAY = new Date('2026-10-19T10:00:00');
const entry = (id: string, ts: number, grade: Grade = 3, extra: Partial<ReviewEntry> = {}): ReviewEntry => ({
  id,
  ts,
  grade,
  verdict: grade === 1 ? 'wrong' : 'best',
  ms: 3000,
  dur: 5000,
  ...extra,
});

describe('"5 weitere neue Aufgaben" gilt nur für die eigene Art', () => {
  const fehler = Array.from({ length: 40 }, (_, i) => ex('f' + i));
  const sicher = Array.from({ length: 40 }, (_, i) => winEx('s' + i));
  const all = [...fehler, ...sicher];

  it('der Bonus im Modus "Sicher gewinnen" erhöht das Fehler-Training nicht', () => {
    let s = emptyState();
    s.settings.newPerDay = 5;
    for (const e of sicher.slice(0, 5)) s.cards[e.id] = { ...applyReview(undefined, 3, DAY), firstSeen: DAY.getTime() };
    expect(counts(all, s, DAY, 'sicher').newAvailable).toBe(0);
    const fehlerBefore = counts(all, s, DAY, 'fehler').newAvailable;
    s = addBonus(s, 'sicher', DAY);
    expect(counts(all, s, DAY, 'sicher').newAvailable).toBe(5);
    expect(counts(all, s, DAY, 'fehler').newAvailable).toBe(fehlerBefore);
    expect(bonusOf(s, 'fehler', DAY)).toBe(0);
    expect(s.bonus).toBeUndefined();
  });

  it('wird mit dem Abgleich übertragen und je Art zusammengeführt', () => {
    const a = addBonus(emptyState(), 'sicher', DAY);
    const b = addBonus(addBonus(emptyState(), 'endspiel', DAY), 'endspiel', DAY);
    const merged = mergeStates(fromRemote(JSON.parse(JSON.stringify(toRemote(a))))!, fromRemote(JSON.parse(JSON.stringify(toRemote(b))))!);
    expect(bonusOf(merged, 'sicher', DAY)).toBe(5);
    expect(bonusOf(merged, 'endspiel', DAY)).toBe(10);
    expect(bonusOf(merged, 'fehler', DAY)).toBe(0);
    // ein Gerät ohne das Feld (älter) verliert es nicht
    expect(bonusOf(mergeStates(merged, emptyState()), 'endspiel', DAY)).toBe(10);
  });
});

describe('Planung des Tages aus der Zeit im Fehler-Training', () => {
  it('schnelle Antworten bei "Sicher gewinnen" senken die Zeit je Fehler-Aufgabe nicht', () => {
    const t = DAY.getTime() - 86400000;
    const log = [
      ...Array.from({ length: 30 }, (_, i) => entry('f' + i, t + i * 1000, 3, { dur: 40000 })),
      ...Array.from({ length: 60 }, (_, i) => entry('s' + i, t + 50000 + i * 1000, 3, { dur: 4000 })),
    ];
    const st: AppState = { ...emptyState(), log };
    const fehlerIds = new Set(Array.from({ length: 30 }, (_, i) => 'f' + i));
    expect(taskSeconds(st, DAY)).toBeLessThan(10);
    expect(taskSeconds(st, DAY, fehlerIds)).toBe(40);
  });
});

describe('Filter aus älteren Versionen', () => {
  it('die Fehlerart "Sicher gewinnen" (bis 1.7 wählbar) leert das Fehler-Training nicht', () => {
    const exs = [ex('a'), ex('b'), winEx('w')];
    const s = emptyState();
    s.settings.filters = { phase: 'alle', cat: 'Sicher gewinnen', motif: 'alle' };
    expect(activeFilters(exs, s.settings.filters).cat).toBe('alle');
    expect(counts(exs, s, DAY, 'fehler').total).toBe(2);
    s.settings.filters.cat = 'Figur eingestellt';
    expect(activeFilters(exs, s.settings.filters).cat).toBe('Figur eingestellt');
  });
});

describe('Einstellungen beim Abgleich', () => {
  it('nie geänderte Einstellungen (Zeitpunkt 0) bekommen die neuen Vorgaben, auch das Zeitlimit von 20 s', () => {
    const old = normalize({ settings: { ...emptyState().settings, timeLimit: 10 }, settingsTs: 0 });
    expect(old.settings.timeLimit).toBe(20);
    const chosen = normalize({ settings: { ...emptyState().settings, timeLimit: 10 }, settingsTs: 5 });
    expect(chosen.settings.timeLimit).toBe(10);
  });

  it('bei gleichem Zeitpunkt entscheidet die Schreibweise: beide Geräte kommen zum selben Ergebnis', () => {
    const a = { ...emptyState(), settings: { ...emptyState().settings, setSize: 5 }, settingsTs: 100 };
    const b = { ...emptyState(), settings: { ...emptyState().settings, setSize: 20 }, settingsTs: 100 };
    expect(mergeStates(a, b).settings).toEqual(mergeStates(b, a).settings);
  });

  it('eine Änderung auf einem älteren Gerät setzt neuere Felder nicht auf die Vorgabe zurück', () => {
    // iPhone (neu): Endspiel-Limit 30 s. iPad (alte Version, kennt endLimit nicht) ändert danach das Thema.
    const phone = { ...emptyState(), settings: { ...emptyState().settings, endLimit: 30, winLimit: 5 }, settingsTs: 100 };
    const ipadFile = JSON.parse(JSON.stringify(toRemote({ ...emptyState(), settings: { ...emptyState().settings, theme: 'dark' }, settingsTs: 200 })));
    delete ipadFile.settings.endLimit;
    delete ipadFile.settings.winLimit;
    const merged = mergeStates(phone, fromRemote(ipadFile)!);
    expect(merged.settings.theme).toBe('dark');
    expect(merged.settings.endLimit).toBe(30);
    expect(merged.settings.winLimit).toBe(5);
    expect(merged.settingsKnown).toBeUndefined();
  });
});

describe('Satzauswertung je Art', () => {
  const byId = new Map<string, Exercise>();
  const ends = Array.from({ length: 5 }, (_, i) => endEx('e' + i));
  ends.forEach((e) => byId.set(e.id, e));
  const t0 = DAY.getTime();

  it('zählt im Endspiel-Satz jede Aufgabe einmal und verweist nicht auf den Filter', () => {
    const entries = ends.map((e, i) => entry(e.id, t0 + i * 1000, i < 3 ? 1 : 3, { ms: 5000, set: { id: 'x', n: 5 } }));
    const s = summarize(entries, 5, byId, { limit: 20, endLimit: 15, previous: [], tolerance: true });
    // Phase und Art heißen beide "Endspiel": keine Gruppe, die den ganzen Satz doppelt zählt
    expect(s.weak).toBeNull();
    expect(s.strong).toBeNull();
    expect(s.tip).not.toMatch(/Filter/);
  });

  it('nennt das Limit, das beim Antworten galt, nicht ein später geändertes', () => {
    const fx = Array.from({ length: 5 }, (_, i) => ex('g' + i));
    const m = new Map(fx.map((e) => [e.id, e]));
    const entries = fx.map((e, i) => entry(e.id, t0 + i * 1000, 3, { ms: 7000, lim: 20 }));
    const s = summarize(entries, 5, m, { limit: 5, previous: [], tolerance: true });
    expect(s.lines.join(' ')).toMatch(/innerhalb von 20 s/);
  });
});
