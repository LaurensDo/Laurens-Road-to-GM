// Screenshots der wichtigsten Ansichten in allen Geräteformaten. Aufruf: npx vite preview --port 4173 &  node tools/layouts.mjs [Ordner]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4173/Laurens-Road-to-GM/';
const OUT = process.argv[2] ?? '/tmp/layouts';
mkdirSync(OUT, { recursive: true });
const FORMATS = {
  'iphone-hoch': { width: 390, height: 844 },
  'iphone-quer': { width: 844, height: 390 },
  'iphone-max-quer': { width: 932, height: 430 },
  'ipad-hoch': { width: 820, height: 1180 },
  'ipad-mini-hoch': { width: 744, height: 1133 },
  'ipad-quer': { width: 1180, height: 820 },
};
const only = process.argv[3]?.split(',');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const [name, vp] of Object.entries(FORMATS)) {
  if (only && !only.includes(name)) continue;
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: 'light', hasTouch: true, isMobile: vp.width < 700 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Tagesration');
  await page.screenshot({ path: `${OUT}/${name}-1-heute.png` });
  await page.click('text=/Training starten|Weiter üben|Satz starten|Nächster Satz/');
  await page.waitForSelector('.board-wrap[data-live="1"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${name}-2-aufgabe.png` });
  await page.click('text=Lösung zeigen');
  await page.waitForSelector('.result');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-3-ergebnis.png` });
  const b = await page.locator('.board').boundingBox();
  console.log(name, `Brett ${Math.round(b.width)}×${Math.round(b.height)} bei ${vp.width}×${vp.height}`);
  await ctx.close();
}
await browser.close();
