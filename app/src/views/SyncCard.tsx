import { useState } from 'preact/hooks';
import { connect, currentSetupCode, disconnect, parseSetupCode, syncNow, useSyncStatus } from '../lib/syncRunner';

export function ago(ts: number | null, now = Date.now()): string {
  if (!ts) return 'noch nicht';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'gerade eben';
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} Min`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Std`;
  return `vor ${Math.round(h / 24)} Tagen`;
}

export function SyncBadge({ onOpen }: { onOpen: () => void }) {
  const st = useSyncStatus();
  if (st.state === 'off') {
    return (
      <button class="link inline sync-hint" onClick={onOpen}>
        Mit iPhone und iPad abgleichen: jetzt einrichten
      </button>
    );
  }
  const bad = st.state === 'error';
  return (
    <button class={`link inline sync-hint ${bad ? 'bad' : ''}`} onClick={onOpen}>
      <i class={`dot ${st.state}`} />
      {st.state === 'syncing' ? 'Gleiche ab …' : bad ? 'Abgleich fehlgeschlagen' : st.state === 'offline' ? 'Offline, Abgleich später' : `Abgeglichen ${ago(st.last)}`}
    </button>
  );
}

export function SyncCard() {
  const st = useSyncStatus();
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const doConnect = async (r: string, t: string, path?: string) => {
    setBusy(true);
    setMsg(null);
    const res = await connect({ repo: r, token: t, path });
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      setToken('');
      setCode('');
      setShowCode(false);
    }
  };

  const useCode = () => {
    const parsed = parseSetupCode(code);
    if (!parsed) {
      setMsg({ ok: false, text: 'Das ist kein gültiger Einrichtungscode. Er beginnt mit rtgm1.' });
      return;
    }
    void doConnect(parsed.repo, parsed.token, parsed.path);
  };

  const copyCode = async () => {
    const c = currentSetupCode();
    if (!c) return;
    try {
      await navigator.clipboard.writeText(c);
      setMsg({ ok: true, text: 'Einrichtungscode kopiert. Füge ihn auf dem anderen Gerät ein. Er enthält dein Token, gib ihn nicht weiter.' });
    } catch {
      setCode(c);
      setShowCode(true);
      setMsg({ ok: true, text: 'Markiere den Code im Textfeld und kopiere ihn. Er enthält dein Token, gib ihn nicht weiter.' });
    }
  };

  const connected = st.state !== 'off';

  return (
    <div class="card">
      <h2>Synchronisation</h2>

      {!connected && (
        <>
          <p class="muted">
            Gleicht deinen Fortschritt automatisch zwischen iPhone und iPad ab. Er liegt dafür in einer Datei in einem <b>privaten</b> GitHub-Repository
            von dir.
          </p>
          <details class="howto">
            <summary>So richtest du es ein</summary>
            <ol>
              <li>
                Auf github.com: oben rechts <b>+</b>, <b>New repository</b>. Name zum Beispiel <span class="mono">road-to-gm-sync</span>, <b>Private</b> wählen, Haken bei{' '}
                <b>Add a README file</b>, <b>Create repository</b>.
              </li>
              <li>
                Auf github.com: Profilbild, <b>Settings</b>, ganz unten <b>Developer settings</b>, <b>Personal access tokens</b>, <b>Fine-grained tokens</b>,{' '}
                <b>Generate new token</b>. Name „Road to GM“, Ablauf möglichst lang. Bei <b>Repository access</b> <b>Only select repositories</b> und dein neues Repository wählen.
                Bei <b>Permissions</b>, <b>Repository permissions</b>, <b>Contents</b> auf <b>Read and write</b> stellen. Unten <b>Generate token</b> und das Token kopieren, es
                beginnt mit <span class="mono">github_pat_</span>. GitHub zeigt es nur einmal.
              </li>
              <li>Hier das Repository als <span class="mono">dein-name/road-to-gm-sync</span> eintragen, das Token einfügen und auf Verbinden tippen.</li>
              <li>
                Zweites Gerät: Auf dem ersten <b>Einrichtungscode kopieren</b>, auf dem zweiten bei „Einrichtungscode einfügen“ einfügen. Die Zwischenablage gilt auf iPhone und iPad
                gemeinsam.
              </li>
            </ol>
          </details>

          <div class="field">
            <label for="sync-repo">Repository</label>
            <input
              id="sync-repo"
              type="text"
              inputMode="text"
              autocomplete="off"
              autocapitalize="none"
              autocorrect="off"
              spellcheck={false}
              placeholder="dein-name/road-to-gm-sync"
              value={repo}
              onInput={(e) => setRepo((e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="field">
            <label for="sync-token">Token</label>
            <div class="pw">
              <input
                id="sync-token"
                class="mono"
                type={(show ? 'text' : 'password') as 'password'}
                autocomplete="off"
                autocapitalize="none"
                autocorrect="off"
                spellcheck={false}
                placeholder="github_pat_…"
                value={token}
                onInput={(e) => setToken((e.target as HTMLInputElement).value)}
              />
              <button type="button" class="link" onClick={() => setShow(!show)}>
                {show ? 'Verbergen' : 'Anzeigen'}
              </button>
            </div>
            <p class="muted small">Füge das Token mit langem Tippen und „Einsetzen“ ein. Abtippen führt leicht zu Zeichenverwechslungen.</p>
          </div>
          <button class="btn" disabled={busy || !repo.trim() || !token.trim()} onClick={() => doConnect(repo, token)}>
            {busy ? 'Prüfe …' : 'Verbinden'}
          </button>
          <button class="link" onClick={() => setShowCode(!showCode)}>
            {showCode ? 'Einrichtungscode ausblenden' : 'Einrichtungscode von meinem anderen Gerät einfügen'}
          </button>
          {showCode && (
            <div class="field">
              <textarea
                id="sync-code"
                rows={3}
                value={code}
                placeholder="rtgm1.…"
                autocapitalize="none"
                autocorrect="off"
                spellcheck={false}
                aria-label="Einrichtungscode"
                onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)}
              />
              <button class="btn secondary" disabled={busy || !code.trim()} onClick={useCode}>
                {busy ? 'Prüfe …' : 'Mit Code verbinden'}
              </button>
            </div>
          )}
        </>
      )}

      {connected && (
        <>
          <p>
            Verbunden mit <b class="mono">{st.repo}</b>
          </p>
          <p class={st.state === 'error' ? 'warn-text' : 'muted'} role="status">
            <i class={`dot ${st.state}`} />
            {st.state === 'syncing'
              ? 'Gleiche ab …'
              : st.state === 'error' || st.state === 'offline'
                ? st.message
                : `Zuletzt abgeglichen: ${ago(st.last)}`}
          </p>
          <div class="actions row">
            <button class="btn secondary" disabled={st.state === 'syncing'} onClick={() => void syncNow()}>
              Jetzt abgleichen
            </button>
            <button class="btn secondary" onClick={copyCode}>
              Einrichtungscode kopieren
            </button>
          </div>
          <p class="muted small">
            Der Abgleich läuft beim Öffnen der App, kurz nach dem Training und wenn du die App verlässt. Zum Einrichten des zweiten Geräts kopierst du den Code und fügst ihn dort ein.
          </p>
          {showCode && (
            <textarea rows={3} readOnly value={code} aria-label="Einrichtungscode" onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
          )}
          {!confirmOff ? (
            <button class="link" onClick={() => setConfirmOff(true)}>
              Verbindung trennen
            </button>
          ) : (
            <div>
              <p>Der Fortschritt bleibt auf diesem Gerät und im Repository. Das Token wird von diesem Gerät gelöscht.</p>
              <div class="actions row">
                <button
                  class="btn danger"
                  onClick={async () => {
                    await disconnect();
                    setConfirmOff(false);
                    setMsg(null);
                  }}
                >
                  Trennen
                </button>
                <button class="btn secondary" onClick={() => setConfirmOff(false)}>
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {msg && (
        <p class={msg.ok ? 'notice' : 'notice bad'} role="status">
          {msg.text}
        </p>
      )}
    </div>
  );
}
