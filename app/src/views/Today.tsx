import { counts } from '../lib/queue';
import { dayKey, greeting, n0, n1, pct } from '../lib/format';
import { PawnMark } from './Mark';
import { listSets, loadActive, rateOf } from '../lib/sets';
import { streak, today } from '../lib/stats';
import { useAppState } from '../lib/store';
import { SyncBadge } from './SyncCard';
import type { Exercise, Meta } from '../lib/types';

interface Props {
  exercises: Exercise[];
  meta: Meta | null;
  onStart: () => void;
  onOpenSettings: () => void;
}

export function Today({ exercises, meta, onStart, onOpenSettings }: Props) {
  const state = useAppState();
  const now = new Date();
  const c = counts(exercises, state, now);
  const t = today(state.log, now);
  const days = streak(state.log, now);
  const goal = state.settings.goalMinutes;
  const done = Math.min(1, t.minutes / goal);
  const available = c.due + c.learning + c.newAvailable;
  const filtered = state.settings.filters.phase !== 'alle' || state.settings.filters.cat !== 'alle' || state.settings.filters.motif !== 'alle';
  const b = meta?.baseline;
  const active = loadActive();
  const activeDone = active ? state.log.filter((e) => e.set?.id === active.id).length : 0;
  const resumable = !!active && activeDone > 0 && activeDone < active.size;
  const todaySets = listSets(state.log).filter((r) => dayKey(r.startTs) === dayKey(now.getTime()));

  return (
    <section class="screen">
      <header class="hero">
        <div class="hero-bg" aria-hidden="true" />
        <PawnMark class="hero-pawn" />
        <div class="hero-body">
          <div class="eyebrow">Road to GM</div>
          <h1>{greeting(now.getHours())}</h1>
          <p class="hero-sub">{days > 0 ? `Serie: ${n0(days)} ${days === 1 ? 'Tag' : 'Tage'}. Bleib dran.` : 'Heute geht es los.'}</p>
          <div class="hero-prog">
            <div class="bar big" role="progressbar" aria-valuenow={Math.round(done * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Fortschritt der Tagesration">
              <i style={{ width: `${done * 100}%` }} />
            </div>
            <span class="mono">
              {n1(t.minutes)} von {n0(goal)} Min
            </span>
          </div>
          <dl class="facts hero-facts">
            <div>
              <dt>Fällig</dt>
              <dd class="mono">{n0(c.due)}</dd>
            </div>
            <div>
              <dt>Lernen</dt>
              <dd class="mono">{n0(c.learning)}</dd>
            </div>
            <div>
              <dt>Neu</dt>
              <dd class="mono">{n0(c.newAvailable)}</dd>
            </div>
          </dl>
          <button class="btn light" onClick={onStart} disabled={available === 0 && c.total > 0 && c.newTotal === 0}>
            {resumable ? `Satz fortsetzen (${n0(activeDone)} von ${n0(active!.size)})` : `Satz starten (${n0(state.settings.setSize)} Aufgaben)`}
          </button>
          {filtered && (
            <p class="hero-note">
              Es gilt ein Filter ({c.total} Aufgaben).{' '}
              <button class="link inline" onClick={onOpenSettings}>
                Ändern
              </button>
            </p>
          )}
          <SyncBadge onOpen={onOpenSettings} />
        </div>
      </header>

      <div class="card">
        <h2>Heute erledigt</h2>
        {todaySets.length > 0 && (
          <ul class="plain sets-today">
            {todaySets.map((r) => (
              <li key={r.id}>
                <span class="mono">{new Date(r.startTs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>{' '}
                Satz mit {n0(r.entries.length)} {r.entries.length === 1 ? 'Aufgabe' : 'Aufgaben'}: <b class="mono">{pct(rateOf(r))}</b> richtig
                {r.entries.length < r.planned && <span class="muted"> (nicht fertig)</span>}
              </li>
            ))}
          </ul>
        )}
        {t.n === 0 ? (
          <p class="muted">Noch keine Aufgabe. Fünf Minuten reichen für den Anfang.</p>
        ) : (
          <dl class="facts">
            <div>
              <dt>Aufgaben</dt>
              <dd class="mono">{n0(t.n)}</dd>
            </div>
            <div>
              <dt>Richtig</dt>
              <dd class="mono">{t.rate !== null ? pct(t.rate) : '–'}</dd>
            </div>
            <div>
              <dt>Ø Zeit</dt>
              <dd class="mono">{t.avgMs !== null ? `${n1(t.avgMs / 1000)} s` : '–'}</dd>
            </div>
          </dl>
        )}
      </div>

      <div class="card focus">
        <h2>Dein Fokus laut Diagnose</h2>
        <ul class="plain">
          <li>
            <b>Uhr:</b> in 3+0 bei Zug 20 mindestens 2:00, bei Zug 30 mindestens 1:20 auf der Uhr.
            {b && (
              <span class="muted">
                {' '}
                Bisher {n0(b.clock_move20)} s und {n0(b.clock_move30)} s, deine Gegner {n0(b.clock_move20_opp)} s und {n0(b.clock_move30_opp)} s.
              </span>
            )}
          </li>
          <li>
            <b>Gewinnstellungen:</b> klar gewonnene Stellungen schnell verwerten, tauschen und vereinfachen.
          </li>
          <li>
            <b>Taktik:</b> vor jedem Zug prüfen, ob eine Figur hängt oder eine Gabel droht.
          </li>
        </ul>
        {meta && (
          <p class="muted small">
            Grundlage: {n0(meta.games)} Blitz-Partien, {n0(meta.counts.exercises)} Übungen aus deinen eigenen Fehlern.
          </p>
        )}
      </div>
    </section>
  );
}
