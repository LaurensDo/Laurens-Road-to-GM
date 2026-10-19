import { describe, expect, it } from 'vitest';
import { COVER_WP, equalMoves, gradeFor, judge, wpOf } from '../src/lib/judge';
import { destsOf, isPromotion, positionOf, sanOfMove, walkVariation } from '../src/lib/chess';
import { applyReview, dueDate, newRecord } from '../src/lib/srs';
import { counts, pickNext } from '../src/lib/queue';
import { emptyState, type Exercise } from '../src/lib/types';
import { explain } from '../src/lib/explain';
import { lastDays, trainingDays } from '../src/lib/stats';
import { dateLabel, inWords } from '../src/lib/format';

const ex = (over: Partial<Exercise> = {}): Exercise => ({
  id: 'a1',
  fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  turn: 'w',
  phase: 'Eröffnung',
  cat: 'Figur eingestellt',
  motifs: ['Gabel'],
  themes: ['fork'],
  lines: [
    { san: 'Nf3', uci: 'g1f3', wp: 55, cp: 20, pv: ['Nf3', 'Nc6'] },
    { san: 'Bc4', uci: 'f1c4', wp: 50, cp: 10, pv: ['Bc4'] },
    { san: 'd4', uci: 'd2d4', wp: 40, cp: -20, pv: ['d4'] },
    { san: 'f4', uci: 'f2f4', wp: 20, cp: -90, pv: ['f4'] },
  ],
  played: { san: 'Qh5', uci: 'd1h5', wp: 30, cp: -50 },
  loss: 25,
  clock: 120,
  spent: 3,
  date: '2026-10-01',
  url: 'https://example.org/g',
  src: 'lichess',
  maia: { me: 0.4, up: 0.6, cls: 'Nächste Stufe' },
  ...over,
});

describe('judge', () => {
  it('bester Zug ist richtig', () => {
    expect(judge(ex(), 'Nf3', true)).toMatchObject({ verdict: 'best', correct: true, wp: 55 });
  });
  it('gleichwertiger Zug (bis 10 Punkte) zählt nur mit Toleranz', () => {
    expect(judge(ex(), 'Bc4', true)).toMatchObject({ verdict: 'equal', correct: true });
    expect(judge(ex(), 'Bc4', false)).toMatchObject({ verdict: 'playable', correct: false });
  });
  it('spielbar, aber schwächer, zählt nicht als richtig', () => {
    expect(judge(ex(), 'd4', true)).toMatchObject({ verdict: 'playable', correct: false });
  });
  it('schwacher oder unbekannter Zug ist falsch', () => {
    expect(judge(ex(), 'f4', true)).toMatchObject({ verdict: 'wrong', correct: false });
    expect(judge(ex(), 'a3', true)).toMatchObject({ verdict: 'wrong', lossWp: null, wp: null });
  });
  it('weitere bewertete Züge außerhalb der Top 5 zählen mit (faires Urteil)', () => {
    const e = ex({ more: [['Be2', 52], ['Nc3', 47], ['g3', 38], ['h3', 20]] });
    expect(wpOf(e, 'Be2')).toBe(52);
    expect(judge(e, 'Be2', true)).toMatchObject({ verdict: 'equal', correct: true, wp: 52 });
    expect(judge(e, 'Be2', false)).toMatchObject({ verdict: 'playable', correct: false });
    expect(judge(e, 'Nc3', true)).toMatchObject({ verdict: 'equal', correct: true });
    expect(judge(e, 'g3', true)).toMatchObject({ verdict: 'playable', correct: false });
    expect(judge(e, 'h3', true)).toMatchObject({ verdict: 'wrong', lossWp: 35 });
    // was nirgends steht, liegt weit zurück
    expect(judge(e, 'a3', true)).toMatchObject({ verdict: 'wrong', lossWp: null, wp: null });
    expect(COVER_WP).toBeGreaterThanOrEqual(25);
  });
  it('gleichwertige Züge: Top 5 und weitere, nach Einstellung', () => {
    const e = ex({ more: [['Be2', 52], ['Nc3', 47], ['g3', 38]] });
    expect(equalMoves(e, true).map((m) => m.san)).toEqual(['Be2', 'Bc4', 'Nc3']);
    expect(equalMoves(e, false)).toEqual([]);
  });
  it('zwei Mattzüge sind gleich gut', () => {
    const mate = ex({ lines: [{ san: 'Qxf7#', uci: 'd1f7', wp: 100, cp: 9999, pv: [] }, { san: 'Qh5#', uci: 'd1h5', wp: 100, cp: 9998, pv: [] }] });
    expect(judge(mate, 'Qh5#', false).verdict).toBe('best');
  });
});

describe('gradeFor', () => {
  it('falsch = 1, zu langsam = 2, in der Zeit = 3', () => {
    expect(gradeFor(false, 1000, 10)).toBe(1);
    expect(gradeFor(true, 10500, 10)).toBe(2);
    expect(gradeFor(true, 9500, 10)).toBe(3);
    expect(gradeFor(true, 99000, 0)).toBe(3);
  });
});

describe('chess', () => {
  it('Rochade (König zwei Felder) wird als O-O erkannt', () => {
    const pos = positionOf('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    expect(sanOfMove(pos, 'e1', 'g1')).toBe('O-O');
    expect(sanOfMove(pos, 'e1', 'h1')).toBe('O-O');
    expect(sanOfMove(pos, 'e1', 'c1')).toBe('O-O-O');
  });
  it('Umwandlung wird erkannt und als SAN geschrieben', () => {
    const pos = positionOf('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    expect(isPromotion(pos, 'a7', 'a8')).toBe(true);
    expect(sanOfMove(pos, 'a7', 'a8', 'queen')).toBe('a8=Q');
    expect(sanOfMove(pos, 'a7', 'a8', 'knight')).toBe('a8=N');
  });
  it('unzulässiger Zug liefert null', () => {
    expect(sanOfMove(positionOf(ex().fen), 'e1', 'e5')).toBeNull();
  });
  it('en passant und Zugziele aus Chessground-Sicht', () => {
    const pos = positionOf('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
    expect(destsOf(pos).get('e5')).toContain('f6');
    expect(sanOfMove(pos, 'e5', 'f6')).toBe('exf6');
  });
  it('Variante wird Zug für Zug abgespielt', () => {
    const steps = walkVariation(ex().fen, ['Nf3', 'Nc6', 'Bb5']);
    expect(steps).toHaveLength(4);
    expect(steps[1].lastMove).toEqual(['g1', 'f3']);
  });
  it('unlesbarer Zug bricht die Variante ab', () => {
    expect(walkVariation(ex().fen, ['Nf3', 'Qxx9', 'Bb5'])).toHaveLength(2);
  });
});

describe('srs', () => {
  const t0 = new Date('2026-10-15T10:00:00');
  it('falsch kommt innerhalb von Minuten wieder', () => {
    const rec = applyReview(undefined, 1, t0);
    const mins = (dueDate(rec).getTime() - t0.getTime()) / 60000;
    expect(mins).toBeGreaterThan(0);
    expect(mins).toBeLessThanOrEqual(15);
    expect(rec.lapses).toBe(1);
  });
  it('richtig schiebt weiter als schwer', () => {
    const good = dueDate(applyReview(newRecord(t0), 3, t0)).getTime();
    const hard = dueDate(applyReview(newRecord(t0), 2, t0)).getTime();
    expect(good).toBeGreaterThanOrEqual(hard);
  });
  it('Abstände wachsen bei wiederholt richtigen Antworten', () => {
    let rec = applyReview(undefined, 3, t0);
    let now = dueDate(rec);
    const gaps: number[] = [];
    for (let i = 0; i < 4; i++) {
      const before = now;
      rec = applyReview(rec, 3, now);
      now = dueDate(rec);
      gaps.push(now.getTime() - before.getTime());
    }
    expect(gaps[3]).toBeGreaterThan(gaps[0]);
  });
});

describe('Warteschlange', () => {
  const t = new Date('2026-10-15T10:00:00');
  const exs = [ex({ id: 'a' }), ex({ id: 'b', cat: 'Matt übersehen' }), ex({ id: 'c' })];
  it('neue Aufgaben nach Tageskontingent', () => {
    const s = emptyState();
    s.settings.newPerDay = 2;
    expect(pickNext(exs, s, t)?.kind).toBe('new');
    expect(counts(exs, s, t)).toMatchObject({ newAvailable: 2, newTotal: 3, due: 0 });
  });
  it('fällig kommt vor neu, zuletzt gezeigte nicht sofort wieder', () => {
    const s = emptyState();
    s.cards.a = applyReview(undefined, 3, new Date(t.getTime() - 3 * 86400000));
    s.cards.a.card = { ...s.cards.a.card, due: new Date(t.getTime() - 1000).toISOString() };
    const next = pickNext(exs, s, t);
    expect(next).toMatchObject({ kind: 'due' });
    expect(next?.ex.id).toBe('a');
  });
  it('Lernschritt der nächsten Minuten wird vorgezogen, wenn sonst nichts fällig ist', () => {
    const s = emptyState();
    s.settings.newPerDay = 0;
    s.cards.a = applyReview(undefined, 1, t);
    expect(pickNext(exs, s, t)?.kind).toBe('learning');
  });
  it('Lernschritt wird nicht vorgezogen, solange neue Aufgaben verfügbar sind', () => {
    const s = emptyState();
    s.cards.a = applyReview(undefined, 1, t);
    expect(pickNext(exs, s, t)?.kind).toBe('new');
    // Ein Fehler kommt nicht gleich wieder (Kurzzeitgedächtnis), sondern frühestens nach zehn Minuten
    expect(pickNext(exs, s, new Date(t.getTime() + 2 * 60000))?.kind).toBe('new');
    expect(pickNext(exs, s, new Date(t.getTime() + 11 * 60000))?.kind).toBe('due');
  });
  it('auch ein Rückfall bei einer älteren Karte kommt erst nach zehn Minuten', () => {
    let rec = applyReview(undefined, 3, t);
    const later = new Date(t.getTime() + 10 * 86400000);
    rec = applyReview(rec, 1, later);
    expect(dueDate(rec).getTime() - later.getTime()).toBeGreaterThanOrEqual(10 * 60000);
    expect(dueDate(rec).getTime() - later.getTime()).toBeLessThan(30 * 60000);
  });
  it('richtig beim ersten Mal ist sofort gelernt und kommt erst nach Tagen wieder', () => {
    const rec = applyReview(undefined, 3, t);
    expect(dueDate(rec).getTime() - t.getTime()).toBeGreaterThan(12 * 3600000);
  });
  it('ohne Kontingent und ohne Fälliges gibt es nichts', () => {
    const s = emptyState();
    s.settings.newPerDay = 0;
    expect(pickNext(exs, s, t)).toBeNull();
  });
  it('Bonus erweitert das Kontingent nur am selben Tag', () => {
    const s = emptyState();
    s.settings.newPerDay = 1;
    s.bonus = { day: '2026-10-15', n: 5 };
    const many = Array.from({ length: 20 }, (_, i) => ex({ id: `q${i}` }));
    expect(counts(many, s, t).newAvailable).toBe(6);
    expect(counts(many, s, new Date('2026-10-16T09:00:00')).newAvailable).toBe(1);
  });
  it('ausgeblendete Aufgaben kommen nie vor', () => {
    const s = emptyState();
    s.hidden = { a: { on: true, ts: 1 }, c: { on: true, ts: 1 } };
    expect(pickNext(exs, s, t)?.ex.id).toBe('b');
    expect(counts(exs, s, t).total).toBe(1);
  });
  it('Filter wirken auf die Auswahl', () => {
    const s = emptyState();
    s.settings.filters.cat = 'Matt übersehen';
    expect(pickNext(exs, s, t)?.ex.id).toBe('b');
    expect(counts(exs, s, t).total).toBe(1);
  });
});

describe('Erklärung und Statistik', () => {
  it('Erklärung nennt Fehlerart, Motiv, Uhr und Maia', () => {
    const lines = explain(ex()).join(' ');
    expect(lines).toContain('Figur eingestellt');
    expect(lines).toContain('Der Gegner nutzt aus: Gabel');
    expect(lines).toContain('120 s');
    expect(lines).toContain('den besten Zug in etwa 40 %');
  });
  it('Motive: Matt-Drohung und übersehene Gewinnmotive getrennt', () => {
    expect(explain(ex({ cat: 'Matt übersehen', motifs: ['Matt in 2'] })).join(' ')).toContain('Der Gegner droht: Matt in 2.');
    const missed = explain(ex({ cat: 'Gegnerfehler nicht bestraft', motifs: [], missed: ['Hängende Figur'] })).join(' ');
    expect(missed).toContain('In der besten Fortsetzung steckt: Hängende Figur.');
    expect(missed).not.toContain('Der Gegner nutzt aus');
  });
  it('Richtwert nach Einstellung, wenn die Daten ihn kennen', () => {
    const e = ex({ maia: { me: 0.4, up: 0.6, cls: 'Leichtsinn', ok: 0.62, ok0: 0.41 } });
    expect(explain(e, true).join(' ')).toContain('einen richtigen Zug in etwa 62 %');
    expect(explain(e, false).join(' ')).toContain('einen richtigen Zug in etwa 41 %');
  });
  it('Trainingstage im Monat und Tagesleiste', () => {
    const now = new Date('2026-10-15T12:00:00');
    const mk = (d: string) => ({ id: 'a', ts: new Date(d).getTime(), grade: 3 as const, verdict: 'best' as const, ms: 1000, dur: 5000 });
    expect(trainingDays([mk('2026-10-15T08:00:00'), mk('2026-10-15T09:00:00'), mk('2026-10-14T08:00:00'), mk('2026-10-02T08:00:00'), mk('2026-09-30T08:00:00')], now)).toBe(3);
    expect(trainingDays([], now)).toBe(0);
    expect(lastDays([mk('2026-10-15T08:00:00')], 3, now).map((d) => d.n)).toEqual([0, 0, 1]);
  });
  it('Zeitumstellung: kein Tag doppelt oder ausgelassen', () => {
    const tz = process.env.TZ;
    process.env.TZ = 'Europe/Berlin'; // Sommerzeit ab 29.03.2026, Winterzeit ab 25.10.2026
    try {
      const mk = (d: string) => ({ id: 'a', ts: new Date(d).getTime(), grade: 3 as const, verdict: 'best' as const, ms: 1000, dur: 5000 });
      const lateEvening = new Date('2026-10-26T23:30:00');
      const keys = lastDays([], 14, lateEvening).map((d) => d.key);
      expect(new Set(keys).size).toBe(14);
      expect([keys[0], keys[13]]).toEqual(['2026-10-13', '2026-10-26']);
      // am 25.10. (Ende der Sommerzeit) hat der Tag 25 Stunden: Eintrag um 00:30 und um 23:30 zählen als ein Tag
      expect(trainingDays([mk('2026-10-25T00:30:00'), mk('2026-10-25T23:30:00'), mk('2026-10-26T20:00:00')], lateEvening)).toBe(2);
    } finally {
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    }
  });
});

describe('Zeitangaben', () => {
  it('nächste Wiederholung: Minuten, Stunden, dann Kalendertage', () => {
    const at = (iso: string) => new Date(iso);
    expect(inWords(at('2026-10-15T10:00:00'), at('2026-10-15T10:00:20'))).toBe('gleich');
    expect(inWords(at('2026-10-15T10:00:00'), at('2026-10-15T10:05:00'))).toBe('in 5 Min');
    expect(inWords(at('2026-10-15T10:00:00'), at('2026-10-15T15:00:00'))).toBe('in 5 Std');
    // abends 26 Stunden: übermorgen, nicht "morgen"
    expect(inWords(at('2026-10-15T23:00:00'), at('2026-10-17T01:00:00'))).toBe('in 2 Tagen');
    expect(inWords(at('2026-10-15T01:00:00'), at('2026-10-16T03:00:00'))).toBe('morgen');
    expect(inWords(at('2026-10-15T10:00:00'), at('2026-10-25T10:00:00'))).toBe('in 10 Tagen');
  });
  it('Partiedatum wird als Ortsdatum gelesen', () => {
    expect(dateLabel('2026-07-12')).toBe('12. Juli 2026');
  });
});
