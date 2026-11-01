// Prüft das Satzende (Version 1.14): Zweite Chance (frühestens 30 s nach dem Fehler, zählt nicht), Ergebnisseite mit Überschrift am Richtwert,
// Moment des Satzes mit kleinem Brett, Damals-Zeilen, Big Dog zur Lage (hier: Rückkehr nach 6 Tagen) und dass "Heute" die Zweite Chance nicht mitzählt.
// Aufruf: npx vite preview --port 4173 --strictPort &  node tools/e2e-setend.mjs [Ausgabeordner]   (dauert gut eine Minute: wartet 31 s)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mockGames } from './mock-games.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { makeSquare } from 'chessops/util';

const BASE = 'http://localhost:4173/Laurens-Road-to-GM/';
const OUT = process.argv[2] ?? '/tmp/e2e-setend';
mkdirSync(OUT, { recursive: true });
const file = JSON.parse(readFileSync(new URL('../public/data/exercises.json', import.meta.url)));
const results = [];
const ok = (c, m) => { results.push(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };

// drei Fehler-Übungen mit großem damaligem Verlust (Moment des Satzes) und gespeicherten Kosten des Partiezugs (Damals-Zeile)
const pick = file.exercises
  .filter((e) => !e.tb && !e.win && !e.hold && e.loss >= 40 && !e.lines[0].san.includes('=') && e.why?.against.some((a) => a[0] === e.played.san))
  .slice(0, 3);
if (pick.length < 3) { console.log('FAIL zu wenige passende Übungen'); process.exit(1); }
const byId = new Map(pick.map((e) => [e.id, e]));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
await ctx.addInitScript(() => localStorage.setItem('road-to-gm-device-v1', JSON.stringify({ splash: false, sound: false, games: false })));
await ctx.route('**/data/exercises.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...file, exercises: pick }) }));
await mockGames(ctx);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(BASE, { waitUntil: 'networkidle' });

// Stand: Satzgröße 3, letzte Antwort vor 6 Tagen (Rückkehr nach einer Pause)
await page.evaluate(async () => {
  const st = {
    version: 1, cards: {}, hidden: {}, epoch: 0, epochTs: 0, devices: {}, ext: {}, settingsTs: 1,
    settings: { timeLimit: 20, winLimit: 10, endLimit: 15, tolerance: true, newPerDay: 15, setSize: 3, showLast: true, goalMinutes: 15, theme: 'system', filters: { phase: 'alle', cat: 'alle', motif: 'alle' } },
    log: [{ id: 'alt-0', ts: Date.now() - 6 * 86400000, grade: 3, verdict: 'best', ms: 4000, dur: 6000, san: 'e4' }],
  };
  await new Promise((res, rej) => {
    const r = indexedDB.open('keyval-store');
    r.onupgradeneeded = () => r.result.createObjectStore('keyval');
    r.onsuccess = () => {
      const tx = r.result.transaction('keyval', 'readwrite');
      tx.objectStore('keyval').put(JSON.stringify(st), 'road-to-gm-state-v1');
      tx.oncomplete = res;
      tx.onerror = rej;
    };
  });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hero');

const btn = (name) => page.getByRole('button', { name, exact: true });
const shown = async () => byId.get(await page.getAttribute('.board-wrap', 'data-ex'));
async function playBest() {
  await page.waitForSelector('.board-wrap[data-live="1"]');
  await page.waitForTimeout(350);
  const e = await shown();
  const p = Chess.fromSetup(parseFen(e.fen).unwrap()).unwrap();
  const mv = parseSan(p, e.lines[0].san);
  const box = await page.locator('.board cg-board').boundingBox();
  const pt = (sq) => {
    const f = sq.charCodeAt(0) - 97, r = Number(sq[1]) - 1, white = e.turn === 'w';
    return { x: box.x + ((white ? f : 7 - f) + 0.5) * box.width / 8, y: box.y + ((white ? 7 - r : r) + 0.5) * box.height / 8 };
  };
  await page.mouse.click(pt(makeSquare(mv.from)).x, pt(makeSquare(mv.from)).y);
  await page.waitForTimeout(120);
  await page.mouse.click(pt(makeSquare(mv.to)).x, pt(makeSquare(mv.to)).y);
  await page.waitForSelector('.result', { timeout: 5000 });
  return e;
}

// ---- Satz: Aufgabe 1 aufgeben, 31 s warten, Aufgaben 2 und 3 richtig
await page.click('text=Fehler-Training starten');
await page.waitForSelector('.board-wrap[data-live="1"]');
const first = await shown();
await page.click('text=Lösung zeigen');
await page.waitForSelector('.result');
await page.waitForTimeout(31000);
await btn('Weiter').click();
await playBest();
await btn('Weiter').click();
await playBest();
await btn('Ergebnis ansehen').click();

// ---- Angebot der Zweiten Chance
await page.waitForSelector('.retry-offer', { timeout: 5000 });
const offerText = (await page.locator('.retry-offer').textContent()).replace(/\s+/g, ' ');
ok(/Zweite Chance/.test(offerText) && /Eine falsche Aufgabe/.test(offerText) && /Zählt nicht/.test(offerText), `Angebot: eine falsche Aufgabe noch einmal, zählt nicht (${offerText.slice(0, 90)})`);
await page.screenshot({ path: `${OUT}/1-angebot.png` });
await btn('Noch einmal').click();
await page.waitForSelector('.board-wrap[data-live="1"]');
const head = (await page.locator('.counts').textContent()).replace(/\s+/g, ' ');
ok(/Zweite Chance · 1 von 1/.test(head) && (await shown()).id === first.id, `Zweite Chance zeigt die falsche Aufgabe (${head.trim()})`);
await playBest();
ok(/zählt nicht für Quote und Wiederholung/.test(await page.locator('.result').textContent()), 'Ergebnis der Zweiten Chance sagt, dass sie nicht zählt');
await btn('Ergebnis ansehen').click();

// ---- Ergebnisseite
await page.waitForSelector('text=Satz geschafft');
await page.waitForTimeout(400);
const h1 = await page.locator('h1').textContent();
ok(/Richtwert|erwarteten Bereich|von \d+/.test(h1) && !/Durchwachsen|Solider|Starker|Schwerer/.test(h1), `Überschrift am Richtwert, ohne feste Stufen (${h1})`);
const score = (await page.locator('.score').textContent()).replace(/\s+/g, ' ');
ok(/2\s*\/\s*3/.test(score) && /Zweite Chance: 1 von 1 zurückgeholt/.test(score), `Quote ohne Zweite Chance (2/3), Zweite Chance daneben (${score.trim().slice(0, 140)})`);
const moment = page.locator('.moment');
ok((await moment.count()) === 1 && (await moment.locator('.mini-board cg-board').count()) === 1 && /Damals: .* Heute: /.test(await moment.textContent()), 'Moment des Satzes mit kleinem Brett und Damals-Zeile');
ok((await moment.locator('a', { hasText: 'Partie ansehen' }).count()) === 1, 'Moment des Satzes verlinkt die Partie');
const dog = page.locator('.bigdog');
ok((await dog.count()) === 1 && /Erster Satz nach 6 Tagen Pause\./.test(await dog.textContent()) && /Big Dog/i.test(await dog.textContent()), 'Big Dog zur Lage (Rückkehr nach 6 Tagen), mit der sachlichen Zeile');
const subs = await page.locator('.tasklist .task-sub').allTextContents();
ok(subs.length === 3 && subs.filter((t) => t.startsWith('Damals:')).length === 2, `Damals-Zeile bei den 2 gelösten Aufgaben, nicht bei der falschen (${subs.length} Zeilen)`);
ok((await page.locator('details.einordnung[open]').count()) === 0 && (await page.locator('details.einordnung h2', { hasText: 'Einordnung' }).count()) === 1, 'Einordnung zum Aufklappen, anfangs zu');
await page.screenshot({ path: `${OUT}/2-ergebnis.png`, fullPage: true });

// ---- Heute zählt die Zweite Chance nicht mit
await btn('Für heute fertig').click();
await page.waitForSelector('.hero');
const strips = await page.locator('.set-strips .pips').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
const done = (await page.locator('text=Heute erledigt').locator('..').textContent()).replace(/\s+/g, ' ');
ok(strips.length === 1 && strips[0] === '2 richtig, 1 falsch' && /3 Aufgaben/.test(done), `Heute: ein Satz mit 3 Aufgaben, ohne Zweite Chance (${strips.join(' | ')})`);

ok(errors.length === 0, `Keine Konsolenfehler ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
await browser.close();
console.log(results.join('\n'));
