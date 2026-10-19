import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
const file = JSON.parse(readFileSync('/home/user/Laurens-Road-to-GM/app/public/data/exercises.json'));
const ids = (process.argv[2] ?? '').split(',');
const pick = ids.map((id) => file.exercises.find((x) => x.id === id));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => localStorage.setItem('road-to-gm-device-v1', JSON.stringify({ splash: false, sound: false, games: false })));
await ctx.route('**/data/exercises.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...file, exercises: pick }) }));
const page = await ctx.newPage();
await page.goto('http://localhost:4173/Laurens-Road-to-GM/', { waitUntil: 'networkidle' });
await page.locator('nav').getByText('Einstellungen').click();
await page.getByRole('radiogroup', { name: 'Letzter Zug des Gegners' }).getByRole('radio', { name: 'Nicht zeigen' }).click();
await page.locator('nav').getByText('Heute').click();
await page.click('text=/Satz starten|Satz fortsetzen/');
for (let i = 0; i < pick.length; i++) {
  await page.waitForSelector('.board-wrap[data-live="1"]');
  await page.waitForTimeout(500);
  const id = await page.getAttribute('.board-wrap', 'data-ex');
  const e = pick.find((x) => x.id === id);
  const white = e.turn === 'w';
  const box = await page.locator('.board cg-board').boundingBox();
  // erster Zug: Figur auf f8 antippen (nur zum Messen der Zielfelder)
  const pt = (sq) => { const f = sq.charCodeAt(0) - 97, r = Number(sq[1]) - 1; return { x: box.x + ((white ? f : 7 - f) + 0.5) * box.width / 8, y: box.y + ((white ? 7 - r : r) + 0.5) * box.height / 8 }; };
  if (id === '422923e9') {
    await page.mouse.click(pt('f8').x, pt('f8').y);
    await page.waitForTimeout(200);
    console.log('seq', i, id, 'selected', await page.locator('cg-board square.selected').count(), 'dests', await page.locator('cg-board square.move-dest, cg-board square.oc').count());
  } else {
    console.log('seq', i, id, 'turn', e.turn);
  }
  if (i < pick.length - 1) { await page.click('text=Lösung zeigen'); await page.waitForSelector('.result'); await page.getByRole('button', { name: 'Weiter', exact: true }).click(); }
}
await browser.close();
