import { describe, expect, it } from 'vitest';
import { equalMoves, judge } from '../src/lib/judge';
import { explain } from '../src/lib/explain';
import { buildVariations } from '../src/lib/variation';
import { counts, pickNext, WIN_EVERY, WIN_OFFSET } from '../src/lib/queue';
import { applyReview } from '../src/lib/srs';
import { emptyState } from '../src/lib/types';
import { summarize } from '../src/lib/sets';
import type { Exercise, Grade, ReviewEntry } from '../src/lib/types';

const FEN = '6k1/5ppp/8/8/8/8/5PPP/3QR1K1 w - - 0 30';

const win = (over: Partial<Exercise> = {}): Exercise =>
  ({
    id: 'w1',
    fen: FEN,
    turn: 'w',
    phase: 'Endspiel',
    cat: 'Sicher gewinnen',
    motifs: [],
    themes: [],
    lines: [
      { san: 'Qd8+', uci: 'd1d8', wp: 97, cp: 600, pv: ['Qd8+', 'Kh7'] },
      { san: 'Re8+', uci: 'e1e8', wp: 94, cp: 500, pv: ['Re8+', 'Kh7'] },
      { san: 'Qd2', uci: 'd1d2', wp: 85, cp: 300, pv: ['Qd2', 'h6'] },
      { san: 'h3', uci: 'h2h3', wp: 79, cp: 250, pv: ['h3', 'h6'] },
      { san: 'Kg2', uci: 'g1g2', wp: 70, cp: 200, pv: ['Kg2', 'h6'] },
    ],
    more: [['Qa1', 66], ['Rf1', 60]],
    played: { san: 'Qd2', uci: 'd1d2', wp: 85, cp: 300 },
    loss: 12,
    clock: 90,
    spent: 24,
    date: '2026-09-01',
    url: 'https://example.org/g',
    src: 'chesscom',
    maia: { me: null, up: null, cls: null },
    win: { safe: 80, limit: 5 },
    ...over,
  }) as unknown as Exercise;

describe('Sicher gewinnen: Wertung', () => {
  it('jeder Zug, der die Gewinnstellung hält, ist richtig, auch ein deutlich schwächerer als der beste', () => {
    expect(judge(win(), 'Qd8+', false).verdict).toBe('best');
    expect(judge(win(), 'Re8+', false)).toMatchObject({ verdict: 'equal', correct: true });
    // 85 % liegen 12 Punkte hinter dem besten: normal wäre das "spielbar", hier ist es sicher
    expect(judge(win(), 'Qd2', true)).toMatchObject({ verdict: 'equal', correct: true });
    expect(judge(win(), 'Qd2', false)).toMatchObject({ verdict: 'equal', correct: true });
  });
  it('unter der Grenze: spielbar knapp darunter, sonst falsch, unbekannte Züge falsch', () => {
    expect(judge(win(), 'h3', true)).toMatchObject({ verdict: 'playable', correct: false });
    expect(judge(win(), 'Kg2', true)).toMatchObject({ verdict: 'playable', correct: false });
    expect(judge(win(), 'Qa1', true)).toMatchObject({ verdict: 'playable', correct: false }); // 66 %: noch knapp über der Grenze minus 15
    expect(judge(win(), 'Rf1', true)).toMatchObject({ verdict: 'wrong', correct: false }); // 60 %
    expect(judge(win(), 'Qb3', true)).toMatchObject({ verdict: 'wrong', wp: null });
  });
  it('gewöhnliche Übungen bleiben unberührt', () => {
    const plain = win({ win: undefined });
    expect(judge(plain, 'Qd2', true).verdict).toBe('playable');
  });
  it('listet die weiteren sicheren Züge, nicht nur die gleichwertigen', () => {
    expect(equalMoves(win(), true).map((m) => m.san)).toEqual(['Re8+', 'Qd2']);
  });
  it('bietet die sicheren Linien als gleichwertige Varianten an', () => {
    const v = buildVariations(win(), null, false);
    expect(v.filter((x) => x.equal).map((x) => x.san)).toEqual(['Re8+', 'Qd2']);
  });
  it('erklärt, worum es geht, und nennt die Zeit aus der Partie', () => {
    const t = explain(win(), true);
    expect(t[0]).toMatch(/klar gewonnen/);
    expect(t[0]).toMatch(/Tempo/);
    expect(t.join(' ')).toMatch(/24[,.]?0? ?s gebraucht|24 s/);
  });
});

describe('Sicher gewinnen: Satzauswertung', () => {
  const e = (id: string, ok: boolean): ReviewEntry => ({ id, ts: 1, grade: (ok ? 3 : 1) as Grade, verdict: ok ? 'best' : 'wrong', ms: 3000, dur: 5000 });
  it('vergleicht mit dem Richtwert nur Aufgaben, die einen haben', () => {
    const normal = (id: string): Exercise => ({ ...win({ id, win: undefined, cat: 'Figur eingestellt' }), maia: { me: 0.5, up: 0.7, cls: 'Leichtsinn', ok: 0.5, ok0: 0.4 } }) as Exercise;
    const exs = [...['a', 'b', 'c', 'd'].map(normal), win({ id: 'w1' })];
    const byId = new Map(exs.map((x) => [x.id, x]));
    // 2 von 4 normalen richtig (50 %), dazu die leichte "Sicher gewinnen"-Aufgabe richtig: gesamt 60 %, gegen den Richtwert 50 % zählt 50 %
    const entries = [e('a', true), e('b', true), e('c', false), e('d', false), e('w1', true)];
    const s = summarize(entries, 5, byId, { limit: 10, previous: [], tolerance: true });
    expect(s.lines[0]).toMatch(/3 von 5 richtig \(60 %\)/);
    expect(s.lines[0]).toMatch(/erwarteten Bereich/);
  });
});

describe('Sicher gewinnen: Mischung in die neuen Aufgaben', () => {
  const regular = (i: number): Exercise => ({ ...win({ id: 'r' + i, win: undefined, cat: i % 2 ? 'Figur eingestellt' : 'Matt übersehen' }), maia: { me: 0.5, up: 0.7, cls: 'Leichtsinn' } }) as Exercise;
  const pool = [...Array.from({ length: 40 }, (_, i) => regular(i)), ...Array.from({ length: 10 }, (_, i) => win({ id: 'w' + i }))];
  const t = new Date('2026-10-19T10:00:00');

  it('jede fünfte neue Aufgabe ist eine Gewinnstellung, unabhängig vom bisherigen Fortschritt', () => {
    for (const seen of [0, 3, 17, 120]) {
      const kinds: boolean[] = [];
      const s = emptyState();
      s.settings.newPerDay = 100;
      // schon gesehene Karten (alle aus dem normalen Vorrat und weit in der Vergangenheit fällig)
      for (let i = 0; i < seen; i++) s.cards['x' + i] = applyReview(undefined, 3, new Date(t.getTime() - 40 * 86400000));
      for (let n = 0; n < 15; n++) {
        const pick = pickNext(pool, s, t)!;
        kinds.push(!!pick.ex.win);
        s.cards[pick.ex.id] = applyReview(undefined, 3, t);
      }
      const winAt = kinds.map((w, i) => (w ? i : -1)).filter((i) => i >= 0);
      expect(winAt.length).toBe(3);
      // zwischen zwei Gewinnstellungen genau WIN_EVERY - 1 normale Aufgaben
      expect(winAt[1] - winAt[0]).toBe(WIN_EVERY);
      expect((seen + winAt[0]) % WIN_EVERY).toBe(WIN_OFFSET);
    }
  });

  it('ohne Gewinnstellungen oder ohne normale Aufgaben läuft alles weiter', () => {
    const s = emptyState();
    expect(pickNext(pool.filter((e) => !e.win), s, t)?.ex.win).toBeUndefined();
    expect(pickNext(pool.filter((e) => e.win), s, t)?.ex.win).toBeDefined();
  });

  it('zählt sie zu den neuen Aufgaben', () => {
    expect(counts(pool, emptyState(), t).newTotal).toBe(50);
  });
});
