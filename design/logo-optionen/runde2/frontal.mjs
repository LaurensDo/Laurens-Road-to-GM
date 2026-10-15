// Runde 2, Entwürfe 2 und 3: frontale Bulldogge als König und als Bauer. Nur zum Iterieren.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const BG = '#1d6b58', W = '#ffffff', GOLD = '#f0c44a', TOOTH = '#fffffe';

// Frontaler Bulldoggenkopf: breiter Schädel, Rosenohren, schwere Brauen, Nasenfalte, Lefzen, Unterbiss mit Fangzähnen
export const bullHead = `
  <path d="M194 110 C176 100 156 96 132 98 C136 116 146 132 166 142 C174 130 182 120 194 116 Z" fill="${W}" stroke="${BG}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M318 110 C336 100 356 96 380 98 C376 116 366 132 346 142 C338 130 330 120 318 116 Z" fill="${W}" stroke="${BG}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M256 96 C226 96 198 100 182 112 C164 126 158 150 160 176 C162 196 154 212 148 228 C140 248 150 266 172 274
           C198 284 228 288 256 288 C284 288 314 284 340 274 C362 266 372 248 364 228 C358 212 350 196 352 176
           C354 150 348 126 330 112 C314 100 286 96 256 96 Z" fill="${W}"/>
  <path d="M144 104 C152 114 160 120 172 122" stroke="${BG}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M368 104 C360 114 352 120 340 122" stroke="${BG}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <!-- Stirnfalten -->
  <path d="M256 118 V146 M228 126 q28 -12 56 0 M236 110 q20 -8 40 0" stroke="${BG}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <!-- Brauen und Augen -->
  <path d="M190 150 L234 162 M322 150 L278 162" stroke="${BG}" stroke-width="9" stroke-linecap="round"/>
  <path d="M200 170 C206 162 222 162 228 170 C222 177 206 177 200 170 Z M312 170 C306 162 290 162 284 170 C290 177 306 177 312 170 Z" fill="${BG}"/>
  <!-- Nasenfalte und Nase -->
  <path d="M222 186 q34 -16 68 0" stroke="${BG}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
  <path d="M232 198 C232 186 280 186 280 198 C280 212 268 218 256 218 C244 218 232 212 232 198 Z" fill="${BG}"/>
  <!-- Lefzen, Maul, Unterbiss -->
  <path d="M256 218 V232 M190 256 C210 238 234 232 256 232 C278 232 302 238 322 256" stroke="${BG}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M184 226 C176 240 178 254 190 262 M328 226 C336 240 334 254 322 262" stroke="${BG}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M222 256 L229 230 L238 254 Z M274 254 L283 230 L290 256 Z" fill="${TOOTH}" stroke="${BG}" stroke-width="3.5" stroke-linejoin="round"/>`;

const spikedCollar = (y, x1, x2) => {
  const studs = [];
  for (let x = x1 + 24; x <= x2 - 20; x += 28) studs.push(`<circle cx="${x}" cy="${y + 13}" r="5.5" fill="${TOOTH}" stroke="${BG}" stroke-width="3"/>`);
  return `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="26" rx="10" fill="${GOLD}" stroke="${BG}" stroke-width="5"/>
    <path d="M${x1 + 2} ${y + 4} L${x1 - 28} ${y + 13} L${x1 + 2} ${y + 22} Z M${x2 - 2} ${y + 4} L${x2 + 28} ${y + 13} L${x2 - 2} ${y + 22} Z" fill="${GOLD}" stroke="${BG}" stroke-width="3.5" stroke-linejoin="round"/>
    ${studs.join('')}`;
};

export const koenig = `
  <path d="M200 300 C194 340 180 370 166 390 H346 C332 370 318 340 312 300 Z" fill="${W}"/>
  <rect x="160" y="384" width="192" height="24" rx="11" fill="${W}" stroke="${BG}" stroke-width="6"/>
  <rect x="136" y="410" width="240" height="40" rx="16" fill="${W}" stroke="${BG}" stroke-width="6"/>
  ${spikedCollar(294, 186, 326)}
  ${bullHead}
  <path d="M206 108 L200 62 L228 84 L256 54 L284 84 L312 62 L306 108 Z" fill="${GOLD}" stroke="${BG}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M256 22 V54 M244 34 H268" stroke="${GOLD}" stroke-width="9" stroke-linecap="round"/>
  <path d="M256 22 V54 M244 34 H268" stroke="${BG}" stroke-width="2" stroke-linecap="round" opacity="0"/>`;

export const bauer = `
  <path d="M214 270 H298 C312 326 334 360 344 384 H168 C178 360 200 326 214 270 Z" fill="${W}"/>
  <rect x="148" y="380" width="216" height="36" rx="12" fill="${W}" stroke="${BG}" stroke-width="6"/>
  <rect x="128" y="418" width="256" height="30" rx="14" fill="${W}" stroke="${BG}" stroke-width="6"/>
  <g transform="translate(256 176) scale(0.8) translate(-256 -190)">${bullHead}</g>
  ${spikedCollar(254, 194, 318)}`;

const wrap = (inner, dy) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" rx="112" fill="${BG}"/><g transform="translate(0 ${dy})">${inner}</g></svg>`;
const out = { koenig: wrap(koenig, 12), bauer: wrap(bauer, 0) };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 512, height: 512 } });
for (const [n, svg] of Object.entries(out)) {
  writeFileSync(new URL(`./${n}.svg`, import.meta.url), svg);
  await p.setContent(`<style>html,body{margin:0}svg{display:block}</style>${svg}`);
  await p.screenshot({ path: new URL(`./${n}.png`, import.meta.url).pathname });
}
await b.close();
