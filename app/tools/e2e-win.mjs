// Prüft "Sicher gewinnen": kurzes Zeitlimit, jeder sichere Zug zählt, Wortlaut, Variantenauswahl und die Mischung in die neuen Aufgaben.
// Die Übungen kommen aus public/data/exercises.json (oder aus der Datei in EXFILE) und werden dem Browser anstelle der ganzen Datei geliefert.
// Aufruf: npx vite preview --port 4173 --strictPort &  node tools/e2e-win.mjs [Ausgabeordner]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mockGames } from './mock-games.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { makeSquare } from 'chessops/util';

const BASE = 'http://localhost:4173/Laurens-Road-to-GM/';
const OUT = process.argv[2] ?? '/tmp/e2e-win';
mkdirSync(OUT, { recursive: true });
const file = JSON.parse(readFileSync(process.env.EXFILE ?? new URL('../public/data/exercises.json', import.meta.url)));
const results = [];
const ok = (c, m) => { results.push(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };

const wins = file.exercises.filter((e) => e.win && !e.hold);
const normal = file.exercises.filter((e) => !e.win && !e.hold).slice(0, 12);
if (wins.length < 3) { console.log(`FAIL zu wenige Übungen "Sicher gewinnen" (${wins.length})`); process.exit(1); }
const byId = new Map([...wins, ...normal].map((e) => [e.id, e]));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function session(exercises) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.addInitScript(() => localStorage.setItem('road-to-gm-device-v1', JSON.stringify({ splash: false, sound: false, games: false })));
  await ctx.route('**/data/exercises.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...file, exercises }) }));
  await mockGames(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.hero');
  await page.click('text=/Satz starten|Satz fortsetzen/');
  await page.waitForSelector('.board-wrap[data-live="1"]');
  return { ctx, page, errors };
}
async function playMove(page, e, san) {
  await page.waitForTimeout(350); // die neue Stellung wird 260 ms lang animiert
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
  await page.waitForSelector('.result', { timeout: 5000 });
}
const currentEx = async (page) => byId.get(await page.getAttribute('.board-wrap', 'data-ex'));

// ---- A: nur Gewinnstellungen: Zeitlimit, Wortlaut, Wertung
{
  const { ctx, page, errors } = await session(wins.slice(0, 6));
  const e = await currentEx(page);
  const prompt = (await page.locator('.prompt').textContent()).replace(/\s+/g, ' ');
  ok(/Klar gewonnen/.test(prompt), `A: Tag "Klar gewonnen" (${prompt.slice(0, 70)})`);
  ok(/Zieh einen sicheren Zug, ohne zu grübeln/.test(await page.locator('.actions.ask').textContent()), 'A: Aufforderung nennt Tempo statt "bester Zug"');
  const timer = (await page.locator('.timer').textContent()).replace(/\s+/g, ' ');
  ok(/von 5 s/.test(timer), `A: kurze Zielzeit von 5 s (${timer.trim()})`);

  // ein sicherer Zug, der nicht der beste ist (sonst der beste), schnell
  const alt = e.lines.slice(1).find((l) => l.wp >= e.win.safe && e.lines[0].wp - l.wp > 1) ?? e.lines[0];
  await playMove(page, e, alt.san);
  const chip = (await page.locator('.verdict-row .chip').textContent()).trim();
  ok(/^Richtig(, sicherer Zug)?$/.test(chip), `A: sicherer Zug ${alt.san} (${alt.wp} % statt ${e.lines[0].wp} %) zählt als richtig: "${chip}"`);
  const res = (await page.locator('.result').textContent()).replace(/\s+/g, ' ');
  ok(/hält die Gewinnstellung/.test(res), 'A: Text nennt, dass der Zug die Gewinnstellung hält');
  ok(/Tempo, nicht um den besten Zug/.test(res), 'A: Erklärung nennt Tempo statt bestem Zug');
  ok(!/Spieler deiner Stärke finden/.test(res), 'A: kein Richtwert für Spieler deiner Stärke (gibt es hier nicht)');
  if (e.lines.slice(1).some((l) => l.wp >= e.win.safe)) ok(/weitere sichere Züge/.test(res), 'A: weitere sichere Züge werden genannt');
  await page.screenshot({ path: `${OUT}/A-richtig.png`, fullPage: true });

  // Variantenauswahl: alle sicheren Linien
  await page.getByRole('button', { name: 'Variante ansehen', exact: true }).click();
  await page.waitForSelector('.varbar');
  const chips = await page.locator('.var-chip').count();
  const safeLines = e.lines.filter((l) => l.wp >= e.win.safe).length;
  ok(chips >= safeLines, `A: Variantenauswahl bietet die sicheren Linien an (${chips} Einträge, ${safeLines} sichere Linien)`);
  await page.getByRole('button', { name: 'Fertig', exact: true }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.waitForSelector('.board-wrap[data-live="1"]');

  // zu langsam: nach der Zielzeit
  const e2 = await currentEx(page);
  await page.waitForTimeout(5600);
  await playMove(page, e2, e2.lines[0].san);
  ok(/zu langsam/.test(await page.locator('.verdict-row .chip').textContent()), 'A: Richtiger Zug nach der Zielzeit: "Richtig, aber zu langsam"');
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.waitForSelector('.board-wrap[data-live="1"]');

  // ein Zug, der den Vorteil verspielt
  const e3 = await currentEx(page);
  const bad = [...e3.lines.map((l) => [l.san, l.wp]), ...(e3.more ?? [])].find(([, wp]) => wp < e3.win.safe - 15);
  if (bad) {
    await playMove(page, e3, bad[0]);
    ok(/Falsch/.test(await page.locator('.verdict-row .chip').textContent()), `A: ${bad[0]} (${bad[1]} %) verspielt die Gewinnstellung: "Falsch"`);
    ok(/verspielt Gewinnchance/.test(await page.locator('.result').textContent()), 'A: Text nennt die verspielte Gewinnchance');
  } else {
    results.push('--   A: keine Aufgabe mit einem klar verspielenden Zug in der Stichprobe (übersprungen)');
  }
  ok(errors.length === 0, `A: Keine Fehler ${errors.length ? JSON.stringify(errors.slice(0, 2)) : ''}`);
  await ctx.close();
}

// ---- B: Mischung: jede fünfte neue Aufgabe
{
  const mixed = [...normal, ...wins.slice(0, 6)];
  const { ctx, page } = await session(mixed);
  const kinds = [];
  for (let i = 0; i < 10; i++) {
    const e = await currentEx(page);
    kinds.push(!!e.win);
    await page.click('text=Lösung zeigen');
    await page.waitForSelector('.result');
    if (i < 9) {
      await page.getByRole('button', { name: 'Weiter', exact: true }).click();
      await page.waitForSelector('.board-wrap[data-live="1"]');
    }
  }
  const at = kinds.map((w, i) => (w ? i : -1)).filter((i) => i >= 0);
  ok(JSON.stringify(at) === JSON.stringify([2, 7]), `B: Im ersten Satz sind die 3. und die 8. Aufgabe Gewinnstellungen (${JSON.stringify(at)})`);
  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));
