import { counts } from '../lib/queue';
import { count, dayKey, n0, n1, pct } from '../lib/format';
import { KingMark } from './Mark';
import { applyUpdate, useUpdateReady } from '../lib/updater';
import { GamesCard } from './Games';
import { listSets, loadActive, rateOf } from '../lib/sets';
import { today } from '../lib/stats';
import { useAppState } from '../lib/store';
import { SyncBadge } from './SyncCard';
import { modeOfEntries, TASK_LABEL, TASK_TYPES, type TaskType } from '../lib/limit';
import type { Exercise, Meta } from '../lib/types';

interface Props {
  exercises: Exercise[];
  meta: Meta | null;
  regel: string;
  onStart: (mode: TaskType) => void;
  onOpenSettings: () => void;
}

export function Today({ exercises, meta, regel, onStart, onOpenSettings }: Props) {
  const state = useAppState();
  const now = new Date();
  const c = counts(exercises, state, now, 'fehler');
  const byMode = Object.fromEntries(TASK_TYPES.map((m) => [m, counts(exercises, state, now, m)])) as Record<TaskType, typeof c>;
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const t = today(state.log, now);
  const goal = state.settings.goalMinutes;
  const done = Math.min(1, t.minutes / goal);
  const filtered = state.settings.filters.phase !== 'alle' || state.settings.filters.cat !== 'alle' || state.settings.filters.motif !== 'alle';
  const b = meta?.baseline;
  const active = loadActive();
  const activeDone = active ? state.log.filter((e) => e.set?.id === active.id).length : 0;
  const resumable = (mode: TaskType) => !!active && active.mode === mode && activeDone > 0 && activeDone < active.size;
  const startable = (cc: typeof c) => !(cc.due + cc.learning + cc.newAvailable === 0 && cc.total > 0 && cc.newTotal === 0) && cc.total > 0;
  const todaySets = listSets(state.log).filter((r) => dayKey(r.startTs) === dayKey(now.getTime()));
  const updateReady = useUpdateReady();

  return (
    <section class="screen">
      {updateReady && (
        <button class="update-note" onClick={applyUpdate}>
          <KingMark class="update-mark" />
          <span>
            <b>Neue Version da.</b> Tippen zum Laden.
          </span>
        </button>
      )}
      <header class="hero">
        <div class="hero-bg" aria-hidden="true" />
        <KingMark class="hero-mark" />
        <div class="hero-body">
          <div class="eyebrow">Road to GM</div>
          <h1>Heute</h1>
          <div class="hero-prog">
            <div class="bar big" role="progressbar" aria-valuenow={Math.round(done * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Fortschritt der Tagesration">
              <i style={{ width: `${done * 100}%` }} />
            </div>
            <span class="mono">
              {n1(t.minutes)} von {n0(goal)} Min
            </span>
          </div>
          {TASK_TYPES.map((mode) => {
            const cc = byMode[mode];
            // Arten ohne Aufgaben (ältere Daten) bekommen keinen Knopf
            if (cc.total === 0 && mode !== 'fehler') return null;
            return (
              <div class="start-mode" key={mode}>
                <button class={`btn light${mode !== 'fehler' ? ' alt' : ''}`} onClick={() => onStart(mode)} disabled={!startable(cc)}>
                  {resumable(mode)
                    ? `${TASK_LABEL[mode]} weiter (${n0(activeDone)} von ${n0(active!.size)})`
                    : `${TASK_LABEL[mode]} starten`}
                </button>
                <dl class="hero-facts-small" aria-label={`${TASK_LABEL[mode]} heute im Vorrat`}>
                  <div>
                    <dt>Satz</dt>
                    <dd class="mono">{n0(state.settings.setSize)}</dd>
                  </div>
                  <div>
                    <dt>Fällig</dt>
                    <dd class="mono">{n0(cc.due)}</dd>
                  </div>
                  <div>
                    <dt>Lernen</dt>
                    <dd class="mono">{n0(cc.learning)}</dd>
                  </div>
                  <div>
                    <dt>Neu</dt>
                    <dd class="mono">{n0(cc.newAvailable)}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
          {c.backlogDays > 0 && (
            <p class="hero-note">
              Nach der Pause warten viele Wiederholungen. Sie verteilen sich über {n0(c.backlogDays)} Tage, heute kommen nur die sichersten dran.
            </p>
          )}
          {filtered && (
            <p class="hero-note">
              Für das Fehler-Training gilt ein Filter ({count(c.total, 'Aufgabe', 'Aufgaben')}).{' '}
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
                {TASK_LABEL[modeOfEntries(r.entries, byId)]}, {count(r.entries.length, 'Aufgabe', 'Aufgaben')}: <b class="mono">{pct(rateOf(r))}</b> richtig
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

      <GamesCard regel={regel} />

      <details class="card howto-card">
        <summary>
          <h2>Dein Fokus laut Diagnose</h2>
        </summary>
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
            <b>Klar gewonnen:</b> Der erste sichere Zug reicht, nicht grübeln.
          </li>
          <li>
            <b>Nach jedem Gegnerzug:</b> ein Blick, was er angreift.
          </li>
        </ul>
        {meta && (
          <p class="muted small">
            Grundlage: {n0(meta.games)} Blitz-Partien, {n0(meta.counts.exercises)} Übungen aus deinen eigenen Fehlern.
          </p>
        )}
      </details>
    </section>
  );
}
