// Friert die Basis der Uhr-Auswertung ein: dieselben Funktionen wie in der App (src/lib/gameStats.ts), angewandt auf die alten Partien
// aus data/games_raw.jsonl (nur lokal vorhanden, nicht im Repo). Schreibt public/data/uhr-basis.json (nur Kennzahlen, keine Partien, keine Namen).
// Aufruf: node tools/make-baseline.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Chess } from 'chessops/chess';
import { parseUci } from 'chessops/util';
import { makeSan } from 'chessops/san';

const root = resolve(new URL('..', import.meta.url).pathname);
const raw = resolve(root, '../data/games_raw.jsonl');
if (!existsSync(raw)) throw new Error('data/games_raw.jsonl fehlt (persönliche Rohdaten, siehe analysis/restore_data.sh)');

// die App-Funktionen bündeln
const tmp = mkdtempSync(join(tmpdir(), 'basis-'));
const entry = join(tmp, 'entry.ts');
writeFileSync(entry, `export { metricsOf, summarize, sd } from '${root}/src/lib/gameStats.ts';\nexport { materialTrack } from '${root}/src/lib/games.ts';\n`);
const bundle = join(tmp, 'lib.mjs');
execFileSync('npx', ['rolldown', entry, '--format', 'esm', '--platform', 'node', '--file', bundle], { cwd: root, stdio: 'ignore' });
const { metricsOf, summarize, sd, materialTrack } = await import(pathToFileURL(bundle).href);

const CUT = Date.parse('2026-10-15T00:00:00Z') / 1000; // Stichtag der Diagnose

function toRec(g) {
  const pos = Chess.default();
  const sans = [];
  const clk = [];
  for (const [uci, c] of g.moves) {
    const mv = parseUci(uci);
    if (!mv || !pos.isLegal(mv)) return null;
    sans.push(makeSan(pos, mv));
    pos.play(mv);
    if (typeof c !== 'number') return null;
    clk.push(c);
  }
  if (sans.length < 4) return null;
  const mat = materialTrack(sans) ?? [];
  return {
    id: `${g.platform}:${g.id}`, src: g.platform, url: g.url, end: g.end_ts * 1000, base: g.base, inc: g.inc ?? 0,
    color: g.color === 'white' ? 'w' : 'b', result: g.result === 1 ? 'w' : g.result === 0 ? 'l' : 'd',
    timeLoss: g.termination === 'timeout' && g.result === 0, timeWin: g.termination === 'timeout' && g.result === 1,
    sans, clk, mat,
  };
}

const games = readFileSync(raw, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((g) => g.end_ts < CUT && g.moves?.length);
const cc30 = games.filter((g) => g.platform === 'chesscom' && g.base === 180 && !g.inc).sort((a, b) => a.end_ts - b.end_ts);
const li10 = games.filter((g) => g.platform === 'lichess' && g.base === 60 && !g.inc).sort((a, b) => a.end_ts - b.end_ts);
const recs = (xs) => xs.map(toRec).filter(Boolean);
const num = (x, d = 1) => (x === null || x === undefined ? null : Math.round(x * 10 ** d) / 10 ** d);

function block(rs) {
  const ms = rs.map(metricsOf);
  const s = summarize(rs);
  const r30 = ms.filter((m) => m.before30 !== null);
  return {
    n: rs.length, reach30: s.reach30,
    own1629: { mean: num(s.own1629), sd: num(sd(ms.map((m) => m.own1629).filter((x) => x !== null))) },
    lead30: { mean: num(s.lead30), sd: num(sd(ms.map((m) => m.lead30).filter((x) => x !== null))) },
    lead20: { mean: num(s.lead20), sd: num(sd(ms.map((m) => m.lead20).filter((x) => x !== null))) },
    pauses: { mean: num(s.pauses, 2), sd: num(sd(r30.map((m) => m.pauses.length)), 2), opp: num(s.oppPauses, 2) },
    budget20: num(s.budget20, 0), budget30: num(s.budget30, 0),
    timeLosses: s.lostOnTime, losses: s.losses, lostOnTimeAhead: s.lostOnTimeAhead,
    brake: { fast: s.fast, bad: s.fastBad, per100: s.fast ? num((100 * s.fastBad) / s.fast, 2) : null },
  };
}

// Prüfung gegen die Diagnose (alle 3+0 seit 2025): Uhr vor Zug 20 und 30
const since2025 = recs(cc30.filter((g) => g.end_ts >= Date.parse('2025-01-01T00:00:00Z') / 1000));
const mean = (xs) => xs.reduce((a, x) => a + x, 0) / xs.length;
const check = {
  before20: num(mean(since2025.map(metricsOf).map((m) => m.before20).filter((x) => x !== null))),
  before30: num(mean(since2025.map(metricsOf).map((m) => m.before30).filter((x) => x !== null))),
  diagnose: { before20: 119.6, before30: 65.4 },
};

const last300 = recs(cc30.slice(-300));
const last600 = recs(li10.slice(-600));
// normaler Bereich: Monatswerte aller 3+0-Partien seit 2025 (Monate mit mindestens 30 Partien, die Zug 30 erreichen)
const byMonth = {};
for (const r of since2025) (byMonth[new Date(r.end).toISOString().slice(0, 7)] ??= []).push(r);
const months = Object.entries(byMonth)
  .map(([k, rs]) => ({ month: k, s: summarize(rs) }))
  .filter((x) => x.s.reach30 >= 30)
  .map((x) => ({ month: x.month, n: x.s.reach30, lead30: num(x.s.lead30), own1629: num(x.s.own1629), pauses: num(x.s.pauses, 2) }));
const range = (k) => ({ lo: Math.min(...months.map((m) => m[k])), hi: Math.max(...months.map((m) => m[k])) });

const out = {
  version: 1,
  note: 'Eingefrorene Basis der Uhr-Auswertung. Erzeugt mit tools/make-baseline.mjs aus den Partien vor dem 15.10.2026, mit denselben Funktionen wie die App.',
  cut: '2026-10-15',
  check,
  chesscom30: { ...block(last300), period: [new Date(last300[0].end).toISOString().slice(0, 10), new Date(last300.at(-1).end).toISOString().slice(0, 10)] },
  lichess10: { ...block(last600), period: [new Date(last600[0].end).toISOString().slice(0, 10), new Date(last600.at(-1).end).toISOString().slice(0, 10)] },
  monthly: { months, lead30: range('lead30'), own1629: range('own1629'), pauses: range('pauses') },
  /** Mindestmengen für ein Urteil */
  minGames: { chesscom30: 120, lichess10: 600 },
};
writeFileSync(resolve(root, 'public/data/uhr-basis.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ check, chesscom30: out.chesscom30, lichess10: { n: out.lichess10.n, lead20: out.lichess10.lead20, period: out.lichess10.period }, monthlyRange: { lead30: out.monthly.lead30, own1629: out.monthly.own1629, pauses: out.monthly.pauses }, months: months.length }, null, 1));
