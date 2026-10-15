// Ende-zu-Ende-Test im Handy-Format: Training starten, Aufgabe lösen, Neuladen, Offline-Betrieb.
// Aufruf: npx vite preview --port 4173 &  dann  node tools/e2e.mjs [Ausgabeordner]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4173/Laurens-Road-to-GM/';
const OUT = process.argv[2] ?? '/tmp/e2e';
mkdirSync(OUT, { recursive: true });
const data = JSON.parse(readFileSync(new URL('../public/data/exercises.json', import.meta.url)));
const ex = data.exercises[0];

const log = [];
const ok = (cond, msg) => { log.push(`${cond ? 'OK  ' : 'FAIL'} ${msg}`); if (!cond) process.exitCode = 1; };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('text=Tagesration');
await page.screenshot({ path: `${OUT}/1-heute.png` });
ok(await page.locator('text=Training starten').count() === 1, 'Heute zeigt "Training starten"');

await page.click('text=Training starten');
await page.waitForSelector('.board cg-board');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/2-aufgabe.png` });
const side = await page.textContent('.side');
ok(side.includes(ex.turn === 'w' ? 'Weiß' : 'Schwarz'), `Seite am Zug stimmt (${side})`);

// Besten Zug per Tippen ausführen: Figur, dann Zielfeld
const best = ex.lines[0];
const from = best.uci.slice(0, 2), to = best.uci.slice(2, 4);
const box = await page.locator('.board cg-board').boundingBox();
const white = ex.turn === 'w';
const pt = (sq) => {
  const f = sq.charCodeAt(0) - 97, r = Number(sq[1]) - 1;
  const col = white ? f : 7 - f, row = white ? 7 - r : r;
  return { x: box.x + (col + 0.5) * box.width / 8, y: box.y + (row + 0.5) * box.height / 8 };
};
await page.mouse.click(pt(from).x, pt(from).y);
await page.waitForTimeout(150);
await page.mouse.click(pt(to).x, pt(to).y);
await page.waitForSelector('.result', { timeout: 5000 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/3-ergebnis.png`, fullPage: true });
const verdict = await page.textContent('.verdict-row .chip');
ok(/Richtig/.test(verdict), `Bester Zug ${best.san} wird als richtig gewertet (${verdict})`);

await page.click('text=Weiter');
await page.waitForSelector('.board cg-board');
await page.waitForTimeout(300);
// Zweite Aufgabe per Ziehen lösen (gleiche Auswahlregel wie die App: erste neue mit anderer Fehlerart)
const rest = data.exercises.slice(1, 9);
const ex2 = rest.find((e) => e.cat !== ex.cat) ?? rest[0];
const white2 = ex2.turn === 'w';
const box2 = await page.locator('.board cg-board').boundingBox();
const pt2 = (sq) => {
  const f = sq.charCodeAt(0) - 97, r = Number(sq[1]) - 1;
  const col = white2 ? f : 7 - f, row = white2 ? 7 - r : r;
  return { x: box2.x + (col + 0.5) * box2.width / 8, y: box2.y + (row + 0.5) * box2.height / 8 };
};
const b2 = ex2.lines[0];
const a = pt2(b2.uci.slice(0, 2)), z = pt2(b2.uci.slice(2, 4));
await page.mouse.move(a.x, a.y);
await page.mouse.down();
await page.mouse.move((a.x + z.x) / 2, (a.y + z.y) / 2, { steps: 6 });
await page.mouse.move(z.x, z.y, { steps: 6 });
await page.mouse.up();
if (b2.san.includes('=')) { await page.waitForSelector('.promo'); await page.click('.promo >> text=Dame'); }
await page.waitForSelector('.result', { timeout: 5000 });
const verdict2 = await page.textContent('.verdict-row .chip');
ok(/Richtig/.test(verdict2), `Zweite Aufgabe per Ziehen gelöst: ${b2.san} (${verdict2})`);
await page.screenshot({ path: `${OUT}/3b-ziehen.png`, fullPage: true });
await page.click('text=Weiter');
await page.waitForSelector('.board cg-board');
await page.click('text=Lösung zeigen');
await page.waitForSelector('.result');
const verdict3 = await page.textContent('.verdict-row .chip');
ok(/Lösung angezeigt/.test(verdict3), 'Lösung zeigen wird als nicht gelöst gewertet');
await page.screenshot({ path: `${OUT}/4-loesung.png`, fullPage: true });
await page.click('text=Variante ansehen');
await page.click('[aria-label="Ein Zug vor"]');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/5-variante.png`, fullPage: true });
await page.click('text=Diese Aufgabe nicht mehr zeigen');
await page.waitForSelector('.board cg-board');
await page.click('text=Beenden');
await page.waitForSelector('text=Tagesration');

// Speicherung: neu laden, Stand bleibt
await page.waitForTimeout(500);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('text=Tagesration');
const doneText = await page.locator('text=Heute erledigt').locator('..').textContent();
ok(/3/.test(doneText), `Fortschritt bleibt nach dem Neuladen erhalten (${doneText.replace(/\s+/g, ' ').slice(0, 60)})`);

await page.click('nav >> text=Fortschritt');
await page.waitForSelector('text=Letzte 14 Tage');
await page.screenshot({ path: `${OUT}/6-fortschritt.png`, fullPage: true });
await page.click('nav >> text=Einstellungen');
await page.waitForSelector('text=Sicherung');
ok(await page.locator('text=Ausgeblendete Aufgaben').count() === 1, 'Ausgeblendete Aufgabe wird in den Einstellungen gezählt');
await page.screenshot({ path: `${OUT}/7-einstellungen.png`, fullPage: true });

// Dunkelmodus
await page.emulateMedia({ colorScheme: 'dark' });
await page.click('nav >> text=Heute');
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/8-heute-dunkel.png` });

// Offline
await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
await page.waitForTimeout(1500);
await ctx.setOffline(true);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('text=Tagesration', { timeout: 8000 });
ok(true, 'App startet offline');
await page.click('text=Weiter üben');
await page.waitForSelector('.board cg-board', { timeout: 8000 });
ok(true, 'Training läuft offline');
await ctx.setOffline(false);

ok(errors.length === 0, `Keine Konsolenfehler ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
await browser.close();
console.log(log.join('\n'));
