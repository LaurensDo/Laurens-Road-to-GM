// Runde 2: Übersicht der Bulldoggen-Figuren, weiß und schwarz, in allen Größen und auf dem Startbild.
// Aufruf: node springer.mjs && node frontal.mjs && node uebersicht.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = new URL('./', import.meta.url).pathname;
const BG = '#1d6b58';
const BGRECT = '<rect width="512" height="512" rx="112" fill="#1d6b58"/>';
const DARK = '#17211d';
const LIGHT = '#e6efea';

const inner = (file) => {
  const svg = readFileSync(DIR + file, 'utf8');
  return svg.slice(svg.indexOf(BGRECT) + BGRECT.length, svg.lastIndexOf('</svg>'));
};
// Schwarze Figur: Fläche dunkel, Linien hell, Zähne und Nieten weiß, Gold bleibt; heller Rand um die ganze Figur
const darkify = (s) => s.replaceAll('#ffffff', '§D§').replaceAll(BG, LIGHT).replaceAll('§D§', DARK);
const OUTLINE = `<defs><filter id="ol" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="5" result="d"/><feFlood flood-color="${LIGHT}"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;

const pieces = [
  { id: '1', file: 'springer.svg', title: '1 · Bulldoggen-Springer', text: 'Der Springer ist die einzige Figur mit Tierkopf. Hier: flacher Schädel, kupiertes Ohr, Lefze, Fangzahn, Stachelhalsband.' },
  { id: '2', file: 'koenig.svg', title: '2 · Bulldoggen-König', text: 'Frontal, grimmig, Unterbiss mit Fangzähnen, Krone mit Kreuz. Big Dog als Chef auf dem Brett.' },
  { id: '3', file: 'bauer.svg', title: '3 · Bulldoggen-Bauer', text: 'Der bisherige Bauer, nur mit Bulldoggenkopf und Halsband. Die kleinste Änderung zur heutigen App.' },
];
const variants = [];
for (const p of pieces) {
  const w = inner(p.file);
  variants.push({ ...p, key: `${p.id}w`, label: `${p.title} (weiß)`, body: w, splash: w.replaceAll(BG, '#1d4f42') });
  if (p.id !== '3') {
    const d = `<g filter="url(#ol)">${darkify(w)}</g>`;
    variants.push({ ...p, key: `${p.id}s`, label: `${p.title} (schwarz)`, text: 'Dieselbe Figur als schwarzer Stein: wirkt bedrohlicher, braucht einen hellen Rand.', body: d, splash: d, dark: true });
  }
}
const svgOf = (v) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">${OUTLINE}${BGRECT}${v.body}</svg>`;
const splashOf = (v) => `<div class="sp"><svg viewBox="30 20 452 452" width="100%" height="100%">${OUTLINE}${v.splash}</svg></div>`;
const current = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">${readFileSync(DIR + '../0-bisher-bauer.svg', 'utf8').replace(/^<svg[^>]*>/, '').replace('</svg>', '')}</svg>`;
const sizes = [96, 64, 40, 28];
const cell = (title, text, big, small, sp) => `<div class="cell"><div class="big">${big}</div>
  <div class="row">${sizes.map((s) => `<div style="width:${s}px;height:${s}px">${small}</div>`).join('')}${sp}</div><h3>${title}</h3><p>${text}</p></div>`;
const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;padding:36px;background:#f4f6f4;font:16px/1.45 'IBM Plex Sans',system-ui,sans-serif;color:#17201d;width:1600px}
  h1{font:700 34px 'Source Serif 4',Georgia,serif;margin:0 0 6px} .sub{color:#4a5752;margin:0 0 26px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
  .cell{background:#fff;border:1px solid #d9e0dc;border-radius:16px;padding:18px}
  .big{width:250px;height:250px;margin:0 auto 14px} .big svg{filter:drop-shadow(0 6px 14px rgba(8,30,24,.25))}
  .row{display:flex;gap:12px;align-items:flex-end;justify-content:center;margin-bottom:14px}
  .sp{width:96px;height:96px;border-radius:50%;padding:10px;box-sizing:border-box;background:radial-gradient(circle at 50% 40%,rgba(159,224,200,.22),rgba(159,224,200,0) 70%),radial-gradient(120% 90% at 50% 34%,#1d6b58,#0d2c24 70%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16)}
  h3{margin:0 0 4px;font:600 17px 'Source Serif 4',Georgia,serif} p{margin:0;color:#4a5752;font-size:14px}
</style><h1>Road to GM · Logo-Optionen, Runde 2: Big Dog als Schachfigur</h1>
<p class="sub">Bullige Hunde, die selbst als Figur funktionieren. Jeweils groß, in 96, 64, 40 und 28 Pixeln und als runde Figur auf dem Startbild (ganz rechts).</p>
<div class="grid">
${cell('Bisher · Bauer', 'Zum Vergleich: das jetzige App-Symbol.', current, current, '')}
${variants.map((v) => cell(v.label, v.text, svgOf(v), svgOf(v), splashOf(v))).join('\n')}
</div>`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 1672, height: 900 }, deviceScaleFactor: 1.5 });
await page.setContent(html);
await page.waitForTimeout(400);
await page.screenshot({ path: DIR + 'uebersicht-runde2.png', fullPage: true });
for (const v of variants) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${OUTLINE}${BGRECT}${v.body}</svg>`;
  writeFileSync(`${DIR}${v.key}.svg`, svg);
  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(`<style>html,body{margin:0}svg{display:block}</style>${svg}`);
  await page.screenshot({ path: `${DIR}${v.key}.png` });
}
await b.close();
console.log('fertig:', variants.map((v) => v.key).join(', '));
