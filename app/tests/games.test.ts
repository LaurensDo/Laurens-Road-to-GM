import { describe, expect, it } from 'vitest';
import { fenAfter, materialTrack, parseChessComArchive, parseChessComPgn, parseLichessNdjson, tcOf, type GameRec } from '../src/lib/games';
import { budgetOf, metricsOf, sd, summarize } from '../src/lib/gameStats';
import { compare, compareRange, missing, PRELIM_MIN } from '../src/lib/basis';

// ---- Hilfen: eine Partie aus Zügen und Uhr bauen (ohne echte Partien, ohne Namen)
const SHUFFLE = ['Nc3', 'Nc6', 'Nb1', 'Nb8']; // vier Halbzüge, ändern nichts am Material

function pgnOf(sans: string[], clks: number[]): string {
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
  };
  const parts = sans.map((san, i) => `${i % 2 === 0 ? `${i / 2 + 1}. ` : `${Math.floor(i / 2) + 1}... `}${san} {[%clk ${fmt(clks[i])}]}`);
  return `[Event "Live Chess"]\n[White "x"]\n[Black "y"]\n\n${parts.join(' ')} 1-0`;
}

/** Zeit je eigenem Zug (Sekunden) aus einer Liste je Halbzug: Weiß zieht auf den geraden, Schwarz auf den ungeraden Plätzen */
function clocksFrom(spent: number[], base = 180, inc = 0): number[] {
  const left = [base, base];
  return spent.map((s, i) => {
    const side = i % 2;
    left[side] = left[side] - s + inc;
    return left[side];
  });
}

function longGame(movesWhite: number, spentWhite = (k: number) => 3, tail: string[] = []): { sans: string[]; spent: number[] } {
  const sans: string[] = [];
  while (sans.length < 2 * movesWhite - tail.length) sans.push(SHUFFLE[sans.length % 4]);
  sans.push(...tail);
  return { sans, spent: sans.map((_, i) => (i % 2 === 0 ? spentWhite(i / 2 + 1) : 3)) };
}

const rec = (over: Partial<GameRec> & { sans: string[]; clk: number[] }): GameRec => ({
  id: 'cc:t', src: 'chesscom', url: 'https://example.org/g', end: Date.parse('2026-10-16T12:00:00Z'), base: 180, inc: 0, color: 'w', result: 'l',
  timeLoss: false, timeWin: false, mat: materialTrack(over.sans) ?? [], ...over,
});

describe('Material', () => {
  it('Bilanz nach jedem Halbzug (Weiß minus Schwarz)', () => {
    // 1.e4 d5 2.exd5 Qxd5 3.Nc3 Qxg2?? (Dame schlägt Bauern, wird nicht geschlagen) -> Weiß -1, dann 4.Nb1 ...
    expect(materialTrack(['e4', 'd5', 'exd5', 'Qxd5'])).toEqual([0, 0, 1, 0]);
    expect(materialTrack(['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qxg2'])).toEqual([0, 0, 1, 0, 0, -1]);
  });
  it('unlesbarer Zug: null, Stellung nach n Halbzügen', () => {
    expect(materialTrack(['e4', 'Zz9'])).toBeNull();
    expect(fenAfter(['e4', 'e5'], 2)).toMatch(/^rnbqkbnr\/pppp1ppp\/8\/4p3\/4P3\/8\/PPPP1PPP\/RNBQKBNR w KQkq/);
  });
});

describe('chess.com lesen', () => {
  it('PGN-Text: Züge und Uhr', () => {
    const p = parseChessComPgn(pgnOf(['e4', 'c5', 'Nf3', 'O-O'], [179.9, 178.8, 179.2, 150.25]));
    expect(p.sans).toEqual(['e4', 'c5', 'Nf3', 'O-O']);
    expect(p.clk).toEqual([179.9, 178.8, 179.2, 150.3]);
  });

  const sans = longGame(35).sans;
  const clk = clocksFrom(sans.map(() => 3));
  const game = (over: Record<string, unknown>) => ({
    url: 'https://www.chess.com/game/live/111',
    uuid: 'u1',
    pgn: pgnOf(sans, clk),
    time_control: '180',
    end_time: 1792261041,
    rules: 'chess',
    time_class: 'blitz',
    white: { username: 'Ich', result: 'timeout' },
    black: { username: 'Er', result: 'win' },
    ...over,
  });

  it('übernimmt eigene Partien: Farbe, Ergebnis, Zeitverlust', () => {
    const [g] = parseChessComArchive({ games: [game({})] }, 'ich');
    expect(g).toMatchObject({ id: 'cc:u1', src: 'chesscom', color: 'w', result: 'l', timeLoss: true, timeWin: false, base: 180, inc: 0, end: 1792261041000 });
    expect(tcOf(g)).toBe('3+0');
    const [b] = parseChessComArchive({ games: [game({ white: { username: 'Er', result: 'win' }, black: { username: 'Ich', result: 'timeout' } })] }, 'ICH');
    expect(b).toMatchObject({ color: 'b', result: 'l', timeLoss: true });
    const [w] = parseChessComArchive({ games: [game({ white: { username: 'Ich', result: 'win' }, black: { username: 'Er', result: 'timeout' } })] }, 'ich');
    expect(w).toMatchObject({ result: 'w', timeWin: true, timeLoss: false });
    const [d] = parseChessComArchive({ games: [game({ white: { username: 'Ich', result: 'repetition' }, black: { username: 'Er', result: 'repetition' } })] }, 'ich');
    expect(d.result).toBe('d');
  });
  it('lässt fremde Partien, Varianten und lange Bedenkzeiten weg, Inkrement wird gelesen', () => {
    const list = [game({}), game({ rules: 'chess960' }), game({ time_class: 'rapid' }), game({ white: { username: 'A' }, black: { username: 'B' } }), game({ time_control: '180+2', url: 'https://www.chess.com/game/live/2', uuid: 'u2' })];
    const gs = parseChessComArchive({ games: list }, 'ich');
    expect(gs.map((x) => tcOf(x))).toEqual(['3+0', '3+2']);
    expect(parseChessComArchive(null, 'ich')).toEqual([]);
    expect(JSON.stringify(gs)).not.toMatch(/"Er"|"Ich"/);
  });
});

describe('lichess lesen', () => {
  const g = (over: Record<string, unknown>) =>
    JSON.stringify({
      id: 'abc12345', variant: 'standard', speed: 'bullet', status: 'outoftime', winner: 'black', lastMoveAt: 1792261041000,
      moves: 'e4 c5 Nf3 d6', clocks: [5990, 5980, 5900, 5800], clock: { initial: 60, increment: 0 },
      players: { white: { user: { name: 'Poquitonator' } }, black: { user: { name: 'Gegner' } } }, ...over,
    });
  it('übernimmt Partie, Uhr in Sekunden und Zeitverlust', () => {
    const [r] = parseLichessNdjson(`${g({})}\n`, 'poquitonator');
    expect(r).toMatchObject({ id: 'li:abc12345', src: 'lichess', color: 'w', result: 'l', timeLoss: true, base: 60, inc: 0, url: 'https://lichess.org/abc12345' });
    expect(r.clk).toEqual([59.9, 59.8, 59, 58]);
    expect(tcOf(r)).toBe('1+0');
  });
  it('nimmt Partien mit der zusätzlichen Uhr am Ende (Zeit, Aufgabe) wie lichess sie liefert', () => {
    const [r] = parseLichessNdjson(g({ clocks: [6003, 6003, 5900, 5800, 0] }), 'Poquitonator');
    expect(r.clk).toEqual([60.03, 60.03, 59, 58]);
    expect(parseLichessNdjson(g({ status: 'resign', clocks: [6003, 6003, 5900, 5800, 5700] }), 'Poquitonator')).toHaveLength(1);
  });
  it('lässt Abbrüche, Varianten, fremde Partien und kaputte Zeilen weg', () => {
    const text = [g({}), g({ status: 'aborted' }), g({ variant: 'chess960' }), g({ id: 'x2', players: { white: { user: { name: 'A' } }, black: { user: { name: 'B' } } } }), '{kaputt', ''].join('\n');
    expect(parseLichessNdjson(text, 'Poquitonator')).toHaveLength(1);
    expect(parseLichessNdjson(g({ winner: undefined, status: 'draw' }), 'Poquitonator')[0].result).toBe('d');
  });
});

describe('Uhr-Auswertung', () => {
  it('Uhr vor Zug N ist die Restzeit nach dem eigenen Zug N-1', () => {
    const { sans, spent } = longGame(35, (k) => (k === 19 ? 20 : 4));
    const clk = clocksFrom(spent);
    const m = metricsOf(rec({ sans, clk }));
    // Weiß: Zug 1 bis 19 verbrauchen 18*4 + 20 = 92 s -> vor Zug 20 stehen 88 s auf der Uhr
    expect(m.before20).toBeCloseTo(88, 5);
    expect(m.before30).toBeCloseTo(180 - (18 * 4 + 20 + 10 * 4), 5);
    expect(m.moves).toBe(35);
  });

  it('eigene Zeit Zug 16 bis 29, Vorsprung gegenüber dem Gegner', () => {
    const { sans, spent } = longGame(35, () => 5);
    const m = metricsOf(rec({ sans, clk: clocksFrom(spent) }));
    expect(m.own1629).toBeCloseTo(14 * 5, 5);
    // 29 Züge mit 5 s gegen 29 Züge des Gegners mit 3 s: (180 - 145) - (180 - 87)
    expect(m.lead30).toBeCloseTo(-58, 5);
  });

  it('Denkpausen ab 10 s im Fenster Zug 15 bis 35, Inkrement wird abgerechnet', () => {
    const { sans, spent } = longGame(36, (k) => ({ 14: 30, 15: 10, 23: 31, 35: 11, 36: 50 })[k] ?? 3);
    const m = metricsOf(rec({ sans, clk: clocksFrom(spent) }));
    expect(m.pauses.map((p) => [p.move, Math.round(p.secs)])).toEqual([[15, 10], [23, 31], [35, 11]]);
    expect(m.pauses[1].san).toBe(sans[2 * 22]);
    const withInc = longGame(35, (k) => (k === 20 ? 12 : 3));
    const mi = metricsOf(rec({ sans: withInc.sans, clk: clocksFrom(withInc.spent, 180, 2), inc: 2 }));
    expect(mi.pauses.map((p) => [p.move, Math.round(p.secs)])).toEqual([[20, 12]]);
  });

  it('Budget nur ohne Inkrement ab 3 Minuten, im selben Verhältnis', () => {
    expect(budgetOf({ base: 180, inc: 0 })).toEqual({ b20: 120, b30: 80 });
    expect(budgetOf({ base: 300, inc: 0 })).toEqual({ b20: 200, b30: 80 * (300 / 180) });
    expect(budgetOf({ base: 180, inc: 2 })).toBeNull();
    expect(budgetOf({ base: 60, inc: 0 })).toBeNull();
    const fast = longGame(35, () => 2);
    const slow = longGame(35, () => 4);
    expect(metricsOf(rec({ sans: fast.sans, clk: clocksFrom(fast.spent) }))).toMatchObject({ ok20: true, ok30: true });
    expect(metricsOf(rec({ sans: slow.sans, clk: clocksFrom(slow.spent) }))).toMatchObject({ ok20: false, ok30: false });
    expect(metricsOf(rec({ sans: fast.sans, clk: clocksFrom(fast.spent), base: 60 }))).toMatchObject({ ok20: null, ok30: null });
  });

  it('kurze Partie: noch keine Uhr vor Zug 20 oder 30', () => {
    const { sans, spent } = longGame(18);
    const m = metricsOf(rec({ sans, clk: clocksFrom(spent) }));
    expect(m).toMatchObject({ before20: null, before30: null, lead30: null, own1629: null, ok30: null });
    expect(m.before16).not.toBeNull();
  });

  it('auf Zeit verloren mit Mehrmaterial (mindestens 2 Bauerneinheiten vorn)', () => {
    const { sans, spent } = longGame(30);
    const clk = clocksFrom(spent);
    const mat = (v: number) => sans.map(() => v);
    expect(metricsOf(rec({ sans, clk, timeLoss: true, mat: mat(3) })).lostOnTimeAhead).toBe(true);
    expect(metricsOf(rec({ sans, clk, timeLoss: true, mat: mat(1) })).lostOnTimeAhead).toBe(false);
    expect(metricsOf(rec({ sans, clk, timeLoss: false, mat: mat(3) })).lostOnTimeAhead).toBe(false);
    // als Schwarz zählt die Bilanz mit umgekehrtem Vorzeichen
    expect(metricsOf(rec({ sans, clk, color: 'b', timeLoss: true, mat: mat(-3) })).lostOnTimeAhead).toBe(true);
  });

  it('Qualitätsbremse: schnelle Züge mit anschließendem Materialverlust', () => {
    // Zug 10 bis 12 von Weiß in 1 s; Zug 12 hängt die Dame (Qxe5+?? Nxe5)
    const lead = [...SHUFFLE, ...SHUFFLE, ...SHUFFLE, ...SHUFFLE].slice(0, 16); // Züge 1 bis 8
    const sans = [...lead, 'Nc3', 'Nc6', 'e4', 'e5', 'Qh5', 'Nf6', 'Qxe5+', 'Nxe5'];
    expect(sans.length).toBe(24);
    const spent = sans.map((_, i) => (i % 2 === 0 && i / 2 + 1 >= 9 ? 1 : 3));
    const m = metricsOf(rec({ sans, clk: clocksFrom(spent) }));
    // eigene Züge 10 bis 12 sind schnell (1 s, Restzeit weit über 30 s)
    expect(m.fast).toBe(3);
    // Zug 12 (Qxe5+) verliert die Dame für einen Bauern; auch Zug 11 (Qh5) und Zug 10 (e4) sehen bis zu Zug 12 den Verlust nicht als 2-Halbzug-Folge
    expect(m.fastBad).toBe(1);
  });

  it('ohne lesbare Züge keine Bremse, aber die Uhr bleibt', () => {
    const { sans, spent } = longGame(35, () => 1);
    const m = metricsOf(rec({ sans, clk: clocksFrom(spent), mat: [] }));
    expect(m.fast).toBe(0);
    expect(m.before30).not.toBeNull();
  });

  it('Zusammenfassung über mehrere Partien', () => {
    const a = longGame(35, () => 2);
    const b = longGame(35, () => 4);
    const ga = rec({ sans: a.sans, clk: clocksFrom(a.spent), result: 'w', id: 'a' });
    const gb = rec({ sans: b.sans, clk: clocksFrom(b.spent), result: 'l', timeLoss: true, id: 'b' });
    const s = summarize([ga, gb]);
    expect(s).toMatchObject({ n: 2, reach30: 2, reach20: 2, budget20: 50, budget30: 50, losses: 1, lostOnTime: 1 });
    expect(s.own1629).toBeCloseTo((14 * 2 + 14 * 4) / 2, 5);
    expect(summarize([]).own1629).toBeNull();
    expect(sd([1, 3])).toBeCloseTo(Math.SQRT2, 5);
    expect(sd([1])).toBeNull();
  });
});

describe('Vorläufiges Urteil', () => {
  it('misst am Bereich der Monatswerte, bei kleineren Werten als besser, wenn niedriger besser ist', () => {
    const r = { lo: -23, hi: -6 };
    expect(compareRange(-15, r, false)).toBe('inside');
    expect(compareRange(-30, r, false)).toBe('worse'); // Vorsprung: höher ist besser
    expect(compareRange(0, r, false)).toBe('better');
    expect(compareRange(2.5, { lo: 1, hi: 3.5 }, true)).toBe('inside');
    expect(compareRange(0.2, { lo: 1, hi: 3.5 }, true)).toBe('better'); // Denkpausen: weniger ist besser
    expect(compareRange(5, { lo: 1, hi: 3.5 }, true)).toBe('worse');
    // der Zufall weniger Partien verschiebt den Rand: knapp außerhalb zählt mit Spielraum noch als normal
    expect(compareRange(-26, r, false)).toBe('worse');
    expect(compareRange(-26, r, false, 5)).toBe('inside');
    expect(compareRange(-35, r, false, 5)).toBe('worse');
  });
  it('kennt die Mindestmenge und zählt, was bis dahin fehlt', () => {
    expect(PRELIM_MIN).toBe(20);
    expect(missing(4, PRELIM_MIN)).toBe(16);
    expect(missing(25, PRELIM_MIN)).toBe(0);
    expect(compare(50, 120, { mean: 74, sd: 27 }, 206, true)).toBe('better');
  });
});
