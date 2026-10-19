// Prüft die Uhr-Schleife: Partien holen (chess.com und lichess, nachgebaut), Karte auf Heute, Uhr unter Fortschritt, Offline, Ausschalten.
// Aufruf: npx vite preview --port 4173 --strictPort &  node tools/e2e-games.mjs [Ausgabeordner]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { chesscomGame, lichessGame, mockGames } from './mock-games.mjs';

const BASE = 'http://localhost:4173/Laurens-Road-to-GM/';
const OUT = process.argv[2] ?? '/tmp/e2e-games';
mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (c, m) => { results.push(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };

const now = Date.now();
const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
const yesterday = d0.getTime() - 2 * 3600 * 1000; // gestern 22 Uhr
const A = chesscomGame({ id: 1001, end: now - 5 * 60000, color: 'b', mine: 'timeout', theirs: 'win', spentMine: () => 4 });
const B = chesscomGame({ id: 1002, end: yesterday, color: 'w', spentMine: (k) => (k === 23 ? 25 : 2) });
const C = chesscomGame({ id: 1003, end: Date.parse('2026-10-15T06:00:00Z'), spentMine: () => 3 }); // älter als gestern, aber nach dem Stichtag
const L = lichessGame({ id: 'abcd1234', end: now - 3600000, color: 'w', winner: 'black', spentMine: () => 1.5, spentOpp: () => 1 });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => localStorage.setItem('road-to-gm-device-v1', JSON.stringify({ splash: false, sound: false })));
const calls = await mockGames(ctx, { chesscom: [A, B, C], lichess: [L] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.hero');
const card = page.locator('.card', { has: page.locator('h2', { hasText: 'Deine Partien' }) });
await card.locator('.g-row').first().waitFor({ timeout: 8000 });
const text = (await card.textContent()).replace(/\s+/g, ' ');
ok(/Regel: Über 10 Sekunden nachgedacht/.test(text), 'Karte zeigt oben die Regel');
ok(/3\+0 seit gestern: 2 Partien/.test(text), `3+0 seit gestern: 2 Partien (${text.slice(60, 160)})`);
ok(/Zug 30 im Budget: 1 von 2/.test(text), 'Zug 30 im Budget: 1 von 2');
ok(/Bullet seit gestern: 1 Partie/.test(text) && /vor Zug 20 im Schnitt/.test(text), 'Bullet-Zeile mit Vorsprung vor Zug 20');
ok((await card.locator('.g-row').count()) === 3, 'Drei Partien in der Liste');
ok(calls.chesscom >= 1 && calls.lichess === 1, `Beide Quellen abgefragt (chess.com ${calls.chesscom}×, lichess ${calls.lichess}×)`);
const first = (await card.locator('.g-row').first().locator('summary').textContent()).replace(/\s+/g, ' ');
ok(/heute/.test(first) && /3\+0/.test(first) && /Niederlage/.test(first) && /Zug 20 ○/.test(first), `Neueste Partie zuerst, mit Budget-Marken: "${first}"`);
ok(!/✕|✗|×/.test(await card.textContent()), 'Keine roten Kreuze');

// Partie B aufklappen: längste Denkpause mit Mini-Brett
await card.locator('.g-row').nth(1).locator('summary').click();
const body = (await card.locator('.g-row').nth(1).locator('.g-body').textContent()).replace(/\s+/g, ' ');
ok(/Längste Denkpause: Zug 23, 25 s/.test(body), `Längste Denkpause genannt (${body.slice(0, 90)})`);
ok((await card.locator('.g-row').nth(1).locator('.miniboard cg-board').count()) === 1, 'Mini-Brett mit der Stellung');
ok((await card.locator('.g-row').nth(1).locator('a[href^="https://www.chess.com/game/live/"]').count()) === 1, 'Link zur Partie');
await page.screenshot({ path: `${OUT}/1-heute.png`, fullPage: true });

// Fortschritt
await page.locator('nav').getByText('Fortschritt').click();
const clock = page.locator('.card', { has: page.locator('h2', { hasText: 'Uhr in deinen Partien' }) });
const ct = (await clock.textContent()).replace(/\s+/g, ' ');
ok(/3\+0 seit dem 15\.10\.: 3 Partien, davon 3 mit Uhr vor Zug 30/.test(ct), `Uhr-Karte zählt die Partien (${ct.slice(0, 110)})`);
ok(/Noch 117 bis zur ersten Aussage/.test(ct), 'Noch 117 bis zur ersten Aussage');
ok(/Basis 74 s/.test(ct) && /Basis −11,3 s/.test(ct), 'Werte stehen neben der eingefrorenen Basis');
ok(!/besser als vorher|schlechter als vorher|im normalen Bereich/.test(ct), 'Vor der Mindestmenge kein Urteil');
ok(/Bullet \(lichess 1\+0\)/.test(ct) && /Noch 599 bis zur ersten Aussage/.test(ct), 'Bullet getrennt, mit eigener Mindestmenge');
await page.screenshot({ path: `${OUT}/2-fortschritt.png`, fullPage: true });

// Offline: Bestand bleibt, "Jetzt holen" meldet es ehrlich
await ctx.unrouteAll({ behavior: 'ignoreErrors' });
const off = await mockGames(ctx, { mode: 'offline' });
errors.length = 0;
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hero');
const card2 = page.locator('.card', { has: page.locator('h2', { hasText: 'Deine Partien' }) });
await card2.locator('.g-row').first().waitFor({ timeout: 5000 });
ok((await card2.locator('.g-row').count()) === 3, 'Nach dem Neuladen sind die Partien noch da (gespeichert)');
ok(off.chesscom === 0, 'Innerhalb von zehn Minuten wird nicht erneut geholt');
await card2.getByRole('button', { name: 'Jetzt holen' }).click();
await page.waitForSelector('text=Abruf fehlgeschlagen', { timeout: 8000 });
ok(/nicht erreichbar/.test((await card2.textContent()) ?? ''), 'Offline: verständliche Meldung, Partien bleiben');
ok((await card2.locator('.g-row').count()) === 3, 'Partien bleiben nach dem Fehler');

// Ausschalten in den Einstellungen: beim Öffnen wird nichts geholt
await page.locator('nav').getByText('Einstellungen').click();
await page.getByRole('radiogroup', { name: 'Partien holen' }).getByRole('radio', { name: 'Aus', exact: true }).click();
await ctx.unrouteAll({ behavior: 'ignoreErrors' });
const off2 = await mockGames(ctx, {});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hero');
await page.waitForTimeout(800);
ok(off2.chesscom === 0 && off2.lichess === 0, 'Bei "Aus" wird beim Öffnen nichts geholt');
await page.screenshot({ path: `${OUT}/3-aus.png`, fullPage: true });
// Bestand aus 1.5.0 (ohne Stand der Leselogik): lichess wird einmal ab dem Stichtag neu geholt, chess.com bleibt
await ctx.unrouteAll({ behavior: 'ignoreErrors' });
const urls = [];
await ctx.route('https://lichess.org/api/**', (r) => { urls.push(r.request().url()); r.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/x-ndjson', body: L }); });
await ctx.route('https://api.chess.com/**', (r) => r.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: JSON.stringify({ games: [A, B, C] }) }));
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('road-to-gm-device-v1') || '{}');
  localStorage.setItem('road-to-gm-device-v1', JSON.stringify({ ...p, games: true }));
});
await page.evaluate((late) => new Promise((res) => {
  const rq = indexedDB.open('keyval-store');
  rq.onsuccess = () => {
    const st = rq.result.transaction('keyval', 'readwrite').objectStore('keyval');
    const g = st.get('road-to-gm-games-v1');
    g.onsuccess = () => {
      const v = g.result;
      delete v.parser;
      v.games.push({ ...v.games.find((x) => x.src === 'lichess'), id: 'li:spaet', end: late });
      st.put(v, 'road-to-gm-games-v1').onsuccess = () => res();
    };
  };
}), now - 60000);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hero');
await page.waitForTimeout(800);
const sinceParam = urls.length ? Number(new URL(urls[0]).searchParams.get('since')) : null;
ok(sinceParam === Date.parse('2026-10-15T00:00:00Z'), `Bestand aus 1.5.0: lichess wird ab dem Stichtag neu geholt (since=${sinceParam})`);

ok(errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).length === 0, `Keine unerwarteten Fehler ${JSON.stringify(errors.slice(0, 3))}`);
await browser.close();
console.log(results.join('\n'));
