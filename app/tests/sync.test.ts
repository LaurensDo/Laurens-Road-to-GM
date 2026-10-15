import { describe, expect, it } from 'vitest';
import { canonical, fromRemote, mergeStates, replay, toRemote } from '../src/lib/merge';
import { fetchRemote, fromBase64, makeSetupCode, parseSetupCode, syncOnce, SyncError, toBase64, verify, type SyncConfig } from '../src/lib/sync';
import { emptyState, type AppState, type Grade, type ReviewEntry } from '../src/lib/types';

const T0 = new Date('2026-10-15T10:00:00Z').getTime();
const entry = (id: string, minutes: number, grade: Grade = 3, dur = 5000): ReviewEntry => ({
  id,
  ts: T0 + minutes * 60000,
  grade,
  verdict: grade === 1 ? 'wrong' : 'best',
  ms: 3000,
  dur,
});
const stateWith = (log: ReviewEntry[], extra: Partial<AppState> = {}): AppState => {
  const s = emptyState();
  const sorted = [...log].sort((a, b) => a.ts - b.ts);
  return { ...s, log: sorted, cards: replay(sorted), ...extra };
};

// ---------------------------------------------------------------- Fake-GitHub
interface FakeOpts {
  token?: string;
  privateRepo?: boolean;
  push?: boolean;
  big?: boolean;
  beforePut?: (files: Map<string, { text: string; sha: string }>) => void;
}

function fakeGithub(opts: FakeOpts = {}) {
  const token = opts.token ?? 'tok';
  const files = new Map<string, { text: string; sha: string }>();
  let counter = 0;
  const calls: string[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const h = (init?.headers ?? {}) as Record<string, string>;
    calls.push(`${method} ${url.pathname}`);
    if (h.Authorization !== `Bearer ${token}`) return json(401, { message: 'Bad credentials' });
    const m = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(?:\/contents\/(.+))?$/);
    if (!m) return json(404, {});
    const [, owner, name, path] = m;
    if (`${owner}/${name}` !== 'me/sync') return json(404, { message: 'Not Found' });
    if (!path) return json(200, { private: opts.privateRepo ?? true, permissions: { push: opts.push ?? true } });
    const file = files.get(path);
    if (method === 'GET') {
      if (!file) return json(404, { message: 'Not Found' });
      if (h.Accept?.includes('raw')) return new Response(file.text, { status: 200 });
      if (opts.big) return json(200, { type: 'file', sha: file.sha, size: file.text.length, encoding: 'none', content: '' });
      const b64 = toBase64(file.text).replace(/(.{60})/g, '$1\n');
      return json(200, { type: 'file', sha: file.sha, size: file.text.length, encoding: 'base64', content: b64 });
    }
    if (method === 'PUT') {
      opts.beforePut?.(files);
      const body = JSON.parse(String(init?.body)) as { content: string; sha?: string };
      const cur = files.get(path);
      if (cur && !body.sha) return json(422, { message: "Invalid request. \"sha\" wasn't supplied." });
      if (cur && body.sha !== cur.sha) return json(409, { message: 'does not match' });
      const sha = `sha${++counter}`;
      files.set(path, { text: fromBase64(body.content), sha });
      return json(cur ? 200 : 201, { content: { sha } });
    }
    return json(405, {});
  };
  return { fetch: fetchFn, files, calls };
}

const cfg = (device = 'a', over: Partial<SyncConfig> = {}): SyncConfig => ({ repo: 'me/sync', token: 'tok', path: 'road-to-gm/state.json', device, ...over });
const device = (initial: AppState) => {
  let st = initial;
  return { io: { getState: () => st, setState: (s: AppState) => (st = s) }, get: () => st, set: (s: AppState) => (st = s) };
};

describe('Base64 und Einrichtungscode', () => {
  it('Umlaute und lange Texte bleiben erhalten', () => {
    const text = 'Größe: ä ö ü ß – ' + 'x'.repeat(200_000);
    expect(fromBase64(toBase64(text))).toBe(text);
  });
  it('Einrichtungscode lässt sich lesen und lehnt Unsinn ab', () => {
    const code = makeSetupCode({ repo: 'me/sync', token: 'github_pat_abc', path: 'road-to-gm/state.json' });
    expect(parseSetupCode(`  ${code}\n`)).toEqual({ repo: 'me/sync', token: 'github_pat_abc', path: 'road-to-gm/state.json' });
    expect(parseSetupCode('rtgm1.@@@')).toBeNull();
    expect(parseSetupCode('hallo')).toBeNull();
  });
});

describe('Zusammenführen', () => {
  const a = stateWith([entry('x', 0), entry('y', 5, 1)]);
  const b = stateWith([entry('x', 0), entry('z', 7)]);
  it('ist unabhängig von der Reihenfolge und ändert sich beim zweiten Mal nicht', () => {
    const ab = mergeStates(a, b);
    const ba = mergeStates(b, a);
    expect(canonical(toRemote(ab))).toBe(canonical(toRemote(ba)));
    expect(ab.cards).toEqual(ba.cards);
    expect(mergeStates(ab, b)).toEqual(ab);
    expect(ab.log.map((e) => e.id)).toEqual(['x', 'y', 'z']);
  });
  it('dieselbe Antwort doppelt zählt einmal, die längere Dauer gewinnt', () => {
    const m = mergeStates(stateWith([entry('x', 0, 3, 4000)]), stateWith([entry('x', 0, 3, 9000)]));
    expect(m.log).toHaveLength(1);
    expect(m.log[0].dur).toBe(9000);
  });
  it('Plan wird aus dem gemeinsamen Verlauf berechnet: falsch auf einem Gerät zählt', () => {
    const m = mergeStates(stateWith([entry('x', 0, 3), entry('x', 100, 3)]), stateWith([entry('x', 50, 1)]));
    expect(m.cards.x.reviews).toBe(3);
    expect(m.cards.x.lapses).toBe(1);
  });
  it('Zurücksetzen (neue Epoche) wirkt auf das andere Gerät', () => {
    const old = stateWith([entry('x', 0), entry('y', 5)]);
    const reset = { ...emptyState(), epoch: T0 + 10 * 60000 };
    const m = mergeStates(old, reset);
    expect(m.log).toHaveLength(0);
    expect(Object.keys(m.cards)).toHaveLength(0);
    // Antworten nach dem Zurücksetzen bleiben
    const newer = mergeStates(m, stateWith([entry('z', 20)]));
    expect(newer.log.map((e) => e.id)).toEqual(['z']);
  });
  it('Ausblenden und Einblenden: die jüngere Entscheidung gewinnt', () => {
    const x = { ...emptyState(), hidden: { a: { on: true, ts: 10 }, b: { on: true, ts: 5 } } };
    const y = { ...emptyState(), hidden: { a: { on: false, ts: 20 } } };
    const m = mergeStates(x, y);
    expect(m.hidden.a.on).toBe(false);
    expect(m.hidden.b.on).toBe(true);
  });
  it('Einstellungen: die zuletzt geänderten gelten', () => {
    const x = { ...emptyState(), settings: { ...emptyState().settings, timeLimit: 5 }, settingsTs: 10 };
    const y = { ...emptyState(), settings: { ...emptyState().settings, timeLimit: 20 }, settingsTs: 30 };
    expect(mergeStates(x, y).settings.timeLimit).toBe(20);
    expect(mergeStates(y, x).settings.timeLimit).toBe(20);
  });
});

describe('Sync-Datei lesen', () => {
  it('unbrauchbare Dateien werden abgelehnt', () => {
    expect(fromRemote(null)).toBeNull();
    expect(fromRemote({ app: 'andere' })).toBeNull();
    expect(fromRemote({ app: 'road-to-gm', schema: 1, log: [{ id: 5 }] })).toBeNull();
  });
});

describe('Abgleich über GitHub (Fake)', () => {
  it('erstes Gerät legt die Datei an, zweites übernimmt den Stand, dritter Lauf ändert nichts', async () => {
    const gh = fakeGithub();
    const A = device(stateWith([entry('x', 0), entry('y', 5)]));
    const r1 = await syncOnce(gh, cfg('iphone'), A.io, () => 1);
    expect(r1.pushed).toBe(true);
    expect(gh.files.get('road-to-gm/state.json')).toBeTruthy();

    const B = device(emptyState());
    const r2 = await syncOnce(gh, cfg('ipad'), B.io);
    expect(B.get().log.map((e) => e.id)).toEqual(['x', 'y']);
    expect(r2.pushed).toBe(false);

    const r3 = await syncOnce(gh, cfg('iphone'), A.io);
    expect(r3.pushed).toBe(false);
  });

  it('beide Geräte trainieren getrennt und gleichen danach ab: gleicher Stand auf beiden', async () => {
    const gh = fakeGithub();
    const A = device(stateWith([entry('x', 0)]));
    const B = device(stateWith([entry('y', 1)]));
    await syncOnce(gh, cfg('a'), A.io);
    await syncOnce(gh, cfg('b'), B.io);
    A.set(stateWith([...A.get().log, entry('z', 10, 1)]));
    await syncOnce(gh, cfg('a'), A.io);
    await syncOnce(gh, cfg('b'), B.io);
    await syncOnce(gh, cfg('a'), A.io);
    expect(canonical(toRemote(A.get()))).toBe(canonical(toRemote(B.get())));
    expect(A.get().log.map((e) => e.id)).toEqual(['x', 'y', 'z']);
    expect(A.get().cards).toEqual(B.get().cards);
  });

  it('Konflikt: ein anderes Gerät schreibt dazwischen, der Abgleich liest neu und führt zusammen', async () => {
    let injected = false;
    const gh = fakeGithub({
      beforePut: (files) => {
        if (injected || !files.has('road-to-gm/state.json')) return;
        injected = true;
        const other = stateWith([entry('fremd', 3)]);
        const cur = fromRemote(JSON.parse(files.get('road-to-gm/state.json')!.text))!;
        files.set('road-to-gm/state.json', { text: JSON.stringify(toRemote(mergeStates(cur, other))), sha: 'sha-fremd' });
      },
    });
    const A = device(stateWith([entry('x', 0)]));
    await syncOnce(gh, cfg('a'), A.io);
    A.set(stateWith([...A.get().log, entry('neu', 9)]));
    const r = await syncOnce(gh, cfg('a'), A.io);
    expect(r.pushed).toBe(true);
    expect(A.get().log.map((e) => e.id)).toEqual(['x', 'fremd', 'neu']);
    expect(JSON.parse(gh.files.get('road-to-gm/state.json')!.text).log).toHaveLength(3);
  });

  it('große Datei (über 1 MB) wird im Rohformat gelesen', async () => {
    const gh = fakeGithub({ big: true });
    const A = device(stateWith([entry('x', 0), entry('y', 1)]));
    await syncOnce(gh, cfg('a'), A.io);
    const { remote } = await fetchRemote(gh, cfg('b'));
    expect(remote?.log).toHaveLength(2);
    expect(gh.calls.some((c) => c.startsWith('GET /repos/me/sync/contents'))).toBe(true);
  });

  it('kaputte Datei im Repository wird nicht überschrieben', async () => {
    const gh = fakeGithub();
    gh.files.set('road-to-gm/state.json', { text: '{kaputt', sha: 's0' });
    const A = device(stateWith([entry('x', 0)]));
    await expect(syncOnce(gh, cfg('a'), A.io)).rejects.toMatchObject({ kind: 'format' });
    expect(gh.files.get('road-to-gm/state.json')!.text).toBe('{kaputt');
  });

  it('Zurücksetzen auf dem einen Gerät löscht den Verlauf auch auf dem anderen', async () => {
    const gh = fakeGithub();
    const A = device(stateWith([entry('x', 0), entry('y', 1)]));
    const B = device(emptyState());
    await syncOnce(gh, cfg('a'), A.io);
    await syncOnce(gh, cfg('b'), B.io);
    A.set({ ...emptyState(), epoch: T0 + 3600000 });
    await syncOnce(gh, cfg('a'), A.io);
    await syncOnce(gh, cfg('b'), B.io);
    expect(B.get().log).toHaveLength(0);
    expect(Object.keys(B.get().cards)).toHaveLength(0);
  });
});

describe('Verbinden prüfen', () => {
  const rejects = async (c: SyncConfig, o: FakeOpts, kind: string) => {
    await expect(verify(fakeGithub(o), c)).rejects.toBeInstanceOf(SyncError);
    await expect(verify(fakeGithub(o), c)).rejects.toMatchObject({ kind });
  };
  it('öffentliches Repository wird abgelehnt', () => rejects(cfg(), { privateRepo: false }, 'public'));
  it('falsches Token', () => rejects(cfg('a', { token: 'falsch' }), {}, 'auth'));
  it('unbekanntes Repository', () => rejects(cfg('a', { repo: 'me/anders' }), {}, 'notfound'));
  it('ungültige Schreibweise des Repositorys', () => rejects(cfg('a', { repo: 'nur-name' }), {}, 'notfound'));
  it('Token ohne Schreibrecht', () => rejects(cfg(), { push: false }, 'access'));
  it('privates Repository mit Schreibrecht ist in Ordnung', async () => {
    await expect(verify(fakeGithub(), cfg())).resolves.toBeUndefined();
  });
  it('kein Netz liefert eine verständliche Meldung', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(verify({ fetch: offline }, cfg())).rejects.toMatchObject({ kind: 'network' });
  });
});
