import { useState } from 'preact/hooks';
import { exportJson, importJson, replaceState, update, useAppState } from '../lib/store';
import { hiddenCount } from '../lib/queue';
import { Segmented } from './Segmented';
import { SoundCard } from './SoundCard';
import { SyncCard } from './SyncCard';
import { saveActive } from '../lib/sets';
import { n0 } from '../lib/format';
import { emptyState, type Exercise, type Filters, type ThemeSetting } from '../lib/types';

interface Props {
  exercises: Exercise[];
  generated: string;
}

export function Settings({ exercises, generated }: Props) {
  const state = useAppState();
  const s = state.settings;
  const [msg, setMsg] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [showText, setShowText] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const set = (patch: Partial<typeof s>) => update((st) => ({ ...st, settings: { ...st.settings, ...patch }, settingsTs: Date.now() }));
  const setFilter = (patch: Partial<Filters>) => set({ filters: { ...s.filters, ...patch } });

  const phases = ['alle', ...new Set(exercises.map((e) => e.phase))];
  const cats = ['alle', ...new Set(exercises.map((e) => e.cat))];
  const motifs = ['alle', ...[...new Set(exercises.flatMap((e) => e.motifs))].sort()];

  const doExport = async () => {
    const json = exportJson();
    const name = `road-to-gm-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      const file = new File([json], name, { type: 'application/json' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'Road to GM Sicherung' });
        setMsg('Sicherung geteilt. Speichere sie in Dateien oder schick sie dir selbst.');
        return;
      }
    } catch {
      // Teilen abgebrochen oder nicht möglich: Text anzeigen
    }
    try {
      await navigator.clipboard.writeText(json);
      setMsg('Sicherung in die Zwischenablage kopiert. Füge sie in eine Notiz ein.');
    } catch {
      setText(json);
      setShowText(true);
      setMsg('Markiere den Text und kopiere ihn in eine Notiz.');
    }
  };

  const doImport = () => {
    const r = importJson(text);
    setMsg(r.message);
    if (r.ok) {
      setText('');
      setShowText(false);
    }
  };

  const onFile = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const r = importJson(await f.text());
    setMsg(r.message);
  };

  return (
    <section class="screen">
      <header class="page-head">
        <div class="eyebrow">Road to GM</div>
        <h1>Einstellungen</h1>
      </header>

      <SyncCard />

      <div class="card">
        <h2>Training</h2>
        <div class="field">
          <label>Aufgaben pro Satz</label>
          <Segmented
            label="Aufgaben pro Satz"
            value={s.setSize}
            options={[5, 10, 15, 20].map((v) => ({ value: v, label: String(v) }))}
            onChange={(v) => set({ setSize: v })}
          />
          <p class="muted small">Ein Satz ist eine Runde mit fester Zahl Aufgaben. Am Ende gibt es Ergebnis und Einordnung. Gilt ab dem nächsten Satz.</p>
        </div>
        <div class="field">
          <label>Zeitlimit pro Aufgabe</label>
          <Segmented
            label="Zeitlimit"
            value={s.timeLimit}
            options={[
              { value: 5, label: '5 s' },
              { value: 10, label: '10 s' },
              { value: 20, label: '20 s' },
              { value: 0, label: 'Aus' },
            ]}
            onChange={(v) => set({ timeLimit: v })}
          />
          <p class="muted small">Richtig, aber langsamer als das Limit, gilt als schwer und kommt früher wieder.</p>
        </div>
        <div class="field">
          <label>Letzter Zug des Gegners</label>
          <Segmented
            label="Letzter Zug des Gegners"
            value={s.showLast ? 'an' : 'aus'}
            options={[
              { value: 'an', label: 'Zeigen' },
              { value: 'aus', label: 'Nicht zeigen' },
            ]}
            onChange={(v) => set({ showLast: v === 'an' })}
          />
          <p class="muted small">Vor jeder Aufgabe wird der letzte Zug des Gegners gespielt und hervorgehoben, wie in einer echten Partie. Danach läuft die Zeit.</p>
        </div>
        <div class="field">
          <label>Gleichwertige Züge</label>
          <Segmented
            label="Gleichwertige Züge"
            value={s.tolerance ? 'an' : 'aus'}
            options={[
              { value: 'an', label: 'Zählen' },
              { value: 'aus', label: 'Nur der beste' },
            ]}
            onChange={(v) => set({ tolerance: v === 'an' })}
          />
          <p class="muted small">Zählen heißt: Züge, die höchstens 10 Prozentpunkte Gewinnchance unter dem besten liegen, sind richtig.</p>
        </div>
        <div class="field">
          <label>Neue Aufgaben pro Tag</label>
          <Segmented
            label="Neue Aufgaben pro Tag"
            value={s.newPerDay}
            options={[5, 10, 15, 25].map((v) => ({ value: v, label: String(v) }))}
            onChange={(v) => set({ newPerDay: v })}
          />
        </div>
        <div class="field">
          <label>Tagesziel</label>
          <Segmented
            label="Tagesziel in Minuten"
            value={s.goalMinutes}
            options={[10, 15, 20, 30].map((v) => ({ value: v, label: `${v} Min` }))}
            onChange={(v) => set({ goalMinutes: v })}
          />
        </div>
      </div>

      <div class="card">
        <h2>Auswahl eingrenzen</h2>
        <div class="field">
          <label for="f-phase">Partiephase</label>
          <select id="f-phase" value={s.filters.phase} onChange={(e) => setFilter({ phase: (e.target as HTMLSelectElement).value })}>
            {phases.map((p) => (
              <option key={p} value={p}>
                {p === 'alle' ? 'Alle' : p}
              </option>
            ))}
          </select>
        </div>
        <div class="field">
          <label for="f-cat">Fehlerart</label>
          <select id="f-cat" value={s.filters.cat} onChange={(e) => setFilter({ cat: (e.target as HTMLSelectElement).value })}>
            {cats.map((p) => (
              <option key={p} value={p}>
                {p === 'alle' ? 'Alle' : p}
              </option>
            ))}
          </select>
        </div>
        <div class="field">
          <label for="f-motif">Motiv</label>
          <select id="f-motif" value={s.filters.motif} onChange={(e) => setFilter({ motif: (e.target as HTMLSelectElement).value })}>
            {motifs.map((p) => (
              <option key={p} value={p}>
                {p === 'alle' ? 'Alle' : p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hiddenCount(state) > 0 && (
        <div class="card">
          <h2>Ausgeblendete Aufgaben</h2>
          <p class="muted">
            {hiddenCount(state) === 1 ? '1 Aufgabe wird' : `${n0(hiddenCount(state))} Aufgaben werden`} nicht mehr gezeigt.
          </p>
          <button
            class="btn secondary"
            onClick={() =>
              update((st) => {
                const ts = Date.now();
                return { ...st, hidden: Object.fromEntries(Object.entries(st.hidden).map(([id]) => [id, { on: false, ts }])) };
              })
            }
          >
            Alle wieder einblenden
          </button>
        </div>
      )}

      <SoundCard />

      <div class="card">
        <h2>Darstellung</h2>
        <Segmented<ThemeSetting>
          label="Darstellung"
          value={s.theme}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Hell' },
            { value: 'dark', label: 'Dunkel' },
          ]}
          onChange={(v) => set({ theme: v })}
        />
      </div>

      <div class="card">
        <h2>Sicherung</h2>
        <p class="muted">Dein Fortschritt liegt nur auf diesem Gerät. Exportiere ihn regelmäßig, zum Beispiel einmal pro Woche.</p>
        <div class="actions row">
          <button class="btn secondary" onClick={doExport}>
            Sicherung exportieren
          </button>
          <label class="btn secondary file">
            Datei wählen
            <input type="file" accept="application/json,.json" onChange={onFile} />
          </label>
        </div>
        <button class="link" onClick={() => setShowText(!showText)}>
          {showText ? 'Textfeld ausblenden' : 'Sicherung als Text einfügen'}
        </button>
        {showText && (
          <div class="field">
            <textarea
              id="import-text"
              rows={6}
              value={text}
              placeholder="Sicherungstext hier einfügen"
              onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
              aria-label="Sicherungstext"
            />
            <button class="btn secondary" onClick={doImport} disabled={!text.trim()}>
              Wiederherstellen
            </button>
          </div>
        )}
        {msg && (
          <p class="notice" role="status">
            {msg}
          </p>
        )}
      </div>

      <div class="card">
        <h2>Zurücksetzen</h2>
        {!confirmReset ? (
          <button class="btn danger" onClick={() => setConfirmReset(true)}>
            Trainingsstand löschen
          </button>
        ) : (
          <div>
            <p>Das löscht alle Wiederholungsdaten und den Verlauf auf diesem Gerät. Die Einstellungen bleiben.</p>
            <div class="actions row">
              <button
                class="btn danger"
                onClick={() => {
                  const keep = state.settings;
                  saveActive(null);
                  replaceState({ ...emptyState(), settings: keep, settingsTs: state.settingsTs, hidden: state.hidden, epoch: Date.now() });
                  setConfirmReset(false);
                  setMsg('Trainingsstand gelöscht.');
                }}
              >
                Ja, löschen
              </button>
              <button class="btn secondary" onClick={() => setConfirmReset(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>

      <p class="muted small center">
        {n0(exercises.length)} Übungen · Datenstand {new Date(generated).toLocaleDateString('de-DE')}
        <br />
        Road to GM · Version 1.1 · Stand {new Date(__BUILD__).toLocaleString('de-DE', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>
    </section>
  );
}
