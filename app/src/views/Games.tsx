import { useEffect, useMemo, useRef } from 'preact/hooks';
import { Chessground } from 'chessground';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import { compare, compareRange, missing, PRELIM_MIN, WORD_TEXT, type BasisBlock, type UhrBasis, type Word } from '../lib/basis';
import { count, n0, n1, seconds } from '../lib/format';
import { fenAfter, tcOf, type GameRec } from '../lib/games';
import { fetchGamesNow, resetGames, useGames, useGamesStatus } from '../lib/gamesStore';
import { metricsOf, ownPly, summarize, type Metrics } from '../lib/gameStats';
import { ago } from './SyncCard';

const DAY = 86400000;

const isBlitz = (g: GameRec) => g.base >= 180;
const is30 = (g: GameRec) => g.base === 180 && g.inc === 0;
const isBullet = (g: GameRec) => g.base < 180;

function startOfDay(ts: number, back = 0): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
}

function whenLabel(end: number, now: number): string {
  const t = new Date(end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (end >= startOfDay(now)) return `heute ${t}`;
  if (end >= startOfDay(now, 1)) return `gestern ${t}`;
  return `${new Date(end).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })} ${t}`;
}

/** Kleines Brett (nur ansehen), zeigt die Stellung vor einem Zug */
function MiniBoard({ fen, white }: { fen: string; white: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const api = Chessground(el.current, {
      fen,
      orientation: white ? 'white' : 'black',
      viewOnly: true,
      coordinates: false,
      animation: { enabled: false },
      drawable: { enabled: false, visible: false },
    });
    return () => api.destroy();
  }, [fen, white]);
  return <div ref={el} class="miniboard board" role="img" aria-label="Stellung vor dem Zug" />;
}

function Marks({ m }: { m: Metrics }) {
  if (m.ok20 === null && m.ok30 === null) return null;
  const mark = (ok: boolean | null) => (ok === null ? '–' : ok ? '✓' : '○');
  return (
    <span class="g-marks mono" aria-label="Zeitbudget vor Zug 20 und vor Zug 30">
      <span>Zug 20 {mark(m.ok20)}</span>
      <span>Zug 30 {mark(m.ok30)}</span>
    </span>
  );
}

function GameRow({ g, now }: { g: GameRec; now: number }) {
  const m = metricsOf(g);
  const longest = m.pauses.reduce<Metrics['pauses'][number] | null>((a, p) => (!a || p.secs > a.secs ? p : a), null);
  const fen = longest ? fenAfter(g.sans, ownPly(g, longest.move)) : null;
  const result = g.result === 'w' ? 'Sieg' : g.result === 'l' ? 'Niederlage' : 'Remis';
  return (
    <li>
      <details class="g-row">
        <summary>
          <span class="g-when">{whenLabel(g.end, now)}</span>
          <span class="g-tc mono">{tcOf(g)}</span>
          <span class="g-res">{result}</span>
          <Marks m={m} />
        </summary>
        <div class="g-body">
          {m.before30 !== null && (
            <p class="muted small">
              Uhr vor Zug 30: <b class="mono">{seconds(m.before30 * 1000)}</b>
              {m.lead30 !== null && (
                <>
                  , {Math.abs(Math.round(m.lead30))} s {m.lead30 >= 0 ? 'vor' : 'hinter'} dem Gegner
                </>
              )}
              .
            </p>
          )}
          {g.timeLoss && <p class="muted small">Auf Zeit verloren{m.lostOnTimeAhead ? ', mit Mehrmaterial' : ''}.</p>}
          {longest ? (
            <div class="g-pause">
              {fen && <MiniBoard fen={fen} white={g.color === 'w'} />}
              <p>
                Längste Denkpause: Zug {longest.move}, <b class="mono">{n0(longest.secs)} s</b> für <b class="mono">{longest.san}</b>.
              </p>
            </div>
          ) : (
            <p class="muted small">Keine Denkpause über 10 s zwischen Zug 15 und 35.</p>
          )}
          <a class="small" href={g.url} target="_blank" rel="noopener noreferrer">
            Partie ansehen
          </a>
        </div>
      </details>
    </li>
  );
}

/** "Deine Partien" auf Heute: die Regel, was seit gestern los war und die letzten Partien. */
export function GamesCard({ regel }: { regel: string }) {
  const games = useGames();
  const st = useGamesStatus();
  const now = Date.now();
  const since = startOfDay(now, 1);
  const recent30 = games.filter((g) => is30(g) && g.end >= since);
  const recentBullet = games.filter((g) => isBullet(g) && g.end >= since);
  const lastBlitz = useMemo(() => games.filter(isBlitz).slice(-5).reverse(), [games]);

  const ms30 = recent30.map(metricsOf);
  const ok30 = ms30.filter((m) => m.ok30 === true).length;
  const have30 = ms30.filter((m) => m.ok30 !== null).length;
  const ahead30 = ms30.filter((m) => m.lostOnTimeAhead).length;
  const bullet = summarize(recentBullet);

  const parts30: string[] = [];
  if (have30) parts30.push(`Zug 30 im Budget: ${ok30} von ${have30}`);
  if (ahead30) parts30.push(`${ahead30}× auf Zeit verloren mit Mehrmaterial`);
  const partsB: string[] = [];
  if (bullet.lostOnTimeAhead) partsB.push(`${bullet.lostOnTimeAhead}× auf Zeit verloren mit Mehrmaterial`);
  if (bullet.lead20 !== null) partsB.push(`vor Zug 20 im Schnitt ${Math.abs(Math.round(bullet.lead20))} s ${bullet.lead20 >= 0 ? 'vor' : 'hinter'} deinen Gegnern`);

  return (
    <div class="card focus">
      <h2>Deine Partien</h2>
      <p class="regel">
        <b>Regel:</b> {regel}
      </p>

      {games.length === 0 ? (
        <p class="muted">
          {st.state === 'loading' ? 'Hole deine Partien …' : st.state === 'error' ? st.message : st.state === 'offline' ? st.message : 'Seit dem 15.10. noch keine Partie geholt.'}
        </p>
      ) : (
        <>
          <p>
            <b class="mono">3+0</b> seit gestern: {count(recent30.length, 'Partie', 'Partien')}
            {parts30.length > 0 && <span class="muted"> · {parts30.join(' · ')}</span>}
          </p>
          {recentBullet.length > 0 && (
            <p>
              <b class="mono">Bullet</b> seit gestern: {count(recentBullet.length, 'Partie', 'Partien')}
              {partsB.length > 0 && <span class="muted"> · {partsB.join(' · ')}</span>}
            </p>
          )}
          {lastBlitz.length > 0 && (
            <>
              <ul class="g-list">
                {lastBlitz.map((g) => (
                  <GameRow key={g.id} g={g} now={now} />
                ))}
              </ul>
              <p class="muted small">✓ Uhr im Budget (vor Zug 20: 2:00, vor Zug 30: 1:20) · ○ darunter · – Partie war vorher zu Ende. Antippen für Details.</p>
            </>
          )}
        </>
      )}

      <div class="g-foot">
        <span class="muted small">
          {st.state === 'loading' ? 'Hole …' : st.state === 'error' ? 'Abruf fehlgeschlagen' : st.state === 'offline' ? 'Offline' : st.last ? `Geholt ${ago(st.last)}` : 'Noch nicht geholt'}
        </span>
        <button class="link inline" onClick={() => void fetchGamesNow(true)} disabled={st.state === 'loading'}>
          Jetzt holen
        </button>
      </div>
      {st.state === 'error' && games.length > 0 && <p class="muted small">{st.message}</p>}
    </div>
  );
}

// ---- Fortschritt: Uhr in den Partien

function Row({ label, now, base, note }: { label: string; now: string; base?: string; note?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd class="mono">
        {now}
        {base && <span class="muted"> · Basis {base}</span>}
      </dd>
      {note && <dd class="muted small note">{note}</dd>}
    </div>
  );
}

const sgn = (x: number) => `${x < 0 ? '−' : x > 0 ? '+' : ''}${n1(Math.abs(x))} s`;

function WordChip({ w }: { w: Word | null }) {
  if (!w) return null;
  return <span class={`chip ${w === 'better' ? 'good' : w === 'worse' ? 'warn' : ''}`}>{WORD_TEXT[w]}</span>;
}

function RollingChart({ values, lo, hi, base }: { values: number[]; lo: number; hi: number; base: number }) {
  const W = 320;
  const H = 110;
  const all = [...values, lo, hi, base];
  const min = Math.min(...all) - 5;
  const max = Math.max(...all) + 5;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const x = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * W : W / 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="chart" role="img" aria-label="Eigene Zeit von Zug 16 bis 29, laufender Durchschnitt">
      <rect x="0" y={y(hi)} width={W} height={Math.max(2, y(lo) - y(hi))} class="band" />
      <line x1="0" x2={W} y1={y(base)} y2={y(base)} class="grid" />
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} class="line" fill="none" />
    </svg>
  );
}

/** "Uhr in deinen Partien" unter Fortschritt: eigene Werte neben der eingefrorenen Basis, Urteil erst ab genug Partien. */
export function ClockCard({ basis }: { basis: UhrBasis | null }) {
  const games = useGames();
  const st = useGamesStatus();
  const g30 = useMemo(() => games.filter(is30), [games]);
  const gB = useMemo(() => games.filter((g) => g.src === 'lichess' && g.base === 60 && g.inc === 0), [games]);
  const s = useMemo(() => summarize(g30), [g30]);
  const sb = useMemo(() => summarize(gB), [gB]);
  const b: BasisBlock | null = basis?.chesscom30 ?? null;
  const min30 = basis?.minGames.chesscom30 ?? 120;
  const minB = basis?.minGames.lichess10 ?? 600;
  const ready = s.reach30 >= min30;
  const prelim = !ready && s.reach30 >= PRELIM_MIN;
  const ms = useMemo(() => g30.map(metricsOf), [g30]);

  // laufender Durchschnitt der eigenen Zeit von Zug 16 bis 29 über die letzten 20 Partien
  const series = useMemo(() => {
    const vals = ms.map((m) => m.own1629).filter((x): x is number => x !== null);
    return vals.map((_, i) => {
      const w = vals.slice(Math.max(0, i - 19), i + 1);
      return w.reduce((a, x) => a + x, 0) / w.length;
    });
  }, [ms]);

  // ab der Mindestmenge: Zufallsbereich der Stichproben; davor (ab PRELIM_MIN) vorläufig am Bereich der Monatswerte
  const verdict = (v: number | null, base: Parameters<typeof compare>[2], range: { lo: number; hi: number } | undefined, lowerIsBetter: boolean): Word | null => {
    if (v === null || !b) return null;
    if (ready) return compare(v, s.reach30, base, b.reach30, lowerIsBetter);
    return prelim && range ? compareRange(v, range, lowerIsBetter) : null;
  };
  const w1629 = verdict(s.own1629, b?.own1629 ?? { mean: null, sd: null }, basis?.monthly.own1629, true);
  const wPause = verdict(s.pauses, b ? { mean: b.pauses.mean, sd: b.pauses.sd } : { mean: null, sd: null }, basis?.monthly.pauses, true);
  const wLead = verdict(s.lead30, b?.lead30 ?? { mean: null, sd: null }, basis?.monthly.lead30, false);
  const brakeRate = s.fast ? (100 * s.fastBad) / s.fast : null;
  const brakeUp = brakeRate !== null && b?.brake.per100 != null && s.n >= 150 && brakeRate > b.brake.per100 * 1.5;

  return (
    <div class="card">
      <h2>Uhr in deinen Partien</h2>
      <p class="muted">
        3+0 seit dem 15.10.: {count(s.n, 'Partie', 'Partien')}, davon {n0(s.reach30)} mit Uhr vor Zug 30.{' '}
        {ready
          ? ''
          : prelim
            ? `Vorläufig: Die Urteile messen sich am Bereich deiner Monatswerte. Noch ${n0(missing(s.reach30, min30))} bis zur gesicherten Aussage.`
            : `Noch ${n0(missing(s.reach30, PRELIM_MIN))} bis zum vorläufigen Urteil, ${n0(missing(s.reach30, min30))} bis zur gesicherten Aussage.`}
      </p>
      {s.reach30 > 0 && b ? (
        <>
          <dl class="facts two">
            <Row label="Eigene Zeit von Zug 16 bis 29" now={s.own1629 !== null ? `${n0(s.own1629)} s` : '–'} base={b.own1629.mean !== null ? `${n0(b.own1629.mean)} s` : undefined} />
            <Row
              label="Vorsprung vor Zug 30 (Gegner)"
              now={s.lead30 !== null ? sgn(s.lead30) : '–'}
              base={b.lead30.mean !== null ? sgn(b.lead30.mean) : undefined}
              note={basis ? `Deine Monate lagen zwischen ${sgn(basis.monthly.lead30.lo)} und ${sgn(basis.monthly.lead30.hi)}.` : undefined}
            />
            <Row label="Denkpausen über 10 s je Partie" now={s.pauses !== null ? n1(s.pauses) : '–'} base={b.pauses.mean !== null ? n1(b.pauses.mean) : undefined} note={b.pauses.opp !== null ? `Deine Gegner: ${n1(b.pauses.opp)}` : undefined} />
            <Row label="Zug 20 im Budget (2:00)" now={s.budget20 !== null ? `${n0(s.budget20)} %` : '–'} base={b.budget20 !== null ? `${n0(b.budget20)} %` : undefined} />
            <Row label="Zug 30 im Budget (1:20)" now={s.budget30 !== null ? `${n0(s.budget30)} %` : '–'} base={b.budget30 !== null ? `${n0(b.budget30)} %` : undefined} />
          </dl>
          {(ready || prelim) && (
            <p class="verdicts">
              <span>
                Eigene Zeit: <WordChip w={w1629} />
              </span>
              <span>
                Denkpausen: <WordChip w={wPause} />
              </span>
              <span>
                Vorsprung: <WordChip w={wLead} />
              </span>
            </p>
          )}
          {brakeRate !== null && s.n >= 150 && (
            <p class="muted small">
              Materialverlust nach schnellen Zügen: {n1(brakeRate)} je 100 {brakeUp ? '(gestiegen: Tempo geht auf Kosten der Qualität)' : '(unverändert)'}.
            </p>
          )}
        </>
      ) : (
        <p class="muted">{st.state === 'loading' ? 'Hole deine Partien …' : 'Sobald Partien in 3+0 geholt sind, erscheinen hier deine Werte.'}</p>
      )}
      {series.length >= 10 && b && basis && b.own1629.mean !== null && (
        <>
          <RollingChart values={series} lo={basis.monthly.own1629.lo} hi={basis.monthly.own1629.hi} base={b.own1629.mean} />
          <p class="muted small">Eigene Zeit von Zug 16 bis 29, Durchschnitt der letzten 20 Partien. Der Streifen zeigt, was in deinen Monaten normal war.</p>
        </>
      )}

      {basis && (
        <div class="bullet-box">
          <h3>Bullet (lichess 1+0)</h3>
          <p class="muted">
            Seit dem 15.10.: {count(sb.n, 'Partie', 'Partien')}.{' '}
            {sb.n >= minB ? '' : `Noch ${n0(missing(sb.n, minB))} bis zur ersten Aussage.`}
            {sb.lead20 !== null && (
              <>
                {' '}
                Vor Zug 20 im Schnitt {sgn(sb.lead20)} gegenüber dem Gegner (Basis {sgn(basis.lichess10.lead20.mean ?? 0)}).
              </>
            )}
          </p>
        </div>
      )}
      <p class="muted small">
        „Uhr vor Zug N“ ist die Restzeit nach deinem Zug N−1. Basis: deine letzten {n0(b?.n ?? 0)} Partien in 3+0 vor dem 15.10. Ein Urteil gibt es erst ab {n0(min30)} Partien, und der normale Bereich ist das, was der
        Zufall bei dieser Zahl von Partien erklärt.
      </p>
      <div class="g-foot">
        <span class="muted small">Die Partien liegen nur auf diesem Gerät.</span>
        <button class="link inline" onClick={() => void resetGames()} disabled={st.state === 'loading'}>
          Neu holen
        </button>
      </div>
    </div>
  );
}
