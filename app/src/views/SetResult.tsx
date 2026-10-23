import { n0, n1, pct, seconds } from '../lib/format';
import type { SetSummary } from '../lib/sets';
import { correct, slowCorrect } from '../lib/stats';
import type { Exercise, ReviewEntry } from '../lib/types';

/** Fortschrittsleiste eines Satzes: ein Abschnitt je Aufgabe, eingefärbt nach Ergebnis. */
export function SetBar({ size, entries, open }: { size: number; entries: ReviewEntry[]; open?: boolean }) {
  return (
    <div class="setbar" role="img" aria-label={`${entries.length} von ${size} Aufgaben beantwortet`}>
      {Array.from({ length: size }, (_, i) => {
        const e = entries[i];
        let cls = 'todo';
        if (e) cls = !correct(e) ? 'bad' : slowCorrect(e) ? 'slow' : 'ok';
        else if (open && i === entries.length) cls = 'now';
        return <i key={i} class={cls} />;
      })}
    </div>
  );
}

interface Props {
  summary: SetSummary;
  entries: ReviewEntry[];
  byId: Map<string, Exercise>;
  limit: number;
  moreAvailable: boolean;
  onNext: () => void;
  onExit: () => void;
}

function rowText(e: ReviewEntry, ex: Exercise | undefined): string {
  if (!ex) return e.san ?? '';
  const best = ex.lines[0].san;
  if (e.verdict === 'gaveup') return `Lösung angezeigt · bester Zug ${best}`;
  // wie im Trainer: Im Endspiel hält jeder richtige Zug das Ergebnis, bei "Sicher gewinnen" zählt jeder sichere Zug
  const also = ex.tb ? 'hält das Ergebnis' : ex.win ? 'sicherer Zug' : 'gleichwertig';
  if (correct(e)) return e.san === best ? `Richtig: ${best}` : `Richtig: ${e.san} (${also}, bester ${best})`;
  return `Dein Zug ${e.san ?? '–'} · bester Zug ${best}`;
}

export function SetResult({ summary: s, entries, byId, limit, moreAvailable, onNext, onExit }: Props) {
  return (
    <section class="screen setresult">
      <header class="page-head">
        <div class="eyebrow">{s.complete ? 'Satz geschafft' : `Satz beendet nach ${n0(s.n)} von ${n0(s.planned)}`}</div>
        <h1>{s.headline}</h1>
      </header>

      <div class="card score">
        <div class="score-main">
          <span class="big mono">
            {n0(s.right)}
            <small>/{n0(s.n)}</small>
          </span>
          <span class="muted">richtig</span>
        </div>
        <SetBar size={s.n} entries={entries} />
        <dl class="facts">
          <div>
            <dt>Quote</dt>
            <dd class="mono">{pct(s.rate)}</dd>
          </div>
          <div>
            <dt>Im Limit</dt>
            <dd class="mono">{s.timed ? `${n0(s.inTime)}/${n0(s.n)}` : '–'}</dd>
          </div>
          <div>
            <dt>Ø Zeit</dt>
            <dd class="mono">{n1(s.avgMs / 1000)} s</dd>
          </div>
        </dl>
      </div>

      <div class="card">
        <h2>Einordnung</h2>
        <ul class="plain">
          {s.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {(s.strong || s.weak) && (
          <div class="chips">
            {s.strong && <span class="chip good">Stark: {s.strong.label} ({n0(s.strong.right)} von {n0(s.strong.n)})</span>}
            {s.weak && <span class="chip bad">Üben: {s.weak.label} ({n0(s.weak.right)} von {n0(s.weak.n)})</span>}
          </div>
        )}
        <p class="tip">
          <b>Tipp:</b> {s.tip}
        </p>
        <p class="muted small">Die Einordnung folgt festen Regeln aus deinen Antworten und den Maia-Werten der Aufgaben, keine KI.</p>
      </div>

      <div class="card">
        <h2>Die Aufgaben</h2>
        <ul class="tasklist">
          {entries.map((e, i) => {
            const ex = byId.get(e.id);
            const ok = correct(e);
            const slow = slowCorrect(e);
            return (
              <li key={`${e.id}${e.ts}`}>
                <span class={`mark ${ok ? (slow ? 'slow' : 'ok') : 'bad'}`} aria-label={ok ? (slow ? 'richtig, aber langsam' : 'richtig') : 'falsch'}>
                  {ok ? (slow ? '◔' : '✓') : '✕'}
                </span>
                <span class="task-text">
                  <span class="task-main">
                    <span class="mono muted">{i + 1}.</span> {rowText(e, ex)}
                  </span>
                  {ex && (
                    <span class="task-sub muted small">
                      {ex.phase} · {ex.cat}
                    </span>
                  )}
                </span>
                <span class="task-side">
                  <span class="mono muted small">{seconds(e.ms)}</span>
                  {ex && (
                    <a class="small" href={ex.url} target="_blank" rel="noopener noreferrer" aria-label="Partie ansehen">
                      Partie
                    </a>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div class="dock">
        {moreAvailable ? (
          <button class="btn" onClick={onNext}>
            Nächster Satz
          </button>
        ) : (
          <p class="muted small center">Für heute ist alles verteilt. Neue Aufgaben und Wiederholungen kommen später.</p>
        )}
        <button class={`btn ${moreAvailable ? 'secondary' : ''}`} onClick={onExit}>
          Für heute fertig
        </button>
      </div>
    </section>
  );
}
