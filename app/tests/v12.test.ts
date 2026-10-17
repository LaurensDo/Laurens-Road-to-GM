import { describe, expect, it } from 'vitest';
import { splitHoldout } from '../src/lib/data';
import { canonical, fromRemote, mergeStates, replay, toRemote } from '../src/lib/merge';
import { BACKLOG_NEW, COMEBACK_CARDS, COMEBACK_DAYS, counts, DUE_CAP, daysAway, pickNext, reviewedToday } from '../src/lib/queue';
import { usageReport } from '../src/lib/report';
import { applyReview, retrievability } from '../src/lib/srs';
import { isNewer } from '../src/lib/updater';
import { expectedOf, firstTries, skillStat } from '../src/lib/skill';
import { compareVersions, READER_LEVEL } from '../src/lib/version';
import { emptyState, type AppState, type Exercise, type Grade, type ReviewEntry } from '../src/lib/types';

const ex = (id: string, over: Partial<Exercise> = {}): Exercise => ({
  id,
  fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  turn: 'w',
  phase: 'Mittelspiel',
  cat: 'Figur eingestellt',
  motifs: [],
  themes: [],
  lines: [{ san: 'Nf3', uci: 'g1f3', wp: 55, cp: 20, pv: ['Nf3'] }],
  played: { san: 'Qh5', uci: 'd1h5', wp: 30, cp: -50 },
  loss: 25,
  clock: 120,
  spent: 3,
  date: '2026-10-01',
  url: 'https://example.org/g',
  src: 'lichess',
  maia: { me: 0.5, up: 0.7, cls: 'Leichtsinn' },
  ...over,
});

const NOW = new Date('2026-10-17T12:00:00');
const DAYMS = 86400000;
const entry = (id: string, ts: number, grade: Grade = 3, extra: Partial<ReviewEntry> = {}): ReviewEntry => ({
  id,
  ts,
  grade,
  verdict: grade === 1 ? 'wrong' : 'best',
  ms: 3000,
  dur: 5000,
  ...extra,
});

/** Stand, in dem die Übungen vor `daysAgo` Tagen einmal richtig beantwortet wurden (heute fällig). */
function stateWithOldCards(ids: string[], daysAgo: number, extra: Partial<AppState> = {}): AppState {
  const t = NOW.getTime() - daysAgo * DAYMS;
  const log = ids.map((id) => entry(id, t));
  return { ...emptyState(), log, cards: replay(log), ...extra };
}

describe('Prüfsatz', () => {
  it('bleibt aus dem Training, ist aber weiter bekannt', () => {
    const all = [ex('a'), ex('b', { hold: true }), ex('c')];
    const { train, holdout } = splitHoldout(all);
    expect(train.map((e) => e.id)).toEqual(['a', 'c']);
    expect(holdout.map((e) => e.id)).toEqual(['b']);
  });
});

describe('Wiedereinstieg und Rückstand', () => {
  const ids = Array.from({ length: 100 }, (_, i) => `k${String(i).padStart(3, '0')}`);
  const exs = ids.map((id) => ex(id));
  const fresh = Array.from({ length: 40 }, (_, i) => ex(`n${i}`));

  it('ohne Rückstand kommt alles Fällige', () => {
    const st = stateWithOldCards(ids.slice(0, 10), 60);
    const c = counts([...exs, ...fresh], st, NOW);
    expect(c.due).toBe(10);
    expect(c.waiting).toBe(0);
    expect(c.backlogDays).toBe(0);
    expect(c.newAvailable).toBe(15);
  });

  it('im Rückstand höchstens DUE_CAP pro Tag und nur BACKLOG_NEW neue Aufgaben', () => {
    const st = stateWithOldCards(ids, 60);
    const c = counts([...exs, ...fresh], st, NOW);
    expect(c.due).toBe(DUE_CAP);
    expect(c.waiting).toBe(100 - DUE_CAP);
    expect(c.backlogDays).toBe(Math.ceil(100 / DUE_CAP));
    expect(c.newAvailable).toBe(BACKLOG_NEW);
  });

  it('der Deckel hält über den Tag: nach 30 Wiederholungen kommt nur noch Neues, dann nichts', () => {
    let st = stateWithOldCards(ids, 60);
    const all = [...exs, ...fresh];
    const seen = new Set<string>();
    // 30 Wiederholungen heute, jeweils richtig beantwortet
    for (let i = 0; i < DUE_CAP; i++) {
      const p = pickNext(all, st, NOW, undefined, seen)!;
      expect(p.kind).toBe('due');
      seen.add(p.ex.id);
      const log = [...st.log, entry(p.ex.id, NOW.getTime() + i * 1000)];
      st = { ...st, log, cards: { ...st.cards, [p.ex.id]: applyReview(st.cards[p.ex.id], 3, new Date(NOW.getTime() + i * 1000)) } };
    }
    expect(reviewedToday(st, NOW)).toBe(DUE_CAP);
    const after = new Date(NOW.getTime() + 60 * 60 * 1000);
    const next = pickNext(all, st, after, undefined, seen)!;
    expect(next.kind).toBe('new');
    expect(counts(all, st, after).due).toBe(0);
  });

  it('nach vier Tagen Pause kommen zuerst die sichersten Karten', () => {
    // alte Karten, verschieden lange her: Je länger her, desto weniger sicher
    const log = [
      entry('k000', NOW.getTime() - 90 * DAYMS),
      entry('k001', NOW.getTime() - 20 * DAYMS),
      entry('k002', NOW.getTime() - 50 * DAYMS),
    ];
    const st: AppState = { ...emptyState(), log, cards: replay(log) };
    expect(daysAway(st, NOW)).toBe(20);
    const r = (id: string) => retrievability(st.cards[id], NOW);
    expect(r('k001')).toBeGreaterThan(r('k002'));
    expect(r('k002')).toBeGreaterThan(r('k000'));
    const first = pickNext(exs.slice(0, 3), st, NOW)!;
    expect(first.ex.id).toBe('k001');
  });

  it('ohne lange Pause bleibt die Reihenfolge nach Fälligkeit (älteste zuerst)', () => {
    const log = [entry('k000', NOW.getTime() - 3 * DAYMS - 90 * DAYMS), entry('k001', NOW.getTime() - 20 * DAYMS)];
    // letzter Eintrag gestern: keine Pause
    const st: AppState = { ...emptyState(), log: [...log, entry('k050', NOW.getTime() - DAYMS)], cards: replay([...log, entry('k050', NOW.getTime() - DAYMS)]) };
    expect(daysAway(st, NOW)).toBe(1);
    expect(pickNext(exs.slice(0, 2), st, NOW)!.ex.id).toBe('k000');
  });

  it('Wiedereinstieg gilt nur für die ersten Antworten des Tages', () => {
    const log = [entry('k000', NOW.getTime() - 90 * DAYMS), entry('k001', NOW.getTime() - 20 * DAYMS)];
    const today = Array.from({ length: COMEBACK_CARDS }, (_, i) => entry('x' + i, NOW.getTime() - 1000 * (i + 1)));
    const st: AppState = { ...emptyState(), log: [...log, ...today], cards: replay(log) };
    // heute schon fünf Antworten: wieder nach Fälligkeit, also k000 zuerst
    expect(pickNext(exs.slice(0, 2), st, NOW)!.ex.id).toBe('k000');
    expect(COMEBACK_DAYS).toBe(4);
  });
});

describe('Dateiformat 1.2', () => {
  const base = (over: Partial<AppState> = {}): AppState => ({ ...emptyState(), ...over });

  it('Unbekannte Felder oben in der Datei bleiben erhalten und werden wieder geschrieben', () => {
    const raw = { ...toRemote(base()), zukunft: { a: 1 }, snap: { grenze: 5 } };
    const s = fromRemote(raw)!;
    expect(s.ext).toEqual({ zukunft: { a: 1 }, snap: { grenze: 5 } });
    const back = toRemote(s) as unknown as Record<string, unknown>;
    expect(back.zukunft).toEqual({ a: 1 });
    expect(back.snap).toEqual({ grenze: 5 });
    // beim Zusammenführen gehen sie ebenfalls nicht verloren, in beiden Richtungen gleich
    const other = base({ ext: { weiteres: true } });
    const m1 = mergeStates(s, other);
    const m2 = mergeStates(other, s);
    expect(Object.keys(m1.ext).sort()).toEqual(['snap', 'weiteres', 'zukunft']);
    expect(canonical(toRemote(m1))).toBe(canonical(toRemote(m2)));
  });

  it('Eine Datei, die eine neuere Lese-Stufe braucht, wird nicht gelesen', () => {
    expect(fromRemote({ ...toRemote(base()), minReader: READER_LEVEL + 1 })).toBeNull();
    expect(fromRemote({ ...toRemote(base()), minReader: READER_LEVEL })).not.toBeNull();
  });

  it('Dateien aus Version 1.1 (ohne minReader, devices, epochTs) lassen sich lesen', () => {
    const old = { app: 'road-to-gm', schema: 1, epoch: 5, log: [], hidden: {}, settings: {}, settingsTs: 0 };
    const s = fromRemote(old)!;
    expect(s.epoch).toBe(5);
    expect(s.epochTs).toBe(5);
    expect(s.devices).toEqual({});
  });

  it('Neue Antwortarten bleiben im Verlauf, zählen aber nicht in den Wiederholungsplan', () => {
    const log = [entry('a', 1000), entry('a', 2000, 1, { kind: 'ruhig' }), entry('b', 3000, 3, { kind: 'mark' })];
    const cards = replay(log);
    expect(cards.a.reviews).toBe(1);
    expect(cards.b).toBeUndefined();
    const s = fromRemote({ ...toRemote(base({ log })) })!;
    expect(s.log).toHaveLength(3);
    // eine Antwortart ohne Note (spätere Version) macht die Datei nicht unlesbar
    const noGrade = { ...toRemote(base()), log: [{ id: 'z', ts: 1, kind: 'run', ms: 0, dur: 0, verdict: 'best' }] };
    expect(fromRemote(noGrade)).not.toBeNull();
  });

  it('lim und dv an der Antwort überstehen Hin- und Rückschreiben', () => {
    const log = [entry('a', 1000, 3, { lim: 10, dv: 1 })];
    const s = fromRemote(JSON.parse(JSON.stringify(toRemote(base({ log })))))!;
    expect(s.log[0]).toMatchObject({ lim: 10, dv: 1 });
  });

  it('Geräteliste: je Gerät gewinnt der jüngere Eintrag', () => {
    const a = base({ devices: { x: { v: '1.1.0', ts: 10 }, y: { v: '1.2.0', ts: 5 } } });
    const b = base({ devices: { x: { v: '1.2.0', ts: 20 } } });
    const m = mergeStates(a, b);
    expect(m.devices.x).toEqual({ v: '1.2.0', ts: 20 });
    expect(m.devices.y.v).toBe('1.2.0');
  });

  it('Eine von 1.2 geschriebene Datei bleibt für Geräte mit Version 1.1 lesbar', () => {
    // Nachbau der Prüfung in Version 1.1: schema muss 1 sein, jede Antwort braucht eine Note von 1 bis 3
    const legacyReadable = (raw: Record<string, unknown>) =>
      raw.app === 'road-to-gm' &&
      raw.schema === 1 &&
      Array.isArray(raw.log) &&
      (raw.log as ReviewEntry[]).every((e) => typeof e.id === 'string' && typeof e.ts === 'number' && [1, 2, 3].includes(e.grade));
    const log = [entry('a', 1000, 3, { lim: 10, dv: 1, set: { id: 's', n: 5 } })];
    const file = JSON.parse(JSON.stringify(toRemote({ ...emptyState(), log, devices: { x: { v: '1.2.0', ts: 1 } } })));
    expect(legacyReadable(file)).toBe(true);
    expect(file.log[0]).toMatchObject({ lim: 10, dv: 1, set: { id: 's', n: 5 } });
  });

  it('Versionen werden zahlenweise verglichen', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.2.0', '1.2')).toBe(0);
    expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
  });
});

describe('Update-Weg', () => {
  it('erkennt eine neuere Version am Zeitstempel', () => {
    expect(isNewer({ build: '2026-10-17T10:00:00.000Z' }, '2026-10-16T10:00:00.000Z')).toBe(true);
    expect(isNewer({ build: '2026-10-16T10:00:00.000Z' }, '2026-10-16T10:00:00.000Z')).toBe(false);
    expect(isNewer({ build: '2026-10-15T10:00:00.000Z' }, '2026-10-16T10:00:00.000Z')).toBe(false);
    expect(isNewer(null, '2026-10-16T10:00:00.000Z')).toBe(false);
  });
});

describe('Auswertung für Claude', () => {
  it('fasst Nutzung zusammen, ohne Partien oder Namen', () => {
    const t = (d: string) => new Date(d).getTime();
    const log = [
      entry('a', t('2026-10-12T10:00:00'), 3, { set: { id: 's1', n: 2 } }),
      entry('b', t('2026-10-12T10:01:00'), 1, { set: { id: 's1', n: 2 } }),
      entry('c', t('2026-10-12T10:03:00'), 3, { set: { id: 's2', n: 2 } }),
      entry('a', t('2026-10-17T09:00:00'), 3),
    ];
    const cards = replay(log);
    cards.b = { ...cards.b, lapses: 3 };
    const st: AppState = { ...emptyState(), log, cards, devices: { 'iPad-x': { v: '1.2.0', ts: t('2026-10-17T09:00:00') } } };
    const byId = new Map([['b', ex('b', { cat: 'Matt übersehen' })]]);
    const r = usageReport(st, {
      now: NOW,
      appVersion: '1.2.0',
      build: 'x',
      dataVersion: 1,
      holdoutIds: ['c', 'zz'],
      byId,
      queue: { due: 3, learning: 0, newAvailable: 15, newTotal: 100, total: 200, waiting: 0, backlogDays: 0 },
    });
    expect(r.trainingstageProWoche.at(-1)).toEqual({ von: '2026-10-12', tage: 2 });
    expect(r.saetze30Tage).toMatchObject({ gesamt: 2, fertig: 1, abgebrochen: 1 });
    expect(r.pruefsatz).toEqual({ groesse: 2, schonGesehen: ['c'] });
    expect(r.dauerbrenner).toEqual([{ id: 'b', fehlversuche: 3, antworten: 1, art: 'Matt übersehen' }]);
    expect(r.pausen).toEqual([{ tage: 5, trainingstageInDenErsten3Tagen: 1 }]);
    expect(JSON.stringify(r)).not.toMatch(/opp_name|https?:/);
  });
});

describe('Erstversuch-Quote', () => {
  const e = (id: string, ok: number, cls = 'Leichtsinn') => ex(id, { maia: { me: 0.3, up: 0.5, cls, ok, ok0: ok - 0.1 } });
  const exs = Array.from({ length: 60 }, (_, i) => e('s' + i, 0.5));
  const byId = new Map(exs.map((x) => [x.id, x]));
  const log = (okFrom: number) => exs.map((x, i) => entry(x.id, 1000 + i, i < okFrom ? 3 : 1));

  it('nur der erste Versuch zählt, spätere nicht', () => {
    const l = [entry('s0', 1000, 1), entry('s0', 2000, 3), entry('s1', 3000, 3)];
    const t = firstTries(l, byId, true);
    expect(t.map((x) => [x.id, x.ok])).toEqual([['s0', false], ['s1', true]]);
  });
  it('erst ab 20 Versuchen ein Urteil', () => {
    expect(skillStat(firstTries(log(10).slice(0, 19), byId, true))).toBeNull();
    expect(skillStat(firstTries(log(10).slice(0, 20), byId, true))).not.toBeNull();
  });
  it('Richtwert und normaler Bereich: Schwankung um den Richtwert ist "im Bereich", Ausreißer nicht', () => {
    const mid = skillStat(firstTries(log(30), byId, true))!; // 30 von 60 = 50 %, Richtwert 50 %
    expect(mid.word).toBe('inside');
    expect(mid.expected).toBeCloseTo(50, 5);
    expect(mid.lo).toBeLessThan(50);
    expect(mid.hi).toBeGreaterThan(50);
    expect(skillStat(firstTries(log(55), byId, true))!.word).toBe('over');
    expect(skillStat(firstTries(log(5), byId, true))!.word).toBe('under');
  });
  it('die Einstellung wählt den Richtwert (ok oder ok0)', () => {
    const t = skillStat(firstTries(log(30), byId, false))!;
    expect(t.expected).toBeCloseTo(40, 5);
  });
  it('ohne Richtwert in den Daten fällt er auf p_best zurück, ganz ohne bleibt es leer', () => {
    const old = ex('o', { maia: { me: 0.25, up: null, cls: null } });
    expect(expectedOf(old, true)).toBe(0.25);
    expect(expectedOf(ex('n', { maia: { me: null, up: null, cls: null } }), true)).toBeNull();
  });
});
