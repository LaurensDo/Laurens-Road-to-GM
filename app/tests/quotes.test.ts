import { describe, expect, it } from 'vitest';
import { AUTHOR, QUOTES, nextInBag } from '../src/lib/quotes';

const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff);

describe('Zitate', () => {
  it('Liste: viele, eindeutig, lesbar kurz, Urheber ist Big Dog', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(25);
    expect(new Set(QUOTES).size).toBe(QUOTES.length);
    for (const q of QUOTES) {
      expect(q.length).toBeGreaterThan(10);
      expect(q.length).toBeLessThanOrEqual(140);
    }
    expect(AUTHOR).toBe('Big Dog');
  });

  it('jedes Zitat kommt in einem Durchlauf genau einmal', () => {
    const n = QUOTES.length;
    let bag = null as ReturnType<typeof nextInBag>['bag'] | null;
    const seen: number[] = [];
    const r = rng(3);
    for (let i = 0; i < n; i++) {
      const res = nextInBag(bag, n, r);
      seen.push(res.index);
      bag = res.bag;
    }
    expect(new Set(seen).size).toBe(n);
  });

  it('nach dem Durchlauf wird neu gemischt, ohne dass das letzte sofort wiederkommt', () => {
    const n = 6;
    for (let seed = 1; seed < 60; seed++) {
      const r = rng(seed);
      let bag = null as ReturnType<typeof nextInBag>['bag'] | null;
      let last = -1;
      for (let i = 0; i < n * 5; i++) {
        const res = nextInBag(bag, n, r);
        expect(res.index).not.toBe(last);
        last = res.index;
        bag = res.bag;
      }
    }
  });

  it('kaputte oder veraltete Speicherung wird sauber ersetzt', () => {
    const r = rng(9);
    expect(nextInBag({ order: [0, 0, 1], pos: 1 }, 3, r).bag.order.slice().sort()).toEqual([0, 1, 2]);
    expect(nextInBag({ order: [0, 1], pos: 5 }, 3, r).bag.order).toHaveLength(3);
    expect(nextInBag(undefined, 1, r).index).toBe(0);
    const grown = nextInBag({ order: [2, 0, 1], pos: 1 }, 4, r); // Liste wurde länger
    expect(grown.bag.order).toHaveLength(4);
  });
});
