import { counts } from '../lib/queue';
import { count, dayKey, n0, n1, pct } from '../lib/format';
import { KingMark } from './Mark';
import { applyUpdate, useUpdateReady } from '../lib/updater';
import { listSets, loadActive, rateOf } from '../lib/sets';
import { today } from '../lib/stats';
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
  const goal = state.settings.goalMinutes;
  const done = Math.min(1, t.minutes / goal);
  const available = c.due + c.learning + c.newAvailable;
  const filtered = state.settings.filters.phase !== 'alle' || state.settings.filters.cat !== 'alle' || state.settings.filters.motif !== 'alle';
  const b = meta?.baseline;
  const active = loadActive();
  const activeDone = active ? state.log.filter((e) => e.set?.id === active.id).length : 0;
  const resumable = !!active && activeDone > 0 && activeDone < active.size;
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
          <button class="btn light" onClick={onStart} disabled={available === 0 && c.total > 0 && c.newTotal === 0}>
            {resumable ? `Satz fortsetzen (${n0(activeDone)} von ${n0(active!.size)})` : `Satz starten (${n0(state.settings.setSize)} Aufgaben)`}
          </button>
          <dl class="hero-facts-small" aria-label="Heute im Vorrat">
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
          {c.backlogDays > 0 && (
            <p class="hero-note">
              Nach der Pause warten viele Wiederholungen. Sie verteilen sich über {n0(c.backlogDays)} Tage, heute kommen nur die sichersten dran.
            </p>
          )}
          {filtered && (
            <p class="hero-note">
              Es gilt ein Filter ({count(c.total, 'Aufgabe', 'Aufgaben')}).{' '}
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
                Satz mit {count(r.entries.length, 'Aufgabe', 'Aufgaben')}: <b class="mono">{pct(rateOf(r))}</b> richtig
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
            <b>Regel:</b> Über 10 Sekunden nachgedacht und kein Schach, kein Schlag, keine Drohung? Zieh deinen besten Kandidaten.
          </li>
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
      </div>
    </section>
  );
}
