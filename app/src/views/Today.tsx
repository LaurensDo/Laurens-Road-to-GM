import { counts } from '../lib/queue';
import { n0, n1, pct } from '../lib/format';
import { streak, today } from '../lib/stats';
import { useAppState } from '../lib/store';
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

  return (
    <section class="screen">
      <header class="page-head">
        <div class="eyebrow">Road to GM</div>
        <h1>Heute</h1>
      </header>

      <div class="card">
        <div class="ration-head">
          <h2>Tagesration</h2>
          <span class="mono muted">
            {n1(t.minutes)} von {n0(goal)} Min
          </span>
        </div>
        <div class="bar big" role="progressbar" aria-valuenow={Math.round(done * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Fortschritt der Tagesration">
          <i style={{ width: `${done * 100}%` }} />
        </div>
        <dl class="facts">
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
          <div>
            <dt>Serie</dt>
            <dd class="mono">{n0(days)} {days === 1 ? 'Tag' : 'Tage'}</dd>
          </div>
        </dl>
        <button class="btn" onClick={onStart} disabled={available === 0 && c.total > 0 && c.newTotal === 0}>
          {t.n > 0 ? 'Weiter üben' : 'Training starten'}
        </button>
        {filtered && (
          <p class="muted small">
            Es gilt ein Filter ({c.total} Aufgaben).{' '}
            <button class="link inline" onClick={onOpenSettings}>
              Ändern
            </button>
          </p>
        )}
      </div>

      <div class="card">
        <h2>Heute erledigt</h2>
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
