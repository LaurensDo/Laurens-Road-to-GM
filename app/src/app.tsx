import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { loadData, type Loaded } from './lib/data';
import { loadState, useAppState } from './lib/store';
import { usePrefs } from './lib/device';
import { initSync } from './lib/syncRunner';
import { installAudioUnlock, play } from './lib/sound';
import { Progress } from './views/Progress';
import { Splash } from './views/Splash';
import { Settings } from './views/Settings';
import { Today } from './views/Today';
import { Trainer } from './views/Trainer';

type Tab = 'today' | 'progress' | 'settings';

const ICONS: Record<Tab, string> = {
  today: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  progress: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  settings:
    'M4 6h3m4 0h9M4 12h9m4 0h3M4 18h3m4 0h9M9 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M15 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M9 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
};
const LABELS: Record<Tab, string> = { today: 'Heute', progress: 'Fortschritt', settings: 'Einstellungen' };

export function App() {
  const state = useAppState();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [training, setTraining] = useState(false);
  const [stateReady, setStateReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const prefs = usePrefs();

  useEffect(() => {
    void loadState().then(() => {
      initSync();
      setStateReady(true);
    });
    loadData()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  // Ton: beim ersten Tippen freischalten, danach leiser Klick bei Auswahl in der Oberfläche
  useEffect(() => {
    installAudioUnlock();
    const onClick = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.('button, a, summary, select, label, [role="radio"], input[type="checkbox"]');
      if (!el || el.closest('[data-nosound], .cg-wrap')) return;
      if ((el as HTMLButtonElement).disabled) return;
      play('ui');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Das Startbild ist weg: die Startfarbe aus index.html freigeben
  const showSplash = prefs.splash && !splashDone && !error;
  useEffect(() => {
    if (!showSplash) document.documentElement.style.background = '';
  }, [showSplash]);

  // Darstellung (System, Hell, Dunkel)
  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state.settings.theme);
  }, [state.settings.theme]);

  let content: ComponentChildren;
  if (error) {
    content = (
      <main class="screen">
        <div class="card">
          <h2>Daten konnten nicht geladen werden</h2>
          <p class="muted">{error}</p>
          <button class="btn" onClick={() => location.reload()}>
            Erneut versuchen
          </button>
        </div>
      </main>
    );
  } else if (!data) {
    content = showSplash ? null : (
      <main class="screen center">
        <p class="muted">Lade Übungen …</p>
      </main>
    );
  } else if (training) {
    content = (
      <main>
        <Trainer exercises={data.exercises} byId={data.byId} onExit={() => setTraining(false)} />
      </main>
    );
  } else {
    content = (
      <>
        <main>
          {tab === 'today' && <Today exercises={data.exercises} meta={data.meta} onStart={() => setTraining(true)} onOpenSettings={() => setTab('settings')} />}
          {tab === 'progress' && <Progress exercises={data.exercises} byId={data.byId} meta={data.meta} />}
          {tab === 'settings' && <Settings exercises={data.exercises} generated={data.generated} />}
        </main>
        <nav class="tabbar" aria-label="Hauptnavigation">
          {(Object.keys(ICONS) as Tab[]).map((t) => (
            <button key={t} class={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d={ICONS[t]} />
              </svg>
              <span>{LABELS[t]}</span>
            </button>
          ))}
        </nav>
      </>
    );
  }

  // Das Startbild bleibt als erstes Element an derselben Stelle, damit es beim Laden der Daten nicht neu startet
  return (
    <>
      {showSplash && <Splash ready={stateReady && !!data} onDone={() => setSplashDone(true)} />}
      {content}
    </>
  );
}
