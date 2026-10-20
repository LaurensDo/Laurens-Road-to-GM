import { useMemo } from 'preact/hooks';
import { count, dayKey, dayLabel, n0, n1, pct } from '../lib/format';
import { breakdown, cardCounts, correct, lastDays, today, trainingDays, windowStats } from '../lib/stats';
import { listSets, rateOf } from '../lib/sets';
import { MIN_TRIES, SKILL_TEXT, firstTries, skillStat, type SkillStat } from '../lib/skill';
import type { UhrBasis } from '../lib/basis';
import { ClockCard } from './Games';
import { useAppState } from '../lib/store';
import type { Exercise, Meta } from '../lib/types';

interface Props {
  exercises: Exercise[];
  byId: Map<string, Exercise>;
  meta: Meta | null;
  basis: UhrBasis | null;
}

function Bars({ days }: { days: ReturnType<typeof lastDays> }) {
  const max = Math.max(5, ...days.map((d) => d.n));
  const W = 320;
  const H = 120;
  const bw = W / days.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label="Aufgaben pro Tag in den letzten 14 Tagen" class="chart">
      {[0.5, 1].map((f) => (
        <line key={f} x1="0" x2={W} y1={H - f * H} y2={H - f * H} class="grid" />
      ))}
      {days.map((d, i) => {
        const h = (d.n / max) * (H - 6);
        const wrong = d.n - d.right;
        const hw = (wrong / max) * (H - 6);
        return (
          <g key={d.key}>
            <rect x={i * bw + 3} y={H - h} width={bw - 6} height={h - hw} rx="3" class="bar-right" />
            {wrong > 0 && <rect x={i * bw + 3} y={H - hw} width={bw - 6} height={hw} rx="3" class="bar-wrong" />}
            {d.n > 0 && (
              <text x={i * bw + bw / 2} y={H - h - 4} text-anchor="middle" class="val">
                {d.n}
              </text>
            )}
            {(i === 0 || i === days.length - 1 || i === 7) && (
              <text x={i * bw + bw / 2} y={H + 14} text-anchor="middle" class="lbl">
                {dayLabel(d.key)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function SetBars({ rates }: { rates: number[] }) {
  const W = 320;
  const H = 90;
  const bw = W / Math.max(rates.length, 10);
  return (
    <svg viewBox={`0 0 ${W} ${H + 6}`} role="img" aria-label="Quote der letzten Sätze" class="chart">
      {[0.5, 1].map((f) => (
        <line key={f} x1="0" x2={W} y1={H - f * H} y2={H - f * H} class="grid" />
      ))}
      {rates.map((r, i) => (
        <g key={i}>
          <rect x={i * bw + 3} y={H - (r / 100) * H} width={bw - 6} height={(r / 100) * H} rx="3" class="bar-right" />
          <text x={i * bw + bw / 2} y={H - (r / 100) * H - 3} text-anchor="middle" class="val">
            {Math.round(r)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function SkillRow({ label, s }: { label?: string; s: SkillStat }) {
  return (
    <div class="skill-row">
      <div class="verdict-row">
        <span class="mono skill-rate">{pct(s.rate)}</span>
        <span class={`chip ${s.word === 'over' ? 'good' : s.word === 'under' ? 'warn' : ''}`}>{SKILL_TEXT[s.word]}</span>
      </div>
      <p class="muted small">
        {label ? `${label}: ` : ''}letzte {n0(s.n)} neue Aufgaben. Richtwert für Spieler deiner Stärke {pct(s.expected)}, normaler Bereich {n0(s.lo)} bis {n0(s.hi)} %.
      </p>
    </div>
  );
}

function Table({ rows }: { rows: ReturnType<typeof breakdown> }) {
  if (!rows.length) return <p class="muted">Noch keine Daten.</p>;
  return (
    <div class="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Gruppe</th>
            <th class="n">Aufgaben</th>
            <th class="n">Richtig</th>
            <th class="n">Ø Zeit</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td class="n mono">{n0(r.n)}</td>
              <td class="n mono">{pct(r.rate)}</td>
              <td class="n mono">{n1(r.avgMs / 1000)} s</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Progress({ exercises, byId, meta, basis }: Props) {
  const state = useAppState();
  const now = new Date();
  // Abhängig vom Verlauf selbst, nicht nur seiner Länge: Ein Abgleich mit Zurücksetzen oder eine Wiederherstellung kann
  // den Inhalt bei gleicher Länge ändern. Die Tagesleiste rückt außerdem um Mitternacht weiter.
  const days = useMemo(() => lastDays(state.log, 14, now), [state.log, dayKey(now.getTime())]);
  const cards = cardCounts(state, exercises);
  const t = today(state.log, now);
  const week = windowStats(state.log, now.getTime() - 7 * 86400000, now.getTime() + 1);
  const before = windowStats(state.log, now.getTime() - 14 * 86400000, now.getTime() - 7 * 86400000);
  const total = state.log.length;
  const right = state.log.filter(correct).length;
  const byCat = useMemo(() => breakdown(state.log, byId, 'cat'), [state.log, byId]);
  const byType = useMemo(() => breakdown(state.log, byId, 'type'), [state.log, byId]);
  const byPhase = useMemo(() => breakdown(state.log, byId, 'phase'), [state.log, byId]);
  const byMotif = useMemo(() => breakdown(state.log, byId, 'motif'), [state.log, byId]);
  const b = meta?.baseline;
  const runs = useMemo(() => listSets(state.log).filter((r) => r.entries.length >= Math.min(r.planned, 3)), [state.log]);
  const tries = useMemo(() => firstTries(state.log, byId, state.settings.tolerance), [state.log, byId, state.settings.tolerance]);
  const skill = skillStat(tries);
  const skillNext = skillStat(tries.filter((t) => t.cls === 'Nächste Stufe'), 50, 15);
  const skillEasy = skillStat(tries.filter((t) => t.cls === 'Leichtsinn'), 50, 15);
  const lastRuns = runs.slice(-10);
  const lastRates = lastRuns.map(rateOf);

  return (
    <section class="screen">
      <header class="page-head">
        <div class="eyebrow">Road to GM</div>
        <h1>Fortschritt</h1>
      </header>

      <div class="card">
        <h2>Training insgesamt</h2>
        {total === 0 ? (
          <p class="muted">Sobald du die ersten Aufgaben gelöst hast, erscheinen hier deine Zahlen.</p>
        ) : (
          <dl class="facts">
            <div>
              <dt>Aufgaben gelöst</dt>
              <dd class="mono">{n0(total)}</dd>
            </div>
            <div>
              <dt>Richtig</dt>
              <dd class="mono">{pct((100 * right) / total)}</dd>
            </div>
            <div>
              <dt>Trainingstage im {now.toLocaleDateString('de-DE', { month: 'long' })}</dt>
              <dd class="mono">{n0(trainingDays(state.log, now))}</dd>
            </div>
            <div>
              <dt>Heute</dt>
              <dd class="mono">{n0(t.n)}</dd>
            </div>
          </dl>
        )}
      </div>

      <ClockCard basis={basis} />

      {tries.length > 0 && (
        <div class="card">
          <h2>Erster Versuch an neuen Aufgaben</h2>
          {skill ? (
            <>
              <SkillRow s={skill} />
              {skillEasy && <SkillRow label="Leichtsinn" s={skillEasy} />}
              {skillNext && <SkillRow label="Nächste Stufe" s={skillNext} />}
              <p class="muted small">
                Nur der erste Versuch misst Können, spätere Versuche messen auch Erinnerung. Ein Fenster von {n0(skill.n)} Aufgaben schwankt von allein, deshalb gibt es den normalen Bereich dazu.
              </p>
            </>
          ) : (
            <p class="muted">Erste Aussage nach {n0(MIN_TRIES)} neuen Aufgaben, bisher {n0(tries.filter((t) => t.exp !== null).length)}.</p>
          )}
        </div>
      )}

      {runs.length > 0 && (
        <div class="card">
          <h2>Aufgabensätze</h2>
          <SetBars rates={lastRates} />
          <p class="muted">
            {runs.length === 1
              ? `1 Satz bisher: ${pct(lastRates[0])} richtig.`
              : `${count(runs.length, 'Satz', 'Sätze')} insgesamt. Quote der letzten ${n0(lastRates.length)}: Ø ${pct(lastRates.reduce((a, x) => a + x, 0) / lastRates.length)}, bester ${pct(Math.max(...lastRates))}.`}
          </p>
        </div>
      )}

      <div class="card">
        <h2>Letzte 14 Tage</h2>
        <Bars days={days} />
        <div class="legend">
          <span>
            <i class="sw right" /> richtig
          </span>
          <span>
            <i class="sw wrong" /> falsch
          </span>
        </div>
        {week && (
          <p class="muted">
            Letzte 7 Tage: {count(week.n, 'Aufgabe', 'Aufgaben')}, {pct(week.rate)} richtig, Ø {n1(week.avgMs / 1000)} s.
            {before && ` Die 7 Tage davor: ${count(before.n, 'Aufgabe', 'Aufgaben')}, ${pct(before.rate)} richtig, Ø ${n1(before.avgMs / 1000)} s.`}
          </p>
        )}
      </div>

      <div class="card">
        <h2>Stand der Übungen</h2>
        <div class="stack-bar" role="img" aria-label="Verteilung der Übungen nach Lernstand">
          {(['gefestigt', 'wiederholen', 'lernen', 'neu'] as const).map((k) => (
            <i key={k} class={`seg ${k}`} style={{ flexGrow: cards[k] }} title={`${k}: ${cards[k]}`} />
          ))}
        </div>
        <dl class="facts">
          <div>
            <dt>Gefestigt</dt>
            <dd class="mono">{n0(cards.gefestigt)}</dd>
          </div>
          <div>
            <dt>Wiederholen</dt>
            <dd class="mono">{n0(cards.wiederholen)}</dd>
          </div>
          <div>
            <dt>Lernen</dt>
            <dd class="mono">{n0(cards.lernen)}</dd>
          </div>
          <div>
            <dt>Neu</dt>
            <dd class="mono">{n0(cards.neu)}</dd>
          </div>
        </dl>
        <p class="muted small">Gefestigt heißt: Die Wiederholungen liegen mindestens drei Wochen auseinander.</p>
      </div>

      <div class="card">
        <h2>Nach Art der Aufgabe</h2>
        <Table rows={byType} />
        <p class="muted small">
          Fehler-Training: Stellungen mit einem Fehler aus deinen Partien, gesucht ist der beste Zug. Sicher gewinnen: klar gewonnene Stellungen, gesucht
          ist ein sicherer Zug, schnell.
        </p>
      </div>
      <div class="card">
        <h2>Nach Fehlerart</h2>
        <Table rows={byCat} />
      </div>
      <div class="card">
        <h2>Nach Partiephase</h2>
        <Table rows={byPhase} />
      </div>
      <div class="card">
        <h2>Nach Motiv</h2>
        <Table rows={byMotif} />
      </div>

      {b && meta && (
        <div class="card focus">
          <h2>Ausgangslage aus der Diagnose</h2>
          <p class="muted small">
            Stand {new Date(meta.period[1]).toLocaleDateString('de-DE')}, {n0(meta.games)} Partien. Diese Werte misst die App erst wieder, wenn sie
            neue Partien auswerten kann (Version 2).
          </p>
          <dl class="facts two">
            <div>
              <dt>Niederlagen durch Zeitablauf</dt>
              <dd class="mono">
                {n0(b.lost_on_time)} von {n0(b.losses)}
              </dd>
            </div>
            <div>
              <dt>davon in offener oder besserer Stellung</dt>
              <dd class="mono">{n0(b.lost_on_time_not_losing)}</dd>
            </div>
            <div>
              <dt>Restzeit bei Zug 30 (3+0)</dt>
              <dd class="mono">
                {n0(b.clock_move30)} s <span class="muted">Gegner {n0(b.clock_move30_opp)} s</span>
              </dd>
            </div>
            <div>
              <dt>Hängende Figuren pro 100 Partien</dt>
              <dd class="mono">
                {n0(b.hanging_per_100)} <span class="muted">Gegner {n0(b.hanging_per_100_opp)}</span>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
