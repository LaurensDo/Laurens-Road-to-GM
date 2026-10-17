import { useEffect, useRef } from 'preact/hooks';
import { n0 } from '../lib/format';
import { numberedMoves, tagsOf, type Variation } from '../lib/variation';

/** Bewertungsbalken: der Anteil von unten ist die Gewinnchance des Spielers, der in der Übung am Zug ist (er sitzt auch unten am Brett). */
export function EvalBar({ wp, color }: { wp: number | null; color: 'w' | 'b' }) {
  if (wp === null) return null;
  const v = Math.max(0, Math.min(100, wp));
  return (
    <div class={`evalbar ${color}`} role="img" aria-label={`Deine Gewinnchance: ${n0(v)} Prozent`}>
      <i style={{ height: `${v}%` }} />
    </div>
  );
}

interface BarProps {
  fen: string;
  variations: Variation[];
  active: string;
  step: number;
  maxStep: number;
  wp: number | null;
  onPick: (key: string) => void;
  onStep: (step: number) => void;
  onClose: () => void;
}

/**
 * Untere Leiste in der Variantenansicht: Auswahl der Variante, Zugliste, Vor/Zurück und "Fertig". Sie bleibt stehen, das Brett oben auch,
 * deshalb muss man beim Durchklicken nicht scrollen.
 */
export function VarBar({ fen, variations, active, step, maxStep, wp, onPick, onStep, onClose }: BarProps) {
  const v = variations.find((x) => x.key === active) ?? variations[0];
  const labels = numberedMoves(fen, v.moves).slice(0, maxStep);
  const strip = useRef<HTMLDivElement>(null);

  // aktiven Zug in die Mitte der Zugliste holen, wenn sie seitlich scrollt
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>('.on');
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [step, active]);

  return (
    <div class="dock varbar" data-nosound>
      {variations.length > 1 && (
        <div class="var-pick" role="group" aria-label="Variante wählen">
          {variations.map((x) => (
            <button key={x.key} class={`var-chip ${x.key === v.key ? 'on' : ''}`} onClick={() => onPick(x.key)} aria-pressed={x.key === v.key}>
              <b class="mono">{x.san}</b>
              <span>{tagsOf(x)}</span>
            </button>
          ))}
        </div>
      )}
      <div class="var-moves mono" ref={strip}>
        {labels.map((m, i) => (
          <button key={i} class={`pv-move ${i + 1 === step ? 'on' : ''}`} onClick={() => onStep(i + 1)} aria-label={`Zug ${m}`}>
            {m}
          </button>
        ))}
      </div>
      <div class="var-controls">
        <button class="btn secondary" disabled={step <= 0} onClick={() => onStep(step - 1)} aria-label="Ein Zug zurück">
          ◀
        </button>
        <button class="btn secondary" disabled={step >= maxStep} onClick={() => onStep(step + 1)} aria-label="Ein Zug vor">
          ▶
        </button>
        <span class="var-wp mono" aria-live="off">
          {wp !== null ? `${n0(wp)} %` : ''}
        </span>
        <button class="btn" onClick={onClose}>
          Fertig
        </button>
      </div>
    </div>
  );
}
