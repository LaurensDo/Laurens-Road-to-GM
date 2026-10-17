// Prüft die Variantenansicht: festes Brett und feste Leiste, Auswahl der Varianten, Bewertungsbalken (Standard, "auch in der Aufgabe", "aus"),
// Tastatur und Wischen, und dass die Zeit in Varianten mitgezählt wird. Die Übungen werden aus der echten Datei gewählt (nur solche mit
// gerechneten Bewertungen) und dem Browser anstelle der ganzen Datei geliefert, damit die ersten Aufgaben bekannt sind.
// Aufruf: npx vite preview --port 4173 --strictPort &  node tools/e2e-variation.mjs [Ausgabeordner]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mockGames } from './mock-games.mjs';
import { readFileSync, mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4173/Laurens-Road-to-GM/';
const OUT = process.argv[2] ?? '/tmp/e2e-variation';
mkdirSync(OUT, { recursive: true });
const file = JSON.parse(readFileSync(new URL('../public/data/exercises.json', import.meta.url)));
const results = [];
const ok = (c, m) => { results.push(`${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) process.exitCode = 1; };

// Übungen mit falschem Partiezug, Widerlegung mit Bewertungen und Bewertungen der besten Linie
const usable = file.exercises.filter((e) => {
  const ref = (e.refs ?? []).find((r) => r[0] === e.played.san);
  return ref && ref[2]?.length >= 3 && e.lines[0].ev?.length >= 4 && e.lines[0].wp - e.played.wp > 25 && !e.hold && e.lines.length === 5;
});
if (usable.length < 4) { console.log(`FAIL zu wenige Übungen mit Bewertungen (${usable.length})`); process.exit(1); }
const picked = usable.slice(0, 8);
const byId = new Map(picked.map((e) => [e.id, e]));
const body = JSON.stringify({ ...file, exercises: picked });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function session({ evalbar, viewport = { width: 390, height: 844 } } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: false, serviceWorkers: 'block' });
  await ctx.addInitScript((p) => localStorage.setItem('road-to-gm-device-v1', JSON.stringify(p)), { splash: false, sound: false, games: false, ...(evalbar ? { evalbar } : {}) });
  await ctx.route('**/data/exercises.json', (r) => r.fulfill({ contentType: 'application/json', body }));
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
const barPct = async (page) => {
  const h = await page.locator('.evalbar > i').evaluate((el) => el.style.height).catch(() => null);
  return h === null ? null : parseFloat(h);
};
const settled = (page) => page.waitForTimeout(450); // Übergang des Balkens
async function playMove(page, e, san) {
  const pos = await page.evaluate(() => 0);
  void pos;
  const { Chess } = await import('chessops/chess');
  const { parseFen } = await import('chessops/fen');
  const { parseSan } = await import('chessops/san');
  const { makeSquare } = await import('chessops/util');
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
const readLog = (page) =>
  page.evaluate(
    () =>
      new Promise((res) => {
        const rq = indexedDB.open('keyval-store');
        rq.onsuccess = () => {
          const g = rq.result.transaction('keyval').objectStore('keyval').get('road-to-gm-state-v1');
          g.onsuccess = () => res(g.result ? (JSON.parse(g.result).log ?? []) : []);
        };
        rq.onerror = () => res([]);
      }),
  );

// ---- A: Standard (Balken nach dem Zug), falscher Partiezug
{
  const { ctx, page, errors } = await session();
  const e = await currentEx(page);
  const ref = e.refs.find((r) => r[0] === e.played.san);
  ok((await page.locator('.evalbar').count()) === 0, 'A: In der Aufgabe gibt es keinen Bewertungsbalken (Standard)');
  await playMove(page, e, e.played.san);
  await page.waitForTimeout(150);
  ok((await page.locator('.evalbar').count()) === 1, 'A: Nach dem Zug erscheint der Bewertungsbalken');
  const dip = await barPct(page);
  ok(Math.abs(dip - ref[2][0]) <= 1, `A: Balken fällt gleich nach dem falschen Zug auf ${ref[2][0]} % (jetzt ${dip} %)`);
  await page.waitForSelector('.skip-anim', { state: 'detached', timeout: 9000 });
  await settled(page);
  const back = await barPct(page);
  ok(Math.abs(back - e.lines[0].wp) <= 1, `A: Nach der Vorführung steht der Balken wieder auf dem Wert der Stellung (${e.lines[0].wp} %, jetzt ${back} %)`);

  await page.getByRole('button', { name: 'Variante ansehen', exact: true }).click();
  await page.waitForSelector('.varbar');
  ok((await page.locator('.screen.trainer.varopen').count()) === 1, 'A: Variantenansicht ist offen');
  ok((await page.getByRole('button', { name: 'Weiter', exact: true }).count()) === 0, 'A: Solange die Variante offen ist, gibt es nur "Fertig" statt "Weiter"');
  const chips = await page.locator('.var-chip').allTextContents();
  ok(chips.length >= 2 && /bester Zug/.test(chips[0]) && chips.some((c) => /dein Zug/.test(c)), `A: Auswahl nennt besten Zug und eigenen Zug (${chips.map((c) => c.replace(/\s+/g, ' ')).join(' | ')})`);
  ok(chips.length >= 1 + e.lines.slice(1).filter((l) => e.lines[0].wp - l.wp <= 10).length, 'A: Alle gleichwertigen Linien stehen in der Auswahl');

  // Scrollen: Brett oben, Leiste unten bleiben im Bild
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  const board = await page.locator('.board-wrap').boundingBox();
  const fwd = await page.locator('[aria-label="Ein Zug vor"]').boundingBox();
  const vh = 844;
  ok(board.y >= 0 && board.y < 30, `A: Brett bleibt beim Scrollen oben stehen (y = ${Math.round(board.y)})`);
  ok(fwd.y > 0 && fwd.y + fwd.height <= vh, `A: Vor-Taste bleibt im Bild (${Math.round(fwd.y)} bis ${Math.round(fwd.y + fwd.height)} von ${vh})`);
  await page.screenshot({ path: `${OUT}/A-variante.png` });

  // Durchklicken: Balken folgt den Werten der besten Linie
  const best = e.lines[0];
  for (let i = 1; i <= 3; i++) {
    await page.click('[aria-label="Ein Zug vor"]');
    await settled(page);
    const v = await barPct(page);
    ok(Math.abs(v - best.ev[i - 1]) <= 0.6, `A: Schritt ${i} der besten Linie, Balken ${best.ev[i - 1]} % (jetzt ${v} %)`);
  }
  ok((await page.locator('.var-moves .pv-move.on').count()) === 1, 'A: Aktiver Zug ist in der Zugliste markiert');
  await page.keyboard.press('ArrowLeft');
  await settled(page);
  ok(Math.abs((await barPct(page)) - best.ev[1]) <= 0.6, 'A: Pfeiltaste links geht einen Zug zurück');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await settled(page);
  ok(Math.abs((await barPct(page)) - best.ev[3]) <= 0.6, 'A: Pfeiltaste rechts geht einen Zug vor');
  // Wischen auf dem Brett
  const bb = await page.locator('.board-wrap').boundingBox();
  const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
  await page.mouse.move(cx + 60, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 60, cy, { steps: 6 });
  await page.mouse.up();
  await settled(page);
  const afterSwipe = await barPct(page);
  ok(Math.abs(afterSwipe - (best.ev[4] ?? best.ev[best.ev.length - 1])) <= 0.6, 'A: Wischen nach links geht einen Zug vor');
  // eigener Zug: Balken stürzt auf den Wert der Widerlegung
  await page.locator('.var-chip', { hasText: 'dein Zug' }).click();
  await settled(page);
  ok(Math.abs((await barPct(page)) - best.wp) <= 0.6, 'A: Beim Wechsel der Variante steht der Balken wieder am Anfang');
  await page.click('[aria-label="Ein Zug vor"]');
  await settled(page);
  const own1 = await barPct(page);
  ok(Math.abs(own1 - ref[2][0]) <= 0.6 && own1 < best.wp - 15, `A: Eigener Zug: Balken fällt auf ${ref[2][0]} % (jetzt ${own1} %)`);
  await page.screenshot({ path: `${OUT}/A-eigener-zug.png` });
  await page.getByRole('button', { name: 'Fertig', exact: true }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).waitFor();
  ok((await page.locator('.varbar').count()) === 0 && (await page.locator('.screen.trainer.varopen').count()) === 0, 'A: "Fertig" schließt die Variante, "Weiter" ist wieder da');
  await settled(page);
  ok(Math.abs((await barPct(page)) - best.wp) <= 0.6, 'A: Balken zeigt wieder die Ausgangsstellung');
  await page.waitForTimeout(1200); // ein paar Sekunden mit der Aufgabe, damit die Zeit in der Variante messbar ist
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.waitForSelector('.board-wrap[data-live="1"]');
  const log = await readLog(page);
  const first = log.find((x) => x.id === e.id);
  ok(first && first.pv > 0 && first.pv <= first.dur, `A: Zeit in der Variante wird mitgezählt (pv ${first?.pv} ms von dur ${first?.dur} ms)`);
  ok(errors.length === 0, `A: Keine Fehler ${errors.length ? JSON.stringify(errors.slice(0, 2)) : ''}`);
  await ctx.close();
}

// ---- B: "Auch in der Aufgabe"
{
  const { ctx, page } = await session({ evalbar: 'always' });
  const e = await currentEx(page);
  ok((await page.locator('.evalbar').count()) === 1, 'B: Mit "Auch in der Aufgabe" steht der Balken schon vor dem Zug da');
  await settled(page);
  ok(Math.abs((await barPct(page)) - e.lines[0].wp) <= 0.6, 'B: und zeigt den Wert der Stellung');
  await ctx.close();
}

// ---- C: Aus
{
  const { ctx, page } = await session({ evalbar: 'off' });
  const e = await currentEx(page);
  await playMove(page, e, e.played.san);
  ok((await page.locator('.evalbar').count()) === 0, 'C: Mit "Aus" gibt es nie einen Balken');
  await page.waitForSelector('.skip-anim', { state: 'detached', timeout: 9000 });
  await page.getByRole('button', { name: 'Variante ansehen', exact: true }).click();
  await page.waitForSelector('.varbar');
  ok((await page.locator('.evalbar').count()) === 0 && (await page.locator('.var-wp').count()) === 1, 'C: auch in der Variantenansicht nicht (die Prozentzahl in der Leiste bleibt)');
  await ctx.close();
}

// ---- D: Formate: Brett und Leiste liegen im Bild
for (const [name, vp] of Object.entries({ 'iphone-hoch': { width: 390, height: 844 }, 'iphone-quer': { width: 844, height: 390 }, 'ipad-hoch': { width: 820, height: 1180 }, 'ipad-quer': { width: 1180, height: 820 } })) {
  const { ctx, page } = await session({ viewport: vp });
  const e = await currentEx(page);
  await playMove(page, e, e.played.san);
  await page.waitForSelector('.skip-anim', { state: 'detached', timeout: 9000 });
  await page.getByRole('button', { name: 'Variante ansehen', exact: true }).click();
  await page.waitForSelector('.varbar');
  const landscape = vp.width > vp.height;
  await page.evaluate((down) => window.scrollTo(0, down ? document.documentElement.scrollHeight : 0), !landscape);
  await page.waitForTimeout(250);
  const b = await page.locator('.board-wrap').boundingBox();
  const bar = await page.locator('.varbar').boundingBox();
  const ev = await page.locator('.evalbar').boundingBox();
  ok(b.y >= -1 && b.y + b.height <= vp.height + 1, `D ${name}: Brett liegt ganz im Bild (${Math.round(b.y)} bis ${Math.round(b.y + b.height)} von ${vp.height})`);
  ok(bar.y + bar.height <= vp.height + 1 && bar.y >= 0, `D ${name}: Variantenleiste liegt im Bild (${Math.round(bar.y)} bis ${Math.round(bar.y + bar.height)})`);
  ok(ev.x >= 0 && ev.width > 0, `D ${name}: Bewertungsbalken liegt im Bild (x ${Math.round(ev.x)})`);
  ok(landscape ? bar.x >= b.x + b.width - 1 : bar.y >= b.y + b.height - 1, `D ${name}: Leiste verdeckt das Brett nicht`);
  // Im Querformat darf nichts den Text neben dem Brett überdecken (das feste Brett des Hochformats wirft einen Rand aus Hintergrundfarbe)
  const shadow = await page.locator('.board-wrap').evaluate((el) => getComputedStyle(el).boxShadow);
  ok(landscape ? shadow === 'none' : shadow !== 'none', `D ${name}: Rand um das feste Brett nur im Hochformat (${shadow.slice(0, 30)})`);
  if (landscape) {
    const top = await page.locator('.trainer > .topbar').boundingBox();
    ok(top && top.x > b.x + b.width - 1 && top.y >= 0, `D ${name}: Kopfzeile steht rechts neben dem Brett`);
  }
  await page.screenshot({ path: `${OUT}/D-${name}.png` });
  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));
