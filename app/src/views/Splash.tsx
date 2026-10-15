import { useEffect, useState } from 'preact/hooks';
import { pickQuote, readTimeMs } from '../lib/quotes';
import { currentBand } from '../lib/viewport';
import { KingMark } from './Mark';

/** Mindestdauer richtet sich nach der Länge des Spruchs (siehe readTimeMs). Tippen überspringt, sobald Daten und Stand geladen sind. */
const FADE_MS = 380;

/** Startbild beim Öffnen der App: ein Zitat, wechselt bei jedem Start. */
export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [quote] = useState(() => pickQuote());
  const [minDone, setMinDone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [band, setBand] = useState(currentBand);

  useEffect(() => {
    const t = window.setTimeout(() => setMinDone(true), readTimeMs(quote.text));
    const onResize = () => setBand(currentBand());
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
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
    <div id="splash" class={leaving ? 'leaving' : ''} data-ready={ready ? '1' : '0'} style={{ '--band': band } as never} onClick={leave} role="presentation">
      <div class="splash-pattern" aria-hidden="true" />
      <div class="splash-mark" aria-hidden="true">
        <KingMark />
      </div>
      <blockquote class="splash-quote">
        <p>„{quote.text}“</p>
        <footer class="splash-author">{quote.author}</footer>
      </blockquote>
      <div class="splash-foot eyebrow">Road to GM</div>
    </div>
  );
}
