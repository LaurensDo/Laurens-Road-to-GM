import { describe, expect, it } from 'vitest';
import { lastMoveLabel } from '../src/lib/explain';
import { lastSquares } from '../src/lib/chess';
import { plan, RULES, type Plan, type Slot, type Sfx } from '../src/lib/sound';
import type { Exercise } from '../src/lib/types';

const slot = (name: Sfx, start: number): Slot => ({ name, start, end: start + RULES[name].len, prio: RULES[name].prio });
const played = (p: Plan) => {
  if (p.action !== 'play') throw new Error('erwartet: spielen');
  return p;
};

describe('Mixer: nie zwei Töne gleichzeitig', () => {
  it('ohne laufenden Ton klingt der neue sofort', () => {
    const p = played(plan([], 'move', 10));
    expect(p.start).toBeCloseTo(10.005, 5);
    expect(p.cut).toEqual([]);
  });

  it('Auswahl-Ton wird verschluckt, solange etwas klingt', () => {
    expect(plan([slot('move', 10)], 'ui', 10.02).action).toBe('drop');
    expect(plan([slot('tick', 10)], 'ui', 10.01).action).toBe('drop');
  });

  it('Ergebnis-Ton reiht sich hinter den Zugton ein und überlagert nicht', () => {
    const move = slot('capture', 10);
    const p = played(plan([move], 'correct', 10.02));
    expect(p.start).toBeGreaterThanOrEqual(move.end);
    expect(p.cut).toEqual([]);
  });

  it('mehrere eingereihte Töne laufen hintereinander', () => {
    const a = slot('move', 10);
    const b = played(plan([a], 'wrong', 10.01));
    const c = played(plan([a, { name: 'wrong', start: b.start, end: b.end, prio: 5 }], 'done', 10.02));
    expect(b.start).toBeGreaterThanOrEqual(a.end);
    expect(c.start).toBeGreaterThanOrEqual(b.end);
  });

  it('zu lange Warteschlange wird verworfen', () => {
    const long = { name: 'done' as Sfx, start: 10, end: 11.5, prio: 6 };
    expect(plan([long], 'correct', 10.1).action).toBe('drop');
  });

  it('Zugton unterbricht Leiseres (Auswahl, Klick), aber nicht Gleichrangiges nach oben', () => {
    const sel = slot('select', 10);
    const p = played(plan([sel], 'move', 10.02));
    expect(p.cut).toEqual([sel]);
    expect(p.start).toBeGreaterThan(10.02);
    expect(plan([slot('correct', 10)], 'move', 10.1).action).toBe('drop');
  });

  it('Start-Ton unterbricht den Klick, wird aber beim Ergebnis-Ton verworfen', () => {
    expect(played(plan([slot('ui', 10)], 'start', 10.01)).cut).toHaveLength(1);
    expect(plan([slot('correct', 10)], 'start', 10.1).action).toBe('drop');
  });

  it('Zeitablauf unterbricht Ticks', () => {
    const tick = slot('tickLast', 10);
    expect(played(plan([tick], 'timeUp', 10.02)).cut).toEqual([tick]);
  });

  it('gleiche Zugtöne in schneller Folge: der neue ersetzt den alten', () => {
    const m = slot('move', 10);
    expect(played(plan([m], 'move', 10.03)).cut).toEqual([m]);
  });

  it('abgelaufene Töne blockieren nichts mehr', () => {
    expect(played(plan([slot('done', 5)], 'ui', 10)).cut).toEqual([]);
  });

  it('Zufallsfolgen: Die tatsächlich klingenden Zeitfenster überlappen nie', () => {
    const names = Object.keys(RULES) as Sfx[];
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff);
    for (let round = 0; round < 200; round++) {
      let slots: Slot[] = [];
      const all: Slot[] = [];
      let now = 0;
      for (let i = 0; i < 40; i++) {
        now += rnd() * 0.25;
        const name = names[Math.floor(rnd() * names.length)];
        const p = plan(slots, name, now);
        if (p.action === 'drop') continue;
        for (const c of p.cut) c.end = c.start >= p.start ? c.start : Math.min(c.end, p.start);
        const s: Slot = { name, start: p.start, end: p.end, prio: RULES[name].prio };
        slots = [...slots.filter((x) => x.end > now), s];
        all.push(s);
      }
      const sorted = all.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].start).toBeGreaterThanOrEqual(sorted[i - 1].end - 1e-9);
      }
    }
  });
});

describe('Letzter Zug', () => {
  const ex = (turn: 'w' | 'b', fen: string): Exercise =>
    ({ turn, fen, prev: { board: '8/8/8/8/8/8/8/8', uci: 'g8f6', san: 'Nf6' } }) as unknown as Exercise;

  it('Zugnummer mit Punkten für Schwarz und einem Punkt für Weiß', () => {
    expect(lastMoveLabel(ex('w', '8/8/8/8/8/8/8/8 w - - 0 14'))).toBe('13...Nf6');
    expect(lastMoveLabel(ex('b', '8/8/8/8/8/8/8/8 b - - 0 14'))).toBe('14.Nf6');
    expect(lastMoveLabel({ turn: 'w', fen: '8/8/8/8/8/8/8/8 w - - 0 14' } as Exercise)).toBeNull();
  });

  it('Felder des Zugs für die Hervorhebung', () => {
    expect(lastSquares({ prev: { uci: 'e1g1' } })).toEqual(['e1', 'g1']);
    expect(lastSquares({})).toBeUndefined();
  });
});
