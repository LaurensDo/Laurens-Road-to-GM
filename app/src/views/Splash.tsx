import { useEffect, useState } from 'preact/hooks';
import { pickQuote } from '../lib/quotes';
import { PawnMark } from './Mark';

/**
 * Mindestdauer in Millisekunden: etwa 1,2 s bis alles eingeblendet ist, danach gut 1,5 s zum Lesen.
 * Tippen überspringt das Startbild, sobald Daten und Stand geladen sind.
 */
export const SPLASH_MIN_MS = 2800;
const FADE_MS = 380;

/** Startbild beim Öffnen der App: ein Zitat, wechselt bei jedem Start. */
export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [quote] = useState(() => pickQuote());
  const [minDone, setMinDone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setMinDone(true), SPLASH_MIN_MS);
    return () => window.clearTimeout(t);
  }, []);

  const leave = () => {
    if (!ready || leaving) return;
    setLeaving(true);
    window.setTimeout(onDone, FADE_MS);
  };

  useEffect(() => {
    if (ready && minDone) leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, minDone]);

  return (
    <div id="splash" class={leaving ? 'leaving' : ''} data-ready={ready ? '1' : '0'} onClick={leave} role="presentation">
      <div class="splash-pattern" aria-hidden="true" />
      <div class="splash-center">
        <div class="splash-mark" aria-hidden="true">
          <PawnMark />
        </div>
        <blockquote class="splash-quote">
          <p>„{quote.text}“</p>
          <footer class="splash-author">{quote.author}</footer>
        </blockquote>
      </div>
      <div class="splash-foot eyebrow">Road to GM</div>
    </div>
  );
}
