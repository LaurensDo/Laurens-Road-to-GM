// Aufruf: bash tools/e2e-update.sh
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mockGames } from './mock-games.mjs';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4176/Laurens-Road-to-GM/';
const OUT = process.argv[2] ?? '/tmp/e2e-update';
const DIST = process.argv[3] ?? 'dist-e2e-update';
mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (c, m) => { results.push(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rebuild = () => { execSync(`npx vite build --outDir ${DIST} --emptyOutDir`, { stdio: 'ignore' }); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await mockGames(ctx);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// Der Server liefert gleich nach dem Neubau kurz nichts: ein paar Versuche
const serverBuild = async () => {
  for (let i = 0; i < 10; i++) {
    try {
      return (await (await fetch(`${BASE}version.json?x=${Math.random()}`, { headers: { connection: 'close' } })).json()).build;
    } catch {
      await sleep(500);
    }
  }
  throw new Error('Server nicht erreichbar');
};
const runningBuild = async () => {
  await page.click('nav >> text=Einstellungen');
  await page.click('text=Anzeige-Info (bei Darstellungsproblemen)');
  await page.waitForFunction(() => /Build \S+/.test(document.querySelector('pre.diag')?.textContent ?? ''), null, { timeout: 5000 });
  const t = await page.locator('pre.diag').textContent();
  await page.click('nav >> text=Heute');
  return /Build (\S+)/.exec(t)?.[1];
};
const wake = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.addInitScript(() => {});
await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
await page.evaluate(() => localStorage.setItem('road-to-gm-device-v1', JSON.stringify({ splash: false })));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hero');
// auf dem Weg zur Kontrolle durch den Service Worker warten
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
const buildA = await runningBuild();
ok(buildA === (await serverBuild()), `Start: laufende Version = Server-Version (${buildA})`);

// 1. Neue Version auf Heute: lädt von selbst neu
await sleep(1200); // Build-Zeitstempel müssen sich unterscheiden
rebuild();
const buildB = await serverBuild();
ok(buildB > buildA, 'Neue Version liegt auf dem Server');
await page.evaluate(() => { window.__noReload = 1; });
const nav = page.waitForEvent('load', { timeout: 40000 });
await wake();
await nav.catch(() => null);
await page.waitForSelector('.hero', { timeout: 20000 });
ok(!(await page.evaluate(() => window.__noReload)), 'Seite wurde neu geladen');
ok((await runningBuild()) === buildB, 'Nach dem Neuladen läuft die neue Version');

// 2. Mitten im Satz: kein Neuladen, danach Hinweis
await sleep(1200);
rebuild();
const buildC = await serverBuild();
await page.click('text=/Satz starten|Satz fortsetzen/');
await page.waitForSelector('.board-wrap[data-live="1"]', { timeout: 15000 });
await page.evaluate(() => { window.__noReload = 1; });
await wake();
await sleep(6000);
ok(!!(await page.evaluate(() => window.__noReload)), 'Im Satz wird nicht neu geladen');
ok((await page.locator('.board-wrap').count()) === 1, 'Aufgabe bleibt offen');
await page.click('text=← Beenden');
await sleep(300);
if (await page.locator('.modal').count()) await page.click('text=Später weitermachen');
await page.waitForSelector('.hero');
await page.waitForSelector('.update-note', { timeout: 5000 });
ok(true, 'Nach dem Satz erscheint der Hinweis "Neue Version da"');
await page.screenshot({ path: `${OUT}/hinweis.png` });
const nav2 = page.waitForEvent('load', { timeout: 20000 });
await page.click('.update-note');
await nav2;
await page.waitForSelector('.hero');
ok((await runningBuild()) === buildC, 'Tippen auf den Hinweis lädt die neue Version');

// 3. Keine Endlosschleife: gleiche Version, kein erneutes Neuladen
await page.evaluate(() => { window.__noReload = 1; });
await wake();
await sleep(3000);
ok(!!(await page.evaluate(() => window.__noReload)), 'Bei gleicher Version kein Neuladen');
ok(errors.length === 0, `Keine Fehler ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
await browser.close();
console.log(results.join('\n'));
