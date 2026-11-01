import { n0, seconds } from '../lib/format';
import { thenLine } from '../lib/setend';
import { MiniBoard } from './MiniBoard';
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
  /** Art des Satzes für die Kopfzeile */
  label?: string;
  /** Moment des Satzes: gelöste Aufgabe, deren Fehler damals viel kostete (setend.ts) */
  moment?: { e: ReviewEntry; ex: Exercise; line: string } | null;
  /** Big Dog zur Lage, mit der sachlichen Zeile daneben */
  dog?: { text: string; author: string; fact: string } | null;
  /** Zweite Chance: wie viele noch einmal gespielt, wie viele davon richtig (zählt nicht) */
  retry?: { n: number; right: number } | null;
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

export function SetResult({ summary: s, entries, byId, moreAvailable, label, moment, dog, retry, onNext, onExit }: Props) {
  return (
    <section class="screen setresult">
      <header class="page-head">
        <div class="eyebrow">
          {label ? `${label} · ` : ''}
          {s.complete ? 'Satz geschafft' : `Satz beendet nach ${n0(s.n)} von ${n0(s.planned)}`}
        </div>
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
        <p class="score-sentence">{s.sentence}</p>
        <SetBar size={s.n} entries={entries} />
        {retry && retry.n > 0 && (
          <p class="muted small">
            Zweite Chance: {n0(retry.right)} von {n0(retry.n)} zurückgeholt. Zählt nicht für Quote und Wiederholung.
          </p>
        )}
      </div>

      {moment && moment.e.san && (
        <div class="card moment">
          <h2>Moment des Satzes</h2>
          <div class="moment-body">
            <MiniBoard fen={moment.ex.fen} san={moment.e.san} orientation={moment.ex.turn === 'w' ? 'white' : 'black'} />
            <div class="moment-text">
              <p>{moment.line}</p>
              <a href={moment.ex.url} target="_blank" rel="noopener noreferrer">
                Partie ansehen
              </a>
            </div>
          </div>
        </div>
      )}

      {dog && (
        <div class="card bigdog">
          <blockquote class="dog-quote">
            <p>„{dog.text}“</p>
            <footer>{dog.author}</footer>
          </blockquote>
          <p class="dog-fact">{dog.fact}</p>
        </div>
      )}

      <details class="card einordnung">
        <summary>
          <h2>Einordnung</h2>
        </summary>
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
      </details>

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
                      {/* bei gelösten Aufgaben die Damals-Zeile: was der Zug in der Partie kostete, und heute */}
                      {thenLine(ex, e) ?? `${ex.phase} · ${ex.cat}`}
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
