/**
 * Anzeige-Info: hilft bei Darstellungsproblemen (z. B. iPad im Querformat). Zeichnet die Fenstergröße in den ersten Sekunden
 * nach dem Start auf und zeigt sie zusammen mit Bildschirm, Sicherheitsrändern und Modus.
 */
interface Snap {
  t: number;
  w: number;
  h: number;
  vw: number;
  vh: number;
  scale: number;
}

const timeline: Snap[] = [];
let t0 = 0;

const snap = (): Snap => {
  const vv = window.visualViewport;
  return {
    t: Math.round(performance.now() - t0),
    w: window.innerWidth,
    h: window.innerHeight,
    vw: Math.round((vv?.width ?? 0) * 10) / 10,
    vh: Math.round((vv?.height ?? 0) * 10) / 10,
    scale: Math.round((vv?.scale ?? 1) * 100) / 100,
  };
};

export function startDiag(): void {
  if (typeof window === 'undefined') return;
  t0 = performance.now();
  timeline.push(snap());
  for (const ms of [100, 300, 600, 1000, 2000]) window.setTimeout(() => timeline.push(snap()), ms);
  window.addEventListener('resize', () => {
    if (timeline.length < 40) timeline.push(snap());
  });
}

function insets(): string {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const s = getComputedStyle(probe);
  const out = `oben ${s.paddingTop}, rechts ${s.paddingRight}, unten ${s.paddingBottom}, links ${s.paddingLeft}`;
  probe.remove();
  return out;
}

interface Early {
  t: number;
  tag: string;
  w: number;
  h: number;
  ow: number;
  oh: number;
  sx: number;
  sy: number;
  vw: number;
  vh: number;
  vx: number;
  vy: number;
  rs: string;
}

function earlyLines(): string[] {
  const early = ((window as unknown as { __early?: Early[] }).__early ?? []).slice(0, 40);
  if (!early.length) return [];
  const paints = performance
    .getEntriesByType('paint')
    .map((p) => `${p.name} ${Math.round(p.startTime)} ms`)
    .join(', ');
  return [
    '',
    `Frühe Messung ab Seitenstart (ms seit Navigationsbeginn). App-Skript läuft ab ${Math.round(t0)} ms. Erstes Zeichnen: ${paints || 'unbekannt'}`,
    '  ms  Anlass         innen    außen    Position  sichtbar+Versatz  Seite',
    ...early.map(
      (e) =>
        `${String(e.t).padStart(5)}  ${e.tag.padEnd(14)} ${e.w}×${e.h}  ${e.ow}×${e.oh}  ${e.sx},${e.sy}  ${e.vw}×${e.vh}+${e.vx},${e.vy}  ${e.rs}`,
    ),
  ];
}

export function diagText(): string {
  const now = snap();
  const nav = navigator as Navigator & { standalone?: boolean };
  const lines = [
    `Fenster jetzt: ${now.w}×${now.h}, sichtbar ${now.vw}×${now.vh}, Zoom ${now.scale}`,
    `Bildschirm: ${screen.width}×${screen.height}, Pixeldichte ${window.devicePixelRatio}, ${screen.orientation?.type ?? 'Ausrichtung unbekannt'}`,
    `Sicherheitsränder: ${insets()}`,
    `Als App installiert: ${window.matchMedia('(display-mode: standalone)').matches || nav.standalone ? 'ja' : 'nein'}`,
    'Verlauf seit dem Start (ms: Fenster, sichtbar):',
    ...timeline.map((s) => `  ${String(s.t).padStart(5)}: ${s.w}×${s.h}, ${s.vw}×${s.vh}, Zoom ${s.scale}`),
    ...earlyLines(),
  ];
  return lines.join('\n');
}
