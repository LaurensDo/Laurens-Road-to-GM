import { describe, expect, it } from 'vitest';
import { equalMoves, judge } from '../src/lib/judge';
import { explain } from '../src/lib/explain';
import { buildVariations } from '../src/lib/variation';
import { counts, pickNext } from '../src/lib/queue';
import { applyReview } from '../src/lib/srs';
import { DEFAULT_SETTINGS, emptyState } from '../src/lib/types';
import { limitFor, modeOfEntries, TASK_LABEL, taskType } from '../src/lib/limit';
import { breakdown } from '../src/lib/stats';
import { fromRemote, toRemote } from '../src/lib/merge';
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

describe('Sicher gewinnen: eigene Sätze, keine Mischung', () => {
  const regular = (i: number): Exercise => ({ ...win({ id: 'r' + i, win: undefined, cat: i % 2 ? 'Figur eingestellt' : 'Matt übersehen' }), maia: { me: 0.5, up: 0.7, cls: 'Leichtsinn' } }) as Exercise;
  const pool = [...Array.from({ length: 40 }, (_, i) => regular(i)), ...Array.from({ length: 10 }, (_, i) => win({ id: 'w' + i }))];
  const t = new Date('2026-10-19T10:00:00');

  it('jede Art hat ihre eigene Auswahl, nie gemischt', () => {
    const s = emptyState();
    s.settings.newPerDay = 100;
    for (const mode of ['fehler', 'sicher'] as const) {
      const seen = new Set<string>();
      for (let n = 0; n < 8; n++) {
        const pick = pickNext(pool, s, t, undefined, seen, mode)!;
        expect(!!pick.ex.win).toBe(mode === 'sicher');
        seen.add(pick.ex.id);
      }
    }
  });

  it('ohne Angabe der Art ist es das Fehler-Training', () => {
    expect(pickNext(pool, emptyState(), t)?.ex.win).toBeUndefined();
    expect(counts(pool, emptyState(), t).newTotal).toBe(40);
    expect(counts(pool, emptyState(), t, 'sicher').newTotal).toBe(10);
  });

  it('die Obergrenze neuer Aufgaben zählt je Art', () => {
    const s = emptyState();
    s.settings.newPerDay = 3;
    for (let i = 0; i < 3; i++) s.cards['r' + i] = { ...applyReview(undefined, 3, t), firstSeen: t.getTime() };
    expect(counts(pool, s, t).newAvailable).toBe(0);
    expect(counts(pool, s, t, 'sicher').newAvailable).toBe(3);
  });

  it('die Filter der Einstellungen gelten nur für das Fehler-Training', () => {
    const s = emptyState();
    s.settings.filters = { phase: 'Eröffnung', cat: 'alle', motif: 'alle' };
    expect(counts(pool, s, t).total).toBe(0);
    expect(counts(pool, s, t, 'sicher').total).toBe(10);
  });

  it('die Art eines Satzes folgt aus seinen Antworten', () => {
    const byId = new Map(pool.map((x) => [x.id, x]));
    const ent = (id: string): ReviewEntry => ({ id, ts: 1, grade: 3 as Grade, verdict: 'best', ms: 1000, dur: 2000 });
    expect(modeOfEntries([ent('w1'), ent('w2')], byId)).toBe('sicher');
    expect(modeOfEntries([ent('r1'), ent('w2')], byId)).toBe('fehler');
    expect(modeOfEntries([], byId)).toBe('fehler');
  });
});

describe('Zwei Arten von Aufgaben mit je eigenem Zeitlimit', () => {
  const normal = (id: string): Exercise => ({ ...win({ id, win: undefined, cat: 'Figur eingestellt' }), maia: { me: 0.5, up: 0.7, cls: 'Leichtsinn', ok: 0.5, ok0: 0.4 } }) as Exercise;
  const e = (id: string, ok: boolean, ms: number, grade: Grade): ReviewEntry => ({ id, ts: 1, grade, verdict: ok ? 'best' : 'wrong', ms, dur: ms + 2000 });

  it('Standardzeiten: 20 s im Fehler-Training, 10 s bei "Sicher gewinnen"', () => {
    expect(DEFAULT_SETTINGS.timeLimit).toBe(20);
    expect(DEFAULT_SETTINGS.winLimit).toBe(10);
  });

  it('jede Art liest ihre eigene Einstellung, unabhängig vom Wert im Datensatz', () => {
    const s = { timeLimit: 20, winLimit: 10, endLimit: 15 };
    expect(taskType(win())).toBe('sicher');
    expect(taskType(normal('n'))).toBe('fehler');
    expect(limitFor(s, win())).toBe(10); // der Datensatz sagt 5, die Einstellung gilt
    expect(limitFor(s, normal('n'))).toBe(20);
    expect(limitFor({ timeLimit: 0, winLimit: 7, endLimit: 15 }, win())).toBe(7);
    expect(limitFor({ timeLimit: 0, winLimit: 7, endLimit: 15 }, normal('n'))).toBe(0);
    expect(limitFor(s, null)).toBe(20);
  });

  it('ältere Daten ohne die neue Einstellung bekommen den Standard, gespeicherte Werte bleiben', () => {
    const old = toRemote({ ...emptyState(), settings: { ...emptyState().settings, timeLimit: 15 }, settingsTs: 1000 });
    const raw = JSON.parse(JSON.stringify(old));
    delete raw.settings.winLimit;
    const st = fromRemote(raw)!;
    expect(st.settings.winLimit).toBe(10);
    expect(st.settings.timeLimit).toBe(15);
  });

  it('der Satztext nennt jede Art mit ihrer Zielzeit', () => {
    const exs = [normal('a'), normal('b'), win({ id: 'w1' }), win({ id: 'w2' })];
    const byId = new Map(exs.map((x) => [x.id, x]));
    const entries = [e('a', true, 15000, 3), e('b', true, 25000, 2), e('w1', true, 4000, 3), e('w2', true, 14000, 2)];
    const s = summarize(entries, 4, byId, { limit: 20, winLimit: 10, previous: [], tolerance: true });
    const text = s.lines.join(' | ');
    expect(text).toContain('Fehler-Training: 2 von 2 richtig und 1 innerhalb von 20 s');
    expect(text).toContain('Sicher gewinnen: 2 von 2 richtig und 1 innerhalb von 10 s');
    expect(text).toMatch(/2 richtige Antworten kamen erst nach der Zielzeit/);
    expect(s.timed).toBe(true);
  });

  it('nur "Sicher gewinnen" im Satz und beide Limits aus: kein Tempo-Urteil', () => {
    const byId = new Map([[ 'w1', win({ id: 'w1' }) ]]);
    const s = summarize([e('w1', true, 4000, 3)], 1, byId, { limit: 0, winLimit: 0, previous: [], tolerance: true });
    expect(s.timed).toBe(false);
    expect(s.lines.join(' ')).toContain('Sicher gewinnen: 1 von 1 richtig, im Schnitt');
  });

  it('die Auswertung nach Art trennt beide', () => {
    const exs = [normal('a'), normal('b'), win({ id: 'w1' })];
    const byId = new Map(exs.map((x) => [x.id, x]));
    const rows = breakdown([e('a', true, 5000, 3), e('b', false, 8000, 1), e('w1', true, 3000, 3)], byId, 'type');
    expect(rows.map((r) => [r.label, r.n, Math.round(r.rate)])).toEqual([
      [TASK_LABEL.fehler, 2, 50],
      [TASK_LABEL.sicher, 1, 100],
    ]);
  });
});
