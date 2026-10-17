import { describe, expect, it } from 'vitest';
import { buildVariations, evAt, numberedMoves, tagsOf } from '../src/lib/variation';
import type { Exercise, Line } from '../src/lib/types';

const FEN = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7';

const line = (san: string, wp: number, pv: string[], ev?: number[]): Line => ({ san, uci: 'a1a1', wp, cp: 0, pv, ...(ev ? { ev } : {}) });

const ex = (over: Partial<Exercise> = {}): Exercise =>
  ({
    id: 'x',
    fen: FEN,
    turn: 'w',
    lines: [
      line('Bg5', 60, ['Bg5', 'h6', 'Bh4', 'g5'], [60, 61, 59, 60]),
      line('Na4', 55, ['Na4', 'Bb6', 'Nxb6', 'axb6'], [55, 54, 56, 55]),
      line('Be3', 52, ['Be3', 'Bxe3', 'fxe3', 'Ng4'], [52, 51, 50, 52]),
      line('a3', 45, ['a3', 'a6']),
      line('h3', 30, ['h3', 'h6']),
    ],
    played: { san: 'Nd5', uci: 'c3d5', wp: 20, cp: 0 },
    refs: [
      ['Nd5', ['Nxd5', 'Bxd5', 'c6'], [20, 22, 21, 22]],
      ['Bb5', ['Bd7', 'Bxc6', 'Bxc6']],
    ],
    ...over,
  }) as unknown as Exercise;

describe('buildVariations', () => {
  it('bietet beste und gleichwertige Linien, jeweils mit den Bewertungen', () => {
    const v = buildVariations(ex(), null, true);
    expect(v.map((x) => x.san)).toEqual(['Bg5', 'Na4', 'Be3', 'Nd5']);
    expect(v[0].best).toBe(true);
    expect(v[1].equal).toBe(true);
    expect(v[0].moves).toEqual(['Bg5', 'h6', 'Bh4', 'g5']);
    expect(v[3].moves).toEqual(['Nd5', 'Nxd5', 'Bxd5', 'c6']);
  });

  it('nimmt "Nur der beste" ernst: ohne Toleranz keine gleichwertigen Linien', () => {
    const v = buildVariations(ex(), null, false);
    expect(v.map((x) => x.san)).toEqual(['Bg5', 'Nd5']);
  });

  it('fügt den eigenen Zug hinzu, aus den Linien (a3, schwächer) oder aus den Widerlegungen', () => {
    const own = buildVariations(ex(), 'a3', true).find((x) => x.own)!;
    expect(own.san).toBe('a3');
    expect(own.equal).toBe(false);
    expect(own.ev).toBeNull();
    expect(own.wp).toBe(45);
    const viaRef = buildVariations(ex(), 'Bb5', true).find((x) => x.own)!;
    expect(viaRef.moves).toEqual(['Bb5', 'Bd7', 'Bxc6', 'Bxc6']);
    expect(viaRef.wp).toBeNull();
  });

  it('markiert den gespielten Zug gleich dem Partiezug nur einmal', () => {
    const v = buildVariations(ex(), 'Nd5', true);
    expect(v.filter((x) => x.san === 'Nd5')).toHaveLength(1);
    expect(v.find((x) => x.san === 'Nd5')).toMatchObject({ own: true, game: true });
    expect(tagsOf(v.find((x) => x.san === 'Nd5')!)).toBe('dein Zug, in der Partie');
  });

  it('kennzeichnet den eigenen gleichwertigen Zug in der Gruppe der gleichwertigen', () => {
    const v = buildVariations(ex(), 'Na4', true);
    expect(v.map((x) => x.san)).toEqual(['Bg5', 'Na4', 'Be3', 'Nd5']);
    expect(tagsOf(v[1])).toBe('gleichwertig, dein Zug');
  });

  it('nimmt für einen falschen Zug unter den fünf besten Linien die gespeicherte Widerlegung samt Bewertungen', () => {
    const e = ex({
      played: { san: 'h3', uci: 'h2h3', wp: 30, cp: 0 },
      refs: [['h3', ['Nxe4', 'dxe4', 'Qxd1'], [30, 12, 14, 8]]],
    });
    const v = buildVariations(e, 'h3', true).find((x) => x.san === 'h3')!;
    expect(v.moves).toEqual(['h3', 'Nxe4', 'dxe4', 'Qxd1']);
    expect(v.ev).toEqual([30, 12, 14, 8]);
    expect(v.own && v.game).toBe(true);
    expect(evAt(e, v, 2)).toBe(12);
    // gleichwertige Linien behalten ihre eigene, tiefere Variante
    expect(buildVariations(e, null, true).find((x) => x.san === 'Na4')!.moves).toHaveLength(4);
  });

  it('übersteht Übungen ohne Widerlegungen', () => {
    const v = buildVariations(ex({ refs: undefined }), 'Qh5', true);
    expect(v.map((x) => x.san)).toEqual(['Bg5', 'Na4', 'Be3']);
  });
});

describe('evAt', () => {
  it('Schritt 0 und keine Variante: Wert des besten Zuges', () => {
    const e = ex();
    const v = buildVariations(e, 'Nd5', true);
    expect(evAt(e, null, 3)).toBe(60);
    expect(evAt(e, v[3], 0)).toBe(60);
  });

  it('folgt den gerechneten Werten und bleibt am Ende stehen', () => {
    const e = ex();
    const v = buildVariations(e, 'Nd5', true);
    const nd5 = v.find((x) => x.san === 'Nd5')!;
    expect(evAt(e, nd5, 1)).toBe(20);
    expect(evAt(e, nd5, 2)).toBe(22);
    expect(evAt(e, nd5, 9)).toBe(22);
  });

  it('ohne gerechnete Werte bleibt die Variante auf dem Wert der Linie, ohne diesen null', () => {
    const e = ex();
    const a3 = buildVariations(e, 'a3', true).find((x) => x.san === 'a3')!;
    expect(evAt(e, a3, 1)).toBe(45);
    expect(evAt(e, a3, 3)).toBe(45);
    const bb5 = buildVariations(e, 'Bb5', true).find((x) => x.san === 'Bb5')!;
    expect(evAt(e, bb5, 2)).toBeNull();
  });
});

describe('numberedMoves', () => {
  it('weiß am Zug', () => {
    expect(numberedMoves(FEN, ['Bg5', 'h6', 'Bh4', 'g5'])).toEqual(['7.Bg5', 'h6', '8.Bh4', 'g5']);
  });
  it('schwarz am Zug beginnt mit Auslassungszeichen', () => {
    const black = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 b - - 0 7';
    expect(numberedMoves(black, ['h6', 'Bh4', 'g5'])).toEqual(['7…h6', '8.Bh4', 'g5']);
  });
});
