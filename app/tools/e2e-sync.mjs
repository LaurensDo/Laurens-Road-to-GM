// Sync-Test mit zwei Geräten (iPhone- und iPad-Format) gegen einen Mock der GitHub-API.
// Aufruf: bash tools/e2e-sync.sh
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mockGames } from './mock-games.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { startMockGithub } from './mock-github.mjs';

const BASE = 'http://localhost:4174/Laurens-Road-to-GM/';
const OUT = process.argv[2] ?? '/tmp/e2e-sync';
mkdirSync(OUT, { recursive: true });
const data = JSON.parse(readFileSync(new URL('../public/data/exercises.json', import.meta.url)));
const results = [];
const ok = (cond, msg) => { results.push(`${cond ? 'OK  ' : 'FAIL'} ${msg}`); if (!cond) process.exitCode = 1; };

const mock = await startMockGithub(4180);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
async function device(name, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] });
  await mockGames(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|status of 40[14]/.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.hero');
  return { ctx, page, name };
}

async function openSettings(d) { await d.page.click('nav >> text=Einstellungen'); await d.page.waitForSelector('text=Synchronisation'); }
async function connectWith(d, repo, token) {
  await openSettings(d);
  await d.page.fill('#sync-repo', repo);
  await d.page.fill('#sync-token', token);
  await d.page.getByRole('button', { name: 'Verbinden', exact: true }).click();
}
async function solveFirstNew(d, ex) {
  await d.page.click('nav >> text=Heute');
  await d.page.click('text=/Fehler-Training (starten|weiter)/');
  await d.page.waitForSelector('.board-wrap[data-live="1"]');
  await d.page.waitForTimeout(300);
  const white = ex.turn === 'w';
  const box = await d.page.locator('.board cg-board').boundingBox();
  const pt = (sq) => {
    const f = sq.charCodeAt(0) - 97, r = Number(sq[1]) - 1;
    const col = white ? f : 7 - f, row = white ? 7 - r : r;
    return { x: box.x + (col + 0.5) * box.width / 8, y: box.y + (row + 0.5) * box.height / 8 };
  };
  const best = ex.lines[0];
  await d.page.mouse.click(pt(best.uci.slice(0, 2)).x, pt(best.uci.slice(0, 2)).y);
  await d.page.waitForTimeout(120);
  await d.page.mouse.click(pt(best.uci.slice(2, 4)).x, pt(best.uci.slice(2, 4)).y);
  if (best.san.includes('=')) { await d.page.waitForSelector('.promo'); await d.page.click('.promo >> text=Dame'); }
  await d.page.waitForSelector('.result');
  await d.page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await d.page.waitForSelector('.board-wrap[data-live="1"]');
  await d.page.getByRole('button', { name: 'Training beenden' }).click();
  await d.page.getByRole('button', { name: 'Beenden und Ergebnis ansehen', exact: true }).click();
  await d.page.getByRole('button', { name: 'Für heute fertig', exact: true }).click();
  await d.page.waitForSelector('.hero');
}
const doneCount = async (d) => {
  await d.page.click('nav >> text=Heute');
  const t = await d.page.locator('text=Heute erledigt').locator('..').textContent();
  const m = t.match(/(\d+)\s*Aufgabe/);
  return m ? Number(m[1]) : 0;
};
// Abgleich auslösen und abwarten: erst muss die Anfrage beim Mock ankommen, sonst stünde noch der alte "Zuletzt abgeglichen"-Text da
const syncNowClick = async (d) => {
  await openSettings(d);
  const n = mock.log.length;
  await d.page.getByRole('button', { name: 'Jetzt abgleichen' }).click();
  const t = Date.now();
  while (mock.log.length === n && Date.now() - t < 5000) await d.page.waitForTimeout(50);
  await d.page.waitForSelector('text=/Zuletzt abgeglichen: (gerade eben|vor)/', { timeout: 8000 });
};
const remoteLog = () => {
  const t = mock.files.get('road-to-gm/state.json')?.text;
  return t ? JSON.parse(t).log : [];
};

const phone = await device('iPhone', { width: 390, height: 844 });
const ipad = await device('iPad', { width: 820, height: 1180 });

// Falsches Token: verständliche Fehlermeldung
await connectWith(phone, 'me/sync', 'ghp_falsch');
await phone.page.waitForSelector('.notice.bad', { timeout: 8000 });
ok(/akzeptiert das Token nicht/.test(await phone.page.textContent('.notice.bad')), 'Falsches Token wird verständlich gemeldet');
await phone.page.screenshot({ path: `${OUT}/1-fehler.png`, fullPage: true });

// Richtig verbinden
await phone.page.fill('#sync-token', 'ghp_mock');
await phone.page.getByRole('button', { name: 'Verbinden', exact: true }).click();
await phone.page.waitForSelector('text=Verbunden mit', { timeout: 8000 }).catch(async (e) => {
  await phone.page.screenshot({ path: `${OUT}/fehler-verbinden.png`, fullPage: true });
  console.log('Sicht:', (await phone.page.locator('.card').first().textContent()).replace(/\s+/g, ' ').slice(0, 400));
  throw e;
});
ok(true, 'iPhone verbunden');
await phone.page.screenshot({ path: `${OUT}/2-verbunden.png`, fullPage: true });

await connectWith(ipad, 'me/sync', 'ghp_mock');
await ipad.page.waitForSelector('text=Verbunden mit', { timeout: 8000 });
ok(true, 'iPad verbunden');

// iPhone trainiert, automatischer Abgleich nach der Wartezeit
await solveFirstNew(phone, data.exercises[0]);
const t0 = Date.now();
while (remoteLog().length < 1 && Date.now() - t0 < 25000) await phone.page.waitForTimeout(500);
ok(remoteLog().length === 1, `Antwort vom iPhone kam automatisch ins Repository (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

// iPad holt den Stand
await syncNowClick(ipad);
ok((await doneCount(ipad)) === 1, 'iPad zeigt die Aufgabe vom iPhone als erledigt');

// iPad trainiert eine andere Aufgabe, beide gleichen ab
await solveFirstNew(ipad, data.exercises[1]);
await syncNowClick(ipad);
await syncNowClick(phone);
ok((await doneCount(phone)) === 2 && (await doneCount(ipad)) === 2, 'Beide Geräte zeigen 2 erledigte Aufgaben');
ok(remoteLog().length === 2, 'Im Repository stehen genau 2 Antworten');

// Zweites iPad über den Einrichtungscode einrichten
await openSettings(phone);
await phone.page.getByRole('button', { name: 'Einrichtungscode kopieren' }).click();
await phone.page.waitForSelector('text=Einrichtungscode kopiert');
const code = await phone.page.evaluate(() => navigator.clipboard.readText());
ok(code.startsWith('rtgm1.'), 'Einrichtungscode beginnt mit rtgm1.');
const ipad2 = await device('iPad2', { width: 1024, height: 768 });
await openSettings(ipad2);
await ipad2.page.getByRole('button', { name: 'Einrichtungscode von meinem anderen Gerät einfügen' }).click();
await ipad2.page.fill('#sync-code', code);
await ipad2.page.getByRole('button', { name: 'Mit Code verbinden', exact: true }).click();
await ipad2.page.waitForSelector('text=Verbunden mit', { timeout: 8000 });
ok((await doneCount(ipad2)) === 2, 'Drittes Gerät hat nach dem Einrichten über den Code den ganzen Fortschritt');
await ipad2.page.screenshot({ path: `${OUT}/3-ipad2-heute.png`, fullPage: true });

// Das Token steht weder in der Sync-Datei noch in der Sicherung
ok(!JSON.stringify([...mock.files.values()]).includes('ghp_mock'), 'Das Token steht nicht in der Sync-Datei');
await openSettings(phone);
await phone.page.getByRole('button', { name: 'Sicherung exportieren' }).click();
await phone.page.waitForSelector('text=Sicherung in die Zwischenablage kopiert', { timeout: 5000 });
const backup = await phone.page.evaluate(() => navigator.clipboard.readText());
ok(backup.includes('"log"') && !backup.includes('ghp_mock'), 'Das Token steht nicht in der Sicherung');

// Zurücksetzen wirkt auf beiden Geräten, die Sicherung holt den Stand auf beiden zurück
await openSettings(phone);
await phone.page.getByRole('button', { name: 'Trainingsstand löschen' }).click();
ok(/auch auf deinen anderen Geräten/.test(await phone.page.locator('text=Das löscht alle').textContent()), 'Hinweis: Zurücksetzen gilt über den Abgleich auch auf den anderen Geräten');
await phone.page.getByRole('button', { name: 'Ja, löschen', exact: true }).click();
await syncNowClick(phone);
await syncNowClick(ipad);
ok((await doneCount(phone)) === 0 && (await doneCount(ipad)) === 0 && remoteLog().length === 0, 'Zurücksetzen auf dem iPhone löscht auch auf dem iPad');
await openSettings(phone);
await phone.page.getByRole('button', { name: 'Sicherung als Text einfügen' }).click();
await phone.page.fill('#import-text', backup);
await phone.page.getByRole('button', { name: 'Wiederherstellen', exact: true }).click();
await phone.page.waitForSelector('text=Trainingsstand wiederhergestellt');
await syncNowClick(phone);
await syncNowClick(ipad);
ok((await doneCount(phone)) === 2 && (await doneCount(ipad)) === 2 && remoteLog().length === 2, 'Sicherung nach dem Zurücksetzen bringt den Stand auf beiden Geräten zurück');

// Trennen
await openSettings(ipad2);
await ipad2.page.getByRole('button', { name: 'Verbindung trennen' }).click();
await ipad2.page.getByRole('button', { name: 'Trennen', exact: true }).click();
await ipad2.page.waitForSelector('text=Mit iPhone und iPad abgleichen', { timeout: 3000 }).catch(() => {});
ok(await ipad2.page.locator('#sync-repo').count() === 1, 'Trennen zeigt wieder das Einrichtungsformular');

ok(errors.length === 0, `Keine Konsolenfehler ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
await browser.close();
mock.close();
console.log(results.join('\n'));
