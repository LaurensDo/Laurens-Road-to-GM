import { useEffect, useState } from 'preact/hooks';
import { greeting } from '../lib/format';
import { streak } from '../lib/stats';
import { useAppState } from '../lib/store';
import { PawnMark } from './Mark';

/** So lange mindestens zu sehen, damit es nicht aufblitzt (Millisekunden) */
export const SPLASH_MIN_MS = 1300;
const FADE_MS = 380;

/**
 * Startbild beim Öffnen der App. Bleibt, bis Daten und Stand geladen sind (mindestens kurz), Tippen überspringt es.
 */
export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const state = useAppState();
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

  const now = new Date();
  const days = ready ? streak(state.log, now) : 0;

  return (
    <div id="splash" class={leaving ? 'leaving' : ''} onClick={leave} role="presentation">
      <div class="splash-pattern" aria-hidden="true" />
      <div class="splash-center">
        <div class="splash-mark" aria-hidden="true">
          <PawnMark />
        </div>
        <div class="splash-title">Road to GM</div>
        <div class="splash-tag">Aus deinen Fehlern wird Stärke.</div>
        <div class="splash-greet">
          {ready ? greeting(now.getHours()) : '\u00a0'}
          {days > 0 ? ` · Serie ${days} ${days === 1 ? 'Tag' : 'Tage'}` : ''}
        </div>
      </div>
    </div>
  );
}
