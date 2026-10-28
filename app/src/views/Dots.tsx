import { correct, slowCorrect } from '../lib/stats';
import type { ReviewEntry } from '../lib/types';

/**
 * Ein Satz als Reihe von Zeichen, eines je Aufgabe: Man sieht auf einen Blick, wie er lief, ohne Zahlen zu lesen.
 * Die Form trägt die Bedeutung (Punkt, Ring, Kreuz), die Farbe hilft nur: Das bleibt auch ohne Farbsehen lesbar.
 */
export type Mark = 'right' | 'slow' | 'wrong' | 'done' | 'open';

export const markOf = (e: ReviewEntry): Mark => (correct(e) ? (slowCorrect(e) ? 'slow' : 'right') : 'wrong');

const WORD: Record<Mark, string> = { right: 'richtig', slow: 'zu langsam', wrong: 'falsch', done: 'erledigt', open: 'offen' };
const ORDER: Mark[] = ['right', 'slow', 'wrong', 'done', 'open'];

function Glyph({ m }: { m: Mark }) {
  return (
    <svg class={`pip ${m}`} viewBox="0 0 12 12" aria-hidden="true">
      {(m === 'right' || m === 'done') && <circle cx="6" cy="6" r="5" />}
      {m === 'slow' && <circle cx="6" cy="6" r="4.1" fill="none" stroke-width="1.8" />}
      {m === 'wrong' && <path d="M2.6 2.6 9.4 9.4 M9.4 2.6 2.6 9.4" fill="none" stroke-width="2" stroke-linecap="round" />}
      {m === 'open' && <circle cx="6" cy="6" r="2.2" />}
    </svg>
  );
}

export function Dots({ marks }: { marks: Mark[] }) {
  const label = ORDER.map((m) => [m, marks.filter((x) => x === m).length] as const)
    .filter(([, n]) => n > 0)
    .map(([m, n]) => `${n} ${WORD[m]}`)
    .join(', ');
  return (
    <span class="pips" role="img" aria-label={label}>
      {marks.map((m, i) => (
        <Glyph key={i} m={m} />
      ))}
    </span>
  );
}

/** Erklärung der Zeichen, einmal unter der Liste */
export function DotsLegend() {
  return (
    <p class="pips-legend muted small" aria-hidden="true">
      {(['right', 'slow', 'wrong', 'open'] as Mark[]).map((m) => (
        <span key={m}>
          <Glyph m={m} /> {WORD[m]}
        </span>
      ))}
    </p>
  );
}
