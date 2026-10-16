import { setPrefs, usePrefs, type TimerSound } from '../lib/device';
import { play, SFX_LABELS, type Sfx } from '../lib/sound';
import { Segmented } from './Segmented';

const PREVIEW: Sfx[] = ['select', 'move', 'capture', 'illegal', 'correct', 'slow', 'wrong', 'start', 'tick', 'tickLast', 'timeUp', 'ui', 'done'];

export function SoundCard() {
  const p = usePrefs();
  const hasSession = typeof navigator !== 'undefined' && 'audioSession' in navigator;
  return (
    <div class="card">
      <h2>Ton</h2>
      <p class="muted small">Gilt nur für dieses Gerät. iPhone und iPad dürfen unterschiedlich laut sein.</p>
      <div class="field">
        <label>Ton</label>
        <Segmented
          label="Ton"
          value={p.sound ? 'an' : 'aus'}
          options={[
            { value: 'an', label: 'An' },
            { value: 'aus', label: 'Aus' },
          ]}
          onChange={(v) => {
            setPrefs({ sound: v === 'an' });
            // beim Einschalten hörbar bestätigen (der Klick-Ton davor fiel noch unter "aus")
            if (v === 'an') play('ui');
          }}
        />
      </div>
      {p.sound && (
        <>
          <div class="field">
            <label>Lautstärke</label>
            <Segmented
              label="Lautstärke"
              value={p.volume}
              options={[
                { value: 1, label: 'Leise' },
                { value: 2, label: 'Mittel' },
                { value: 3, label: 'Laut' },
              ]}
              onChange={(v) => {
                setPrefs({ volume: v });
                play('move');
              }}
            />
          </div>
          <div class="field">
            <label>Uhr-Ton in der Aufgabe</label>
            <Segmented<TimerSound>
              label="Uhr-Ton"
              value={p.timerSound}
              options={[
                { value: 'off', label: 'Aus' },
                { value: 'end', label: 'Nur Ende' },
                { value: 'standard', label: 'Standard' },
                { value: 'every', label: 'Jede Sek.' },
              ]}
              onChange={(v) => setPrefs({ timerSound: v })}
            />
            <p class="muted small">
              Standard: ein kurzer Start-Ton, Ticks in den letzten drei Sekunden und ein Ton, wenn das Zeitlimit erreicht ist. Gilt nur, wenn ein Zeitlimit eingestellt ist.
            </p>
          </div>
          {hasSession && (
            <div class="field">
              <label>Stummschalter</label>
              <Segmented
                label="Stummschalter"
                value={p.ignoreMute ? 'ignorieren' : 'beachten'}
                options={[
                  { value: 'beachten', label: 'Beachten' },
                  { value: 'ignorieren', label: 'Ton trotzdem' },
                ]}
                onChange={(v) => setPrefs({ ignoreMute: v === 'ignorieren' })}
              />
              <p class="muted small">Bei „Beachten“ bleibt die App stumm, solange der Stummschalter oder der Stummmodus aktiv ist. „Ton trotzdem“ kann Musik anderer Apps unterbrechen.</p>
            </div>
          )}
          <details class="howto" data-nosound>
            <summary>Töne anhören</summary>
            <div class="sfx-grid">
              {PREVIEW.map((n) => (
                <button key={n} class="btn secondary" onClick={() => play(n)}>
                  {SFX_LABELS[n]}
                </button>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
