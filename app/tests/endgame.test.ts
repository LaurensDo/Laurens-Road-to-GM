import { describe, expect, it } from 'vitest';
import { equalMoves, judge, TB_WP } from '../src/lib/judge';
import { explain } from '../src/lib/explain';
import { buildVariations, evAt } from '../src/lib/variation';
import { counts, pickNext } from '../src/lib/queue';
import { summarize } from '../src/lib/sets';
import { limitFor, modeOfEntries, taskType } from '../src/lib/limit';
import { DEFAULT_SETTINGS, emptyState, type Exercise, type Grade, type ReviewEntry } from '../src/lib/types';

// Weiß gewinnt mit Turm gegen Läufer? Hier nur ein Rahmen: die Tablebase-Ergebnisse stehen in tb.moves
const end = (over: Partial<Exercise> = {}): Exercise =>
  ({
    id: 'e1',
    fen: '8/8/8/4k3/8/8/4K3/R7 w - - 0 60',
    turn: 'w',
    phase: 'Endspiel',
    cat: 'Endspiel',
    motifs: [],
    themes: [],
    lines: [
      { san: 'Ra5+', uci: 'a1a5', wp: 100, cp: 0, pv: ['Ra5+', 'Kd4', 'Kd2'], ev: [100, 100, 100] },
      { san: 'Kd2', uci: 'e2d2', wp: 100, cp: 0, pv: ['Kd2'] },
    ],
    played: { san: 'Ra8', uci: 'a1a8', wp: 50, cp: 0 },
    loss: 50,
    clock: 12,
    spent: 3,
    date: '2026-09-01',
    url: 'https://example.org/g',
    src: 'chess.com',
    maia: { me: null, up: null, cls: null },
    tb: {
      res: 'w',
      moves: [
        ['Ra5+', 'w'],
        ['Kd2', 'w'],
        ['Kf2', 'w'],
        ['Ra8', 'd'],
        ['Rh1', 'l'],
      ],
      game: ['win', 'draw'],
    },
    refs: [['Ra8', ['Kd4', 'Kd2'], [50, 50, 50]]],
    ...over,
  }) as unknown as Exercise;

describe('Endspiel: exakte Wertung', () => {
  it('jeder Zug, der den Gewinn hält, ist richtig; der schnellste heißt bester', () => {
    expect(judge(end(), 'Ra5+', false)).toMatchObject({ verdict: 'best', correct: true, wp: TB_WP.w });
    expect(judge(end(), 'Kf2', false)).toMatchObject({ verdict: 'equal', correct: true, wp: 100 });
  });
  it('verspielt: aus Gewinn wird Remis oder Verlust, das ist falsch', () => {
    expect(judge(end(), 'Ra8', true)).toMatchObject({ verdict: 'wrong', correct: false, wp: 50, lossWp: 50 });
    expect(judge(end(), 'Rh1', true)).toMatchObject({ verdict: 'wrong', correct: false, wp: 0 });
    expect(judge(end(), 'Rb1', true)).toMatchObject({ verdict: 'wrong', wp: null });
  });
  it('in einer Remisstellung ist jeder Remiszug richtig', () => {
    const d = end({ tb: { res: 'd', moves: [['Kd2', 'd'], ['Ra5+', 'd'], ['Rh1', 'l']] }, lines: [{ san: 'Kd2', uci: 'e2d2', wp: 50, cp: 0, pv: ['Kd2'] }] });
    expect(judge(d, 'Ra5+', true)).toMatchObject({ verdict: 'equal', correct: true });
    expect(judge(d, 'Rh1', true)).toMatchObject({ verdict: 'wrong', wp: 0 });
  });
  it('nennt die weiteren richtigen Züge und bietet sie als Varianten an', () => {
    expect(equalMoves(end(), true).map((m) => m.san)).toEqual(['Kd2', 'Kf2']);
    const v = buildVariations(end(), 'Ra8', true);
    expect(v.map((x) => [x.san, x.best, x.equal, x.own])).toEqual([
      ['Ra5+', true, false, false],
      ['Kd2', false, true, false],
      ['Ra8', false, false, true],
    ]);
    // der Balken fällt beim eigenen Fehler auf Remis
    expect(evAt(end(), v[2], 1)).toBe(50);
  });
  it('erklärt, worum es geht', () => {
    expect(explain(end(), true)[0]).toMatch(/exakt bekannt/);
  });
});

describe('Endspiel: eigener Modus', () => {
  const t = new Date('2026-10-22T10:00:00');
  const normal = (id: string): Exercise => ({ ...end({ id, tb: undefined, cat: 'Figur eingestellt' }), maia: { me: 0.5, up: 0.7, cls: 'Leichtsinn', ok: 0.5 } }) as Exercise;
  const pool = [normal('a'), normal('b'), end({ id: 'e1' }), end({ id: 'e2' }), { ...end({ id: 'w1', tb: undefined }), win: { safe: 80 } } as Exercise];

  it('Art, Zeitlimit und Standard', () => {
    expect(taskType(end())).toBe('endspiel');
    expect(DEFAULT_SETTINGS.endLimit).toBe(15);
    expect(limitFor({ timeLimit: 20, winLimit: 10, endLimit: 15 }, end())).toBe(15);
  });
  it('eigene Warteschlange, keine Mischung, Filter gelten nicht', () => {
    const s = emptyState();
    s.settings.filters = { phase: 'Eröffnung', cat: 'alle', motif: 'alle' };
    expect(counts(pool, s, t, 'endspiel').total).toBe(2);
    expect(counts(pool, s, t, 'fehler').total).toBe(0);
    expect(pickNext(pool, emptyState(), t, undefined, undefined, 'endspiel')?.ex.tb).toBeDefined();
    expect(pickNext(pool, emptyState(), t, undefined, undefined, 'sicher')?.ex.win).toBeDefined();
    expect(pickNext(pool, emptyState(), t)?.ex.tb).toBeUndefined();
  });
  it('die Satzauswertung nennt die Art mit ihrem Limit', () => {
    const byId = new Map(pool.map((x) => [x.id, x]));
    const e = (id: string, ok: boolean, ms: number, grade: Grade): ReviewEntry => ({ id, ts: 1, grade, verdict: ok ? 'best' : 'wrong', ms, dur: ms });
    const entries = [e('e1', true, 9000, 3), e('e2', true, 18000, 2)];
    expect(modeOfEntries(entries, byId)).toBe('endspiel');
    const s = summarize(entries, 2, byId, { limit: 20, winLimit: 10, endLimit: 15, previous: [], tolerance: true });
    expect(s.lines.join(' ')).toContain('Endspiel: 2 von 2 richtig und 1 innerhalb von 15 s');
  });
});
