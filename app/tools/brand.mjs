// Marke "Big Dog": Bulldoggen-König (App-Symbol, Startbild) und Bulldoggen-Bauer/-König als Brettfiguren.
// Eine Quelle für alles: Brettfiguren (src/assets/pieces, nur der König), Zeichen fürs Startbild (src/assets/brand), App-Symbole (public/icons).
// Aufruf: node tools/brand.mjs   (Playwright mit Chromium für die PNG-Symbole)
// Entwürfe und Herleitung: design/logo-optionen/runde2
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const APP = new URL('../', import.meta.url).pathname;
const GREEN = '#1d6b58';
const GOLD = '#f0c44a';

// Farbschemata: Fläche, Linien, Zähne/Nieten, optionaler Rand
const PAL = {
  logo: { fill: '#17211d', line: '#e6efea', tooth: '#ffffff', outline: '#e6efea', r: 5 },
  white: { fill: '#ffffff', line: '#1c2420', tooth: '#ffffff', outline: '#1c2420', r: 9 },
  black: { fill: '#1f2724', line: '#eef3f0', tooth: '#ffffff', outline: null, r: 0 },
};

// Frontaler Bulldoggenkopf: breiter Schädel, Rosenohren, schwere Brauen, Nasenfalte, Lefzen, Unterbiss mit Fangzähnen
const bullHead = ({ fill: F, line: L, tooth: T }) => `
  <path d="M194 110 C176 100 156 96 132 98 C136 116 146 132 166 142 C174 130 182 120 194 116 Z" fill="${F}" stroke="${L}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M318 110 C336 100 356 96 380 98 C376 116 366 132 346 142 C338 130 330 120 318 116 Z" fill="${F}" stroke="${L}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M256 96 C226 96 198 100 182 112 C164 126 158 150 160 176 C162 196 154 212 148 228 C140 248 150 266 172 274
           C198 284 228 288 256 288 C284 288 314 284 340 274 C362 266 372 248 364 228 C358 212 350 196 352 176
           C354 150 348 126 330 112 C314 100 286 96 256 96 Z" fill="${F}"/>
  <path d="M144 104 C152 114 160 120 172 122 M368 104 C360 114 352 120 340 122" stroke="${L}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M256 118 V146 M228 126 q28 -12 56 0 M236 110 q20 -8 40 0" stroke="${L}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M190 150 L234 162 M322 150 L278 162" stroke="${L}" stroke-width="9" stroke-linecap="round"/>
  <path d="M200 170 C206 162 222 162 228 170 C222 177 206 177 200 170 Z M312 170 C306 162 290 162 284 170 C290 177 306 177 312 170 Z" fill="${L}"/>
  <path d="M222 186 q34 -16 68 0" stroke="${L}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
  <path d="M232 198 C232 186 280 186 280 198 C280 212 268 218 256 218 C244 218 232 212 232 198 Z" fill="${L}"/>
  <path d="M256 218 V232 M190 256 C210 238 234 232 256 232 C278 232 302 238 322 256" stroke="${L}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M184 226 C176 240 178 254 190 262 M328 226 C336 240 334 254 322 262" stroke="${L}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M222 256 L229 230 L238 254 Z M274 254 L283 230 L290 256 Z" fill="${T}" stroke="${L}" stroke-width="3.5" stroke-linejoin="round"/>`;

const collar = ({ line: L, tooth: T }, y, x1, x2) => {
  const studs = [];
  for (let x = x1 + 24; x <= x2 - 20; x += 28) studs.push(`<circle cx="${x}" cy="${y + 13}" r="5.5" fill="${T}" stroke="${L}" stroke-width="3"/>`);
  return `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="26" rx="10" fill="${GOLD}" stroke="${L}" stroke-width="5"/>
    <path d="M${x1 + 2} ${y + 4} L${x1 - 28} ${y + 13} L${x1 + 2} ${y + 22} Z M${x2 - 2} ${y + 4} L${x2 + 28} ${y + 13} L${x2 - 2} ${y + 22} Z" fill="${GOLD}" stroke="${L}" stroke-width="3.5" stroke-linejoin="round"/>
    ${studs.join('')}`;
};

const king = (p) => `
  <path d="M200 300 C194 340 180 370 166 390 H346 C332 370 318 340 312 300 Z" fill="${p.fill}"/>
  <rect x="160" y="384" width="192" height="24" rx="11" fill="${p.fill}" stroke="${p.line}" stroke-width="6"/>
  <rect x="136" y="410" width="240" height="40" rx="16" fill="${p.fill}" stroke="${p.line}" stroke-width="6"/>
  ${collar(p, 294, 186, 326)}
  ${bullHead(p)}
  <path d="M206 108 L200 62 L228 84 L256 54 L284 84 L312 62 L306 108 Z" fill="${GOLD}" stroke="${p.line}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M256 22 V54 M244 34 H268" stroke="${GOLD}" stroke-width="9" stroke-linecap="round"/>`;

// Rand um die ganze Figur (für Kontrast auf jedem Untergrund)
const outlined = (p, body, id) =>
  p.outline
    ? `<defs><filter id="${id}" x="-15%" y="-15%" width="130%" height="130%"><feMorphology in="SourceAlpha" operator="dilate" radius="${p.r}" result="d"/><feFlood flood-color="${p.outline}"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#${id})">${body}</g>`
    : body;

const svg = (viewBox, inner, size = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${size}>${inner}</svg>\n`;

// Brettfiguren: nur der König ist eine Bulldogge, der Bauer bleibt klassisch (sonst sind beide im Blitz kaum zu unterscheiden)
const PIECE_BOX = { K: '13 -9 486 486' };
const pieces = {
  'wK.svg': svg(PIECE_BOX.K, outlined(PAL.white, king(PAL.white), 'o')),
  'bK.svg': svg(PIECE_BOX.K, outlined(PAL.black, king(PAL.black), 'o')),
};
for (const [name, s] of Object.entries(pieces)) writeFileSync(`${APP}src/assets/pieces/${name}`, s);

// Zeichen fürs Startbild und als Wasserzeichen: schwarzer König mit hellem Rand, ohne Hintergrund
writeFileSync(`${APP}src/assets/brand/king.svg`, svg('104 4 304 464', outlined(PAL.logo, king(PAL.logo), 'o')));

// App-Symbol: schwarzer König auf Grün. Maskierbare Fassung kleiner (Sicherheitszone).
const icon = (rx, scale = 1) =>
  svg(
    '0 0 512 512',
    `<rect width="512" height="512" rx="${rx}" fill="${GREEN}"/><g transform="translate(256 256) scale(${scale}) translate(-256 -244)">${outlined(PAL.logo, king(PAL.logo), 'o')}</g>`,
    ' width="512" height="512"',
  );
mkdirSync(`${APP}public/icons`, { recursive: true });
writeFileSync(`${APP}public/icons/favicon.svg`, icon(112, 0.88));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
async function png(name, size, rx, scale) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${icon(rx, scale)}`);
  await page.screenshot({ path: `${APP}public/icons/${name}` });
}
await png('icon-512.png', 512, 0, 0.88);
await png('icon-192.png', 192, 0, 0.88);
await png('apple-touch-icon.png', 180, 0, 0.88);
await png('icon-512-maskable.png', 512, 0, 0.74);
await browser.close();
console.log('Figuren, Zeichen und Symbole geschrieben');
