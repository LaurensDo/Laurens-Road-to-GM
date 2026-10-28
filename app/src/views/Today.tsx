import { activeFilters, counts } from '../lib/queue';
import { count, dayKey, n0, pct } from '../lib/format';
import { KingMark } from './Mark';
import { applyUpdate, useUpdateReady } from '../lib/updater';
import { GamesCard } from './Games';
import { listSets, loadActive } from '../lib/sets';
import { Dots, DotsLegend, markOf, type Mark } from './Dots';
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
  const f = activeFilters(exercises, state.settings.filters);
  const filtered = f.phase !== 'alle' || f.cat !== 'alle' || f.motif !== 'alle';
  const b = meta?.baseline;
  const active = Object.fromEntries(
    TASK_TYPES.map((m) => {
      const a = loadActive(m);
      return [m, a ? { size: a.size, done: state.log.filter((e) => e.set?.id === a.id).length } : null];
    }),
  ) as Record<TaskType, { size: number; done: number } | null>;
  const resumable = (mode: TaskType) => { const a = active[mode]; return !!a && a.done > 0 && a.done < a.size; };
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
              {n0(Math.floor(t.minutes))} von {n0(goal)} Min
            </span>
          </div>
          {TASK_TYPES.map((mode) => {
            const cc = byMode[mode];
            // Arten ohne Aufgaben (ältere Daten) bekommen keinen Knopf
            if (cc.total === 0 && mode !== 'fehler') return null;
            // eine Zahl je Art: was heute noch dran ist (Wiederholungen, Lernschritte und neue zusammen); die Satzgröße steht in den Einstellungen
            const open = cc.due + cc.learning + cc.newAvailable;
            const a = resumable(mode) ? active[mode] : null;
            const marks: Mark[] = a ? [...Array<Mark>(a.done).fill('done'), ...Array<Mark>(Math.max(0, a.size - a.done)).fill('open')] : [];
            return (
              <div class="start-mode" key={mode}>
                <button class={`mode-btn${mode !== 'fehler' ? ' alt' : ''}`} onClick={() => onStart(mode)} disabled={!startable(cc)}>
                  <span class="mode-name">
                    {TASK_LABEL[mode]} {a ? 'weiter' : 'starten'}
                  </span>{' '}
                  <span class="mode-open">
                    {open > 0 ? (
                      <>
                        <b class="mono">{n0(open)}</b> offen
                      </>
                    ) : (
                      'erledigt'
                    )}
                  </span>{' '}
                  {a && (
                    <span class="mode-progress">
                      <Dots marks={marks} />{' '}
                      <span class="mode-progress-text">
                        {n0(a.done)} von {n0(a.size)}
                      </span>
                    </span>
                  )}
                </button>
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
        {t.n === 0 ? (
          <p class="muted">Noch keine Aufgabe. Fünf Minuten reichen für den Anfang.</p>
        ) : (
          <>
            {todaySets.length > 0 && (
              <ul class="plain set-strips">
                {todaySets.map((r) => (
                  <li key={r.id}>
                    <span class="set-mode">{TASK_LABEL[modeOfEntries(r.entries, byId)]}</span>{' '}
                    <Dots marks={[...r.entries.map(markOf), ...Array<Mark>(Math.max(0, r.planned - r.entries.length)).fill('open')]} />
                  </li>
                ))}
              </ul>
            )}
            <p class="muted small">
              {count(t.n, 'Aufgabe', 'Aufgaben')} · {t.rate !== null ? `${pct(t.rate)} richtig` : '–'}
              {t.avgMs !== null ? ` · Ø ${n0(t.avgMs / 1000)} s` : ''}
            </p>
            {todaySets.length > 0 && <DotsLegend />}
          </>
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
