import { describe, expect, it } from 'vitest';
import { costText, ideaText } from '../src/lib/why';
import { explain } from '../src/lib/explain';
import type { Exercise } from '../src/lib/types';

const FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
const ex = (over: Partial<Exercise> = {}): Exercise =>
  ({
    id: 'x',
    fen: FEN,
    turn: 'w',
    cat: 'Gegnerfehler nicht bestraft',
    motifs: [],
    missed: ['Gabel'],
    lines: [{ san: 'Ng5', uci: 'f3g5', wp: 70, cp: 120, pv: ['Ng5', 'd5', 'exd5', 'Nxd5', 'Nxf7'] }],
    played: { san: 'd3', uci: 'd2d3', wp: 50, cp: 0 },
    loss: 20,
    clock: 100,
    spent: 4,
    maia: { me: null, up: null, cls: null },
    why: {
      tags: ['Stiller Zug', 'Gabel', 'Angriff auf f2/f7'],
      gain: { pts: 1, words: 'einen Bauern', line: ['Ng5', 'd5', 'exd5', 'Nxd5'] },
      against: [['Nc3', { pts: 3, words: 'einen Läufer', line: ['Nxe4', 'Nxe4', 'd5'] }], ['O-O', { mate: 2, line: ['Ng4', 'h3', 'Qh4'] }]],
    },
    ...over,
  }) as unknown as Exercise;

describe('Idee zum besten Zug', () => {
  it('nennt taktische Motive zuerst und den Gewinn mit nummerierter Linie', () => {
    expect(ideaText(ex())).toBe('Gabel, Angriff auf f2/f7, Stiller Zug. Nach 4.Ng5 d5 5.exd5 Nxd5 gewinnst du einen Bauern.');
  });
  it('Matt wird als Matt genannt', () => {
    expect(ideaText(ex({ why: { tags: [], gain: { mate: 2, line: ['Qxf7+', 'Ke7', 'Qe6#'] }, against: [] } }))).toBe('Matt in 2: 4.Qxf7+ Ke7 5.Qe6#.');
  });
  it('ohne Motiv und Gewinn ehrlich: keine schnelle Taktik; bei "Sicher gewinnen" und ohne Angaben nichts', () => {
    expect(ideaText(ex({ why: { tags: [], gain: null, against: [] } }))).toMatch(/^Keine schnelle Taktik/);
    // eigener Patzer: Die Lehre ist "nichts einstellen", mit der Drohung des Gegners, wenn sie bekannt ist
    const blunder = ex({ cat: 'Figur eingestellt', why: { tags: [], gain: null, against: [] }, threat: { uci: 'f6e4', san: 'Nxe4', gain: 30 } });
    expect(ideaText(blunder)).toBe('Keine eigene Taktik: Wichtig ist, nichts einzustellen. Der Gegner droht Nxe4.');
    expect(ideaText(ex({ win: { safe: 80 } }))).toBeNull();
    expect(ideaText(ex({ why: undefined }))).toBeNull();
  });
  it('was der Fehlzug kostet, mit der Fortsetzung des Gegners', () => {
    expect(costText(ex(), 'Nc3')).toBe('Nach 4.Nc3 folgt Nxe4 5.Nxe4 d5, und du verlierst einen Läufer.');
    expect(costText(ex(), 'O-O')).toBe('Nach 4.O-O folgt Ng4 5.h3 Qh4, und du wirst mattgesetzt.');
    expect(costText(ex(), 'a3')).toBeNull();
  });
  it('eine Umwandlung heißt "neue Dame", nicht "die Dame für einen Bauern"', () => {
    const own = ex({ why: { tags: [], gain: { pts: 8, new: 'eine neue Dame', line: ['Ng5', 'd5'] }, against: [] } });
    expect(ideaText(own)).toBe('Nach 4.Ng5 d5 bekommst du eine neue Dame.');
    const both = ex({ why: { tags: [], gain: { pts: 13, words: 'einen Turm', new: 'eine neue Dame', line: ['Ng5', 'd5'] }, against: [] } });
    expect(ideaText(both)).toBe('Nach 4.Ng5 d5 gewinnst du einen Turm und bekommst eine neue Dame.');
    const opp = ex({ why: { tags: [], gain: null, against: [['Nc3', { pts: 8, new: 'eine neue Dame', line: ['Nxe4', 'Nxe4'] }]] } });
    expect(costText(opp, 'Nc3')).toBe('Nach 4.Nc3 folgt Nxe4 5.Nxe4, und der Gegner bekommt eine neue Dame.');
    const mixed = ex({ why: { tags: [], gain: null, against: [['Nc3', { pts: 11, words: 'einen Läufer', new: 'eine neue Dame', line: ['Nxe4'] }]] } });
    expect(costText(mixed, 'Nc3')).toBe('Nach 4.Nc3 folgt Nxe4: Du verlierst einen Läufer, und der Gegner bekommt eine neue Dame.');
  });
  it('im Remis-Endspiel kein "gewinnst du": Dort geht es ums Halten', () => {
    const drawn = ex({ tb: { res: 'd', moves: [] }, why: { tags: ['Umwandlung'], gain: { pts: 8, words: 'die Dame für einen Bauern', line: ['Ng5'] }, against: [] } });
    expect(ideaText(drawn)).toBe('Umwandlung.');
  });
  it('die alte Zeile "In der besten Fortsetzung steckt" entfällt, wenn es die Idee gibt', () => {
    expect(explain(ex()).join(' ')).not.toMatch(/In der besten Fortsetzung steckt/);
    expect(explain(ex({ why: undefined })).join(' ')).toMatch(/In der besten Fortsetzung steckt: Gabel/);
  });
});
