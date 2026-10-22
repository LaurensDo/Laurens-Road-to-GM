// Prüft den Modus "Endspiel": eigener Startknopf, Zeitlimit 15 s, exakte Wertung (jeder Zug, der das Ergebnis hält, ist richtig), Wortlaut,
// Widerlegung des eigenen Fehlers mit fallendem Balken, Varianten. Die Übungen kommen aus public/data/exercises.json (oder EXFILE).
// Aufruf: npx vite preview --port 4173 --strictPort &  node tools/e2e-endgame.mjs [Ausgabeordner]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mockGames } from './mock-games.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { makeSquare } from 'chessops/util';

const BASE = 'http://localhost:4173/Laurens-Road-to-GM/';
const OUT = process.argv[2] ?? '/tmp/e2e-endgame';
mkdirSync(OUT, { recursive: true });
const file = JSON.parse(readFileSync(process.env.EXFILE ?? new URL('../public/data/exercises.json', import.meta.url)));
const results = [];
const ok = (c, m) => { results.push(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };

const ends = file.exercises.filter((e) => e.tb && !e.hold);
if (ends.length < 4) { console.log(`FAIL zu wenige Endspiel-Übungen (${ends.length})`); process.exit(1); }
// zuerst eine Stellung mit einem zweiten richtigen Zug, dann eine mit eigenem Fehler und Widerlegung
const withAlt = ends.filter((e) => e.tb.moves.filter((m) => m[1] === e.tb.res).length >= 2);
const withRef = ends.filter((e) => e.refs?.length && e.refs[0][0] === e.played.san);
const pick = [withAlt[0], withRef.find((e) => e.id !== withAlt[0].id)].filter(Boolean);
const byId = new Map(file.exercises.map((e) => [e.id, e]));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function playMove(page, e, san) {
  await page.waitForTimeout(350);
  const p = Chess.fromSetup(parseFen(e.fen).unwrap()).unwrap();
  const mv = parseSan(p, san);
  const from = makeSquare(mv.from), to = makeSquare(mv.to);
  const box = await page.locator('.board cg-board').boundingBox();
  const pt = (sq) => {
    const f = sq.charCodeAt(0) - 97, r = Number(sq[1]) - 1, white = e.turn === 'w';
    return { x: box.x + ((white ? f : 7 - f) + 0.5) * box.width / 8, y: box.y + ((white ? 7 - r : r) + 0.5) * box.height / 8 };
  };
  await page.mouse.click(pt(from).x, pt(from).y);
  await page.waitForTimeout(120);
  await page.mouse.click(pt(to).x, pt(to).y);
  if (san.includes('=')) { await page.waitForSelector('.promo'); await page.click('.promo >> text=Dame'); }
  await page.waitForSelector('.result', { timeout: 5000 });
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
await ctx.addInitScript(() => localStorage.setItem('road-to-gm-device-v1', JSON.stringify({ splash: false, sound: false, games: false })));
await ctx.route('**/data/exercises.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...file, exercises: [...file.exercises.filter((e) => !e.tb).slice(0, 5), ...pick] }) }));
await mockGames(ctx);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.hero');

// Einstellungen: Standard 15 s
await page.locator('nav').getByText('Einstellungen').click();
const checked = (await page.getByRole('radiogroup', { name: 'Zeitlimit Endspiel' }).getByRole('radio', { checked: true }).textContent()).trim();
ok(checked === '15 s', `Einstellungen: Standard im Endspiel 15 s (${checked})`);
await page.locator('nav').getByText('Heute').click();
ok((await page.locator('.hero .start-mode').count()) === 3, 'Heute hat drei Startbereiche');
ok((await page.locator('text=Endspiel starten').count()) === 1, 'Knopf "Endspiel starten"');
await page.screenshot({ path: `${OUT}/1-heute.png`, fullPage: true });

await page.click('text=Endspiel starten');
await page.waitForSelector('.board-wrap[data-live="1"]');
const top = (await page.locator('.counts').textContent()).trim();
ok(/^Endspiel · Aufgabe 1 von/.test(top), `Kopfzeile nennt die Art (${top})`);
ok(/von 15 s/.test(await page.locator('.timer').textContent()), 'Zeitlimit 15 s');

for (let i = 0; i < pick.length; i++) {
  const e = byId.get(await page.getAttribute('.board-wrap', 'data-ex'));
  ok(!!e.tb, `Aufgabe ${i + 1} ist eine Endspielstellung`);
  const hint = (await page.locator('.actions.ask').textContent()).replace(/\s+/g, ' ');
  ok(e.tb.res === 'w' ? /Gewinnstellung: Finde einen Zug, der gewinnt/.test(hint) : /Remisstellung: Finde einen Zug, der das Remis hält/.test(hint), `Aufforderung nennt das Ziel (${hint.slice(0, 60)})`);
  if (e === withAlt[0]) {
    const alt = e.tb.moves.find((m) => m[1] === e.tb.res && m[0] !== e.lines[0].san)[0];
    await playMove(page, e, alt);
    const chip = (await page.locator('.verdict-row .chip').textContent()).trim();
    ok(/^Richtig/.test(chip), `Ein anderer Zug, der das Ergebnis hält (${alt}), ist richtig: "${chip}"`);
    const res = (await page.locator('.result').textContent()).replace(/\s+/g, ' ');
    ok(e.tb.res === 'w' ? /hält den Gewinn/.test(res) : /hält das Remis/.test(res), 'Text: hält das Ergebnis');
    ok(/exakt bekannt/.test(res), 'Erklärung nennt die exakte Bewertung');
    await page.screenshot({ path: `${OUT}/2-richtig.png`, fullPage: true });
    await page.getByRole('button', { name: 'Variante ansehen', exact: true }).click();
    await page.waitForSelector('.varbar');
    ok((await page.locator('.var-moves .pv-move').count()) >= 2, 'Variante: beste Linie aus der Tablebase');
    await page.screenshot({ path: `${OUT}/3-variante.png` });
    await page.getByRole('button', { name: 'Fertig', exact: true }).click();
  } else {
    // der eigene Fehler aus der Partie: falsch, Widerlegung wird vorgeführt, Balken fällt
    await playMove(page, e, e.played.san);
    ok(/Falsch/.test(await page.locator('.verdict-row .chip').textContent()), `Partiezug ${e.played.san} verspielt das Ergebnis: "Falsch"`);
    const res = (await page.locator('.result').textContent()).replace(/\s+/g, ' ');
    ok(/nur noch Remis|verliert/.test(res), 'Text nennt, was der Zug kostet');
    ok(/aus (Gewinn|Remis) wurde (Remis|Verlust)/.test(res), `Text nennt, was in der Partie passiert ist (${(res.match(/In der Partie gespielt[^.]*\./) ?? [''])[0]})`);
    if ((await page.locator('.skip-anim').count()) === 1) {
      const bar = parseFloat(await page.locator('.evalbar > i').evaluate((el) => el.style.height));
      ok(bar < 100 && bar === e.played.wp, `Balken fällt auf ${e.played.wp} (jetzt ${bar})`);
    }
    await page.screenshot({ path: `${OUT}/4-fehler.png`, fullPage: true });
  }
  if (i < pick.length - 1) {
    await page.waitForSelector('.skip-anim', { state: 'detached', timeout: 9000 }).catch(() => {});
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await page.waitForSelector('.board-wrap[data-live="1"]');
  }
}
ok(errors.length === 0, `Keine Fehler ${errors.length ? JSON.stringify(errors.slice(0, 2)) : ''}`);
await browser.close();
console.log(results.join('\n'));
