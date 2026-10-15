// Erzeugt die App-Symbole (SVG und PNG) aus einer einfachen Bauernfigur.
// Aufruf: node tools/make-icons.mjs   (benötigt Playwright mit Chromium)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../public/icons/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const pawn = (scale = 1) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)" fill="#ffffff">
    <circle cx="256" cy="168" r="48"/>
    <path d="M226 212 h60 l22 28 H204 z"/>
    <path d="M214 240 H298 C312 292 332 322 340 352 H172 C180 322 200 292 214 240 Z"/>
    <rect x="148" y="350" width="216" height="38" rx="12"/>
    <rect x="128" y="392" width="256" height="32" rx="14"/>
  </g>`;

const svg = (rx, scale = 1) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="${rx}" fill="#1d6b58"/>${pawn(scale)}
</svg>`;

writeFileSync(OUT + 'favicon.svg', svg(112));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
async function png(name, size, scale) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg(0, scale)}`);
  await page.screenshot({ path: OUT + name, omitBackground: false });
}
await png('icon-512.png', 512, 1);
await png('icon-192.png', 192, 1);
await png('apple-touch-icon.png', 180, 1);
await png('icon-512-maskable.png', 512, 0.78); // Sicherheitsrand für runde Masken
await browser.close();
console.log('Symbole geschrieben nach', OUT);
