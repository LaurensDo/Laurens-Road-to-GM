import { describe, expect, it } from 'vitest';
import { AUTHOR, QUOTES, nextInBag, readTimeMs } from '../src/lib/quotes';

const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff);

describe('Zitate', () => {
  it('Liste: viele, eindeutig, lesbar kurz, Urheber ist Big Dog', () => {
    expect(QUOTES.length).toBe(45);
    expect(new Set(QUOTES).size).toBe(QUOTES.length);
    for (const q of QUOTES) {
      expect(q.length).toBeGreaterThan(10);
      expect(q.length).toBeLessThanOrEqual(140);
      expect(q).not.toMatch(/[„“]/); // innen nur ‚…‘, außen setzt das Startbild „…“
    }
    expect(AUTHOR).toBe('Big Dog');
  });

  it('gestrichene Themen sind raus (Online-Kultur, Schach-Jargon, Cheems)', () => {
    expect(QUOTES.join('\n')).not.toMatch(/Cheems|Webcam|Sizilianer|Rochade|Bauernstruktur|Abzugsschach|\bez\b/);
  });

  it('der geänderte Favorit steht in der Liste', () => {
    expect(QUOTES).toContain('En passant? Ich nenne das beim Gassigehen kassieren.');
  });

  it('Lesezeit: kurz 2,8 s, lang höchstens 4 s', () => {
    expect(readTimeMs('x'.repeat(10))).toBe(2800);
    expect(readTimeMs('x'.repeat(80))).toBe(3440);
    expect(readTimeMs('x'.repeat(300))).toBe(4000);
    expect(Math.max(...QUOTES.map((q) => readTimeMs(q)))).toBeLessThanOrEqual(4000);
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

import { splashBand } from '../src/lib/viewport';

describe('Startbild: fehlender Streifen oben', () => {
  const ipadQuer = { screenW: 1024, screenH: 1366, innerW: 1366, innerH: 992, standalone: true };
  it('iPad Pro 12,9" quer: 32 Punkte, wie in der Anzeige-Info gemessen', () => {
    expect(splashBand(ipadQuer)).toBe(32);
  });
  it('Hochformat nutzt die lange Seite', () => {
    expect(splashBand({ ...ipadQuer, innerW: 1024, innerH: 1334 })).toBe(32);
    expect(splashBand({ ...ipadQuer, innerW: 1024, innerH: 1366 })).toBe(0);
  });
  it('nicht als App, auf Handys und in kleinen Fenstern: kein Ausgleich', () => {
    expect(splashBand({ ...ipadQuer, standalone: false })).toBe(0);
    expect(splashBand({ screenW: 390, screenH: 844, innerW: 390, innerH: 797, standalone: true })).toBe(0);
    expect(splashBand({ ...ipadQuer, innerW: 700, innerH: 992 })).toBe(0); // Split View: kein Querformat, große Lücke
    expect(splashBand({ ...ipadQuer, innerH: 700 })).toBe(0);
  });
});
