// Prüft das faire Urteil und die Ergebnisanzeige mit den echten Übungsdaten:
//  A  ein gleichwertiger Zug außerhalb der Top 5 zählt als richtig
//  B  ein falscher Zug mit bekannter Widerlegung: Vorführung, Text, Drohungspfeil, Überspringen per Tipp
// Aufruf: npx vite preview --port 4173 --strictPort &  node tools/e2e-judge.mjs [Ausgabeordner]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mockGames } from './mock-games.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { makeSquare } from 'chessops/util';

const BASE = 'http://localhost:4173/Laurens-Road-to-GM/';
const OUT = process.argv[2] ?? '/tmp/e2e-judge';
mkdirSync(OUT, { recursive: true });
const data = JSON.parse(readFileSync(new URL('../public/data/exercises.json', import.meta.url)));
const byId = new Map(data.exercises.map((e) => [e.id, e]));
const results = [];
const ok = (c, m) => { results.push(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await mockGames(ctx);
await ctx.addInitScript(() => localStorage.setItem('road-to-gm-device-v1', JSON.stringify({ splash: false, sound: false })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const btn = (name) => page.getByRole('button', { name, exact: true });
const squares = (e, san) => {
  const pos = Chess.fromSetup(parseFen(e.fen).unwrap()).unwrap();
  const mv = parseSan(pos, san);
  return { from: makeSquare(mv.from), to: makeSquare(mv.to) };
};
async function play(e, san) {
  await page.waitForTimeout(350); // chessground animiert die neue Stellung 260 ms lang, in dieser Zeit sind die Zielfelder noch nicht da
  const { from, to } = squares(e, san);
  const box = await page.locator('.board cg-board').boundingBox();
  const pt = (sq) => {
    const f = sq.charCodeAt(0) - 97, r = Number(sq[1]) - 1;
    const white = e.turn === 'w';
    return { x: box.x + ((white ? f : 7 - f) + 0.5) * box.width / 8, y: box.y + ((white ? 7 - r : r) + 0.5) * box.height / 8 };
  };
  await page.mouse.click(pt(from).x, pt(from).y);
  await page.waitForTimeout(120);
  await page.mouse.click(pt(to).x, pt(to).y);
  if (san.includes('=')) { await page.waitForSelector('.promo'); await page.click('.promo >> text=Dame'); }
  await page.waitForSelector('.result', { timeout: 5000 });
}
async function next() {
  await btn('Weiter').click().catch(async () => { await page.getByRole('button', { name: 'Ergebnis ansehen' }).click(); });
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.hero');
await page.locator('nav').getByText('Einstellungen').click();
await page.getByRole('radiogroup', { name: 'Aufgaben pro Satz' }).getByRole('radio', { name: '20', exact: true }).click();
await page.getByRole('radiogroup', { name: 'Letzter Zug des Gegners' }).getByRole('radio', { name: 'Nicht zeigen' }).click();
await page.locator('nav').getByText('Heute').click();
await page.click('text=/Satz starten|Satz fortsetzen/');

let doneA = false, doneB = false, doneB2 = false;
for (let i = 0; i < 20 && !(doneA && doneB && doneB2); i++) {
  await page.waitForSelector('.board-wrap[data-live="1"]', { timeout: 10000 });
  const id = await page.getAttribute('.board-wrap', 'data-ex');
  const e = byId.get(id);
  const best = e.lines[0];
  const fair = e.win ? undefined : (e.more ?? []).find(([san, wp]) => best.wp - wp > 0.5 && best.wp - wp <= 10 && !e.lines.some((l) => l.san === san));
  const refPlayed = (e.refs ?? []).find(([san]) => san === e.played.san);
  const wrong = best.wp - e.played.wp > 25;
  if (!doneA && fair) {
    await play(e, fair[0]);
    const chip = await page.textContent('.verdict-row .chip');
    ok(/Richtig/.test(chip), `A: gleichwertiger Zug ${fair[0]} (Platz außerhalb der Top 5, ${fair[1]} % statt ${best.wp} %) zählt als richtig: "${chip}"`);
    ok((await page.textContent('.result')).includes(`${Math.round(best.wp - fair[1])} Punkte weniger`) || Math.round(best.wp - fair[1]) < 1, 'A: Abstand zum besten Zug wird genannt');
    await page.screenshot({ path: `${OUT}/A-gleichwertig.png`, fullPage: true });
    doneA = true;
  } else if (refPlayed && wrong && !doneB) {
    await play(e, e.played.san);
    ok(/Falsch/.test(await page.textContent('.verdict-row .chip')), `B: Partiezug ${e.played.san} ist falsch`);
    ok((await page.locator('.skip-anim').count()) === 1, 'B: Widerlegung wird vorgeführt (Tippfläche zum Überspringen)');
    const txt = await page.textContent('.result');
    ok(txt.includes('folgt') && txt.includes(refPlayed[1][0]), `B: Text nennt die Widerlegung (${refPlayed[1].slice(0, 3).join(' ')})`);
    ok(txt.includes('Derselbe Zug wie in der Partie'), 'B: Hinweis auf denselben Zug wie in der Partie');
    if (e.threat && ['Figur eingestellt', 'Gegnerische Taktik übersehen', 'Matt übersehen'].includes(e.cat)) {
      ok(txt.includes(e.threat.san), `B: Drohung des Gegners genannt (${e.threat.san})`);
    }
    await page.screenshot({ path: `${OUT}/B-widerlegung-1.png` });
    await page.waitForSelector('.skip-anim', { state: 'detached', timeout: 9000 });
    ok(true, 'B: Vorführung endet von selbst');
    await page.screenshot({ path: `${OUT}/B-widerlegung-2.png`, fullPage: true });
    doneB = true;
  } else if (refPlayed && wrong && doneB && !doneB2) {
    await play(e, e.played.san);
    await page.waitForSelector('.skip-anim');
    await page.locator('.skip-anim').click({ position: { x: 20, y: 20 } });
    ok((await page.locator('.skip-anim').count()) === 0, 'B: Tippen auf das Brett überspringt die Vorführung');
    doneB2 = true;
  } else {
    await page.click('text=Lösung zeigen');
    await page.waitForSelector('.result');
  }
  if (i < 19 && !(doneA && doneB && doneB2)) await next();
}
ok(doneA, 'A kam in den ersten 20 Aufgaben vor');
ok(doneB, 'B kam in den ersten 20 Aufgaben vor');
ok(errors.length === 0, `Keine Fehler ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
await browser.close();
console.log(results.join('\n'));
