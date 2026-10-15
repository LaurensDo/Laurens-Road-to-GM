// Logo-Optionen für "Road to GM" (Big-Dog-Theme). Zeichnet jede Variante als SVG und baut eine Übersicht als PNG.
// Aufruf: node design/logo-optionen/make.mjs   (Playwright mit Chromium nötig)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';

const OUT = new URL('./', import.meta.url).pathname;
const BG = '#1d6b58';
const W = '#ffffff';
const MINT = '#bfe3d4';
const GOLD = '#f0c44a';
const CORAL = '#f08a7e';

// Bauern-Körper wie im bisherigen App-Symbol
const pawnBody = (fill = W) => `
  <path d="M226 212 h60 l22 28 H204 z" fill="${fill}"/>
  <path d="M214 240 H298 C312 292 332 322 340 352 H172 C180 322 200 292 214 240 Z" fill="${fill}"/>
  <rect x="148" y="350" width="216" height="38" rx="12" fill="${fill}"/>
  <rect x="128" y="392" width="256" height="32" rx="14" fill="${fill}"/>`;
const mirror = (d) => d; // Hilfe nur zur Lesbarkeit: gespiegelte Pfade stehen ausgeschrieben

// Schlappohren (rechts und links gespiegelt)
const floppyEars = (stroke = BG) => `
  <path d="M290 132 C322 128 346 150 346 184 C346 202 338 214 326 212 C310 210 300 190 298 172 Z" fill="${W}" stroke="${stroke}" stroke-width="7" stroke-linejoin="round"/>
  <path d="M222 132 C190 128 166 150 166 184 C166 202 174 214 186 212 C202 210 212 190 214 172 Z" fill="${W}" stroke="${stroke}" stroke-width="7" stroke-linejoin="round"/>`;

// Sonnenbrille auf dem Bauernkopf
const shades = `
  <rect x="207" y="153" width="40" height="27" rx="11" fill="${BG}"/>
  <rect x="265" y="153" width="40" height="27" rx="11" fill="${BG}"/>
  <rect x="244" y="160" width="24" height="7" rx="3" fill="${BG}"/>
  <path d="M207 160 L198 154 M305 160 L314 154" stroke="${BG}" stroke-width="6" stroke-linecap="round"/>
  <path d="M216 175 L226 158 M274 175 L284 158" stroke="${W}" stroke-width="3.5" stroke-linecap="round" opacity="0.85"/>`;

const nose = (cy) => `<ellipse cx="256" cy="${cy}" rx="11" ry="8" fill="${BG}"/>`;

// Frontaler Hundekopf mit Schlappohren, Mittelpunkt (cx, cy), Maßstab s. Optionen: Sonnenbrille, Zunge, Brauen.
function dogHead({ cx, cy, s, shades = false, tongue = false, brows = false }) {
  const sw = 6 / s;
  const ear = (k) => `<path transform="scale(${k} 1)" d="M40 -50 C78 -58 104 -30 100 16 C98 46 82 62 68 58 C56 54 52 30 52 8 Z" fill="${W}" stroke="${BG}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  const eyes = shades
    ? `<rect x="-46" y="-23" width="40" height="26" rx="11" fill="${BG}"/><rect x="6" y="-23" width="40" height="26" rx="11" fill="${BG}"/>
       <rect x="-8" y="-17" width="16" height="6" rx="3" fill="${BG}"/>
       <path d="M-38 -2 L-30 -17 M14 -2 L22 -17" stroke="${W}" stroke-width="${3.4 / s * 1}" stroke-linecap="round" opacity="0.85"/>`
    : `<path d="M-36 -12 H-17 A9.5 9.5 0 0 1 -36 -12 Z" fill="${BG}"/><path d="M36 -12 H17 A9.5 9.5 0 0 0 36 -12 Z" fill="${BG}"/>
       ${brows ? '' : `<path d="M-42 -25 L-13 -17 M42 -25 L13 -17" stroke="${BG}" stroke-width="${7}" stroke-linecap="round"/>`}`;
  return `<g transform="translate(${cx} ${cy}) scale(${s})">
    <ellipse rx="66" ry="58" fill="${W}"/>${ear(1)}${ear(-1)}
    <ellipse cx="0" cy="22" rx="38" ry="28" fill="${MINT}"/>
    ${eyes}
    ${tongue ? `<path d="M-9 40 h18 v15 a9 9 0 0 1 -18 0 Z" fill="${CORAL}"/>` : ''}
    <path d="M-13 4 H13 L0 21 Z" fill="${BG}" stroke="${BG}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M0 21 V32 M-22 33 Q0 50 22 33" stroke="${BG}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
  </g>`;
}

const options = {
  A: {
    file: 'A-bauer-hundegesicht',
    title: 'A · Bauer mit Hundegesicht',
    text: 'Der Bauer bleibt, bekommt Schlappohren, Augen und Nase. Kleinste Änderung.',
    body: `<circle cx="256" cy="168" r="48" fill="${W}"/>${floppyEars()}
      <circle cx="238" cy="162" r="6.5" fill="${BG}"/><circle cx="274" cy="162" r="6.5" fill="${BG}"/>
      ${nose(184)}<path d="M256 192 v7 M245 203 q11 8 22 0" stroke="${BG}" stroke-width="4" fill="none" stroke-linecap="round"/>
      ${pawnBody()}`,
  },
  B: {
    file: 'B-bauer-sonnenbrille',
    title: 'B · Bauer mit Sonnenbrille',
    text: 'Kein Hund, nur Haltung: derselbe Bauer, aber mit Sonnenbrille und Grinsen.',
    body: `<circle cx="256" cy="168" r="48" fill="${W}"/>${shades}
      <path d="M236 195 q22 14 44 -4" stroke="${BG}" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${pawnBody()}`,
  },
  C: {
    file: 'C-bauer-hund-sonnenbrille',
    title: 'C · Bauer-Hund mit Sonnenbrille',
    text: 'Der Bauernkopf wird zum Hundekopf: Schlappohren, Schnauze, Sonnenbrille. Schach und Hund in einem.',
    body: `${dogHead({ cx: 256, cy: 160, s: 0.84, shades: true })}${pawnBody()}`,
  },
  D: {
    file: 'D-hund-bauernsockel',
    title: 'D · Hund auf Bauernsockel',
    text: 'Großer Hundekopf mit schwerem Blick und goldenem Halsband, darunter Körper und Sockel des Bauern.',
    body: `${dogHead({ cx: 256, cy: 156, s: 1.08 })}
      <rect x="196" y="232" width="120" height="26" rx="12" fill="${GOLD}" stroke="${BG}" stroke-width="6"/>
      <circle cx="222" cy="245" r="4" fill="${BG}"/><circle cx="256" cy="245" r="4" fill="${BG}"/><circle cx="290" cy="245" r="4" fill="${BG}"/>
      <path d="M222 260 H290 C298 306 320 332 338 352 H174 C192 332 214 306 222 260 Z" fill="${W}"/>
      <rect x="148" y="350" width="216" height="38" rx="12" fill="${W}"/><rect x="128" y="392" width="256" height="32" rx="14" fill="${W}"/>`,
  },
  E: {
    file: 'E-bulldogge-sonnenbrille',
    title: 'E · Bulldogge mit Sonnenbrille',
    text: 'Reiner Hund, groß und frontal: Sonnenbrille, Schlappohren, Zunge raus. Das Schach steckt im Namen.',
    body: `${dogHead({ cx: 256, cy: 246, s: 1.72, shades: true, tongue: true })}`,
  },
  F: {
    file: 'F-hund-mit-krone',
    title: 'F · Hund mit Krone',
    text: 'Der Boss: schwerer Blick, Krone wie beim König, goldene Kette. Big Dog als Schachfigur.',
    body: `${dogHead({ cx: 256, cy: 232, s: 1.3 })}
      <path d="M212 160 L206 100 L232 126 L256 88 L280 126 L306 100 L300 160 Z" fill="${GOLD}" stroke="${BG}" stroke-width="6" stroke-linejoin="round"/>
      <circle cx="206" cy="96" r="7" fill="${W}"/><circle cx="256" cy="84" r="7.5" fill="${W}"/><circle cx="306" cy="96" r="7" fill="${W}"/>
      <path d="M176 330 Q256 372 336 330" stroke="${GOLD}" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="1 20"/>
      <circle cx="256" cy="372" r="22" fill="${GOLD}" stroke="${BG}" stroke-width="6"/><circle cx="256" cy="372" r="9" fill="${BG}"/>`,
  },
};

const svgOf = (o, rx = 112) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="${rx}" fill="${BG}"/>${o.body}
</svg>`;

for (const o of Object.values(options)) writeFileSync(`${OUT}${o.file}.svg`, svgOf(o));
// Vergleich: das bisherige Symbol
const current = { file: '0-bisher-bauer', title: 'Bisher · Bauer', text: 'Zum Vergleich: das jetzige App-Symbol.', body: `<circle cx="256" cy="168" r="48" fill="${W}"/>${pawnBody()}` };
writeFileSync(`${OUT}${current.file}.svg`, svgOf(current));

const all = [current, ...Object.values(options)];
const sizes = [96, 64, 40, 28];
const splashMark = (o) => `<div class="sp"><svg viewBox="40 40 432 432" width="100%" height="100%">${o.body.replaceAll(BG, '#1d4f42')}</svg></div>`;
const cell = (o) => `
  <div class="cell">
    <div class="big">${svgOf(o).replace('width="512" height="512"', 'width="100%" height="100%"')}</div>
    <div class="row">${sizes.map((s) => `<div style="width:${s}px;height:${s}px">${svgOf(o, 112).replace('width="512" height="512"', 'width="100%" height="100%"')}</div>`).join('')}${splashMark(o)}</div>
    <h3>${o.title}</h3><p>${o.text}</p>
  </div>`;
const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;padding:36px;background:#f4f6f4;font:16px/1.45 'IBM Plex Sans',system-ui,sans-serif;color:#17201d;width:1600px}
  h1{font:700 34px 'Source Serif 4',Georgia,serif;margin:0 0 6px} .sub{color:#4a5752;margin:0 0 26px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
  .cell{background:#fff;border:1px solid #d9e0dc;border-radius:16px;padding:18px}
  .big{width:230px;height:230px;margin:0 auto 14px} .big svg{filter:drop-shadow(0 6px 14px rgba(8,30,24,.25))}
  .row{display:flex;gap:12px;align-items:flex-end;justify-content:center;margin-bottom:14px}
    .sp{width:96px;height:96px;border-radius:50%;padding:14px;box-sizing:border-box;background:radial-gradient(circle at 50% 40%,rgba(159,224,200,.22),rgba(159,224,200,0) 70%),radial-gradient(120% 90% at 50% 34%,#1d6b58,#0d2c24 70%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16)}
  h3{margin:0 0 4px;font:600 17px 'Source Serif 4',Georgia,serif} p{margin:0;color:#4a5752;font-size:14px}
</style><h1>Road to GM · Logo-Optionen</h1><p class="sub">Jeweils groß, in 96, 64, 40 und 28 Pixeln (28 entspricht dem Browser-Tab-Symbol) und als runde Figur auf dem Startbild (ganz rechts).</p>
<div class="grid">${all.map(cell).join('')}</div>`;
writeFileSync(`${OUT}uebersicht.html`, html);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1672, height: 900 }, deviceScaleFactor: 1.5 });
await page.setContent(html);
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}uebersicht.png`, fullPage: true });
// Einzelbilder
for (const o of all) {
  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(`<style>html,body{margin:0}svg{display:block}</style>${svgOf(o)}`);
  await page.screenshot({ path: `${OUT}${o.file}.png` });
}
await browser.close();
console.log('fertig:', all.map((o) => o.file).join(', '));
