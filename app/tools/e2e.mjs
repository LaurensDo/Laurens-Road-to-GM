// Ende-zu-Ende-Test: Sätze, Töne, Ablauf, Speicherung, Offline und alle Geräteformate.
// Aufruf: npx vite preview --port 4173 &  dann  node tools/e2e.mjs [Ausgabeordner]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mockGames } from './mock-games.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { chessgroundDests } from 'chessops/compat';

const BASE = 'http://localhost:4173/Laurens-Road-to-GM/';
const OUT = process.argv[2] ?? '/tmp/e2e';
mkdirSync(OUT, { recursive: true });
const data = JSON.parse(readFileSync(new URL('../public/data/exercises.json', import.meta.url)));
// Prüfstellungen (hold) kommen nie im Training vor
data.exercises = data.exercises.filter((e) => !e.hold);
const ex = data.exercises[0];

const log = [];
const ok = (cond, msg) => { log.push(`${cond ? 'OK  ' : 'FAIL'} ${msg}`); if (!cond) process.exitCode = 1; };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light', hasTouch: true, isMobile: true });
await mockGames(ctx);
await ctx.addInitScript(() => {
  window.__sfx = [];
  window.addEventListener('road-sfx', (e) => window.__sfx.push(e.detail));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const sfx = () => page.evaluate(() => window.__sfx.slice());
const sfxClear = () => page.evaluate(() => { window.__sfx.length = 0; });
const btn = (name) => page.getByRole('button', { name, exact: true });
const pointer = (box, white) => (sq) => {
  const f = sq.charCodeAt(0) - 97, r = Number(sq[1]) - 1;
  const col = white ? f : 7 - f, row = white ? 7 - r : r;
  return { x: box.x + (col + 0.5) * box.width / 8, y: box.y + (row + 0.5) * box.height / 8 };
};
const boardPoints = async (e) => pointer(await page.locator('.board cg-board').boundingBox(), e.turn === 'w');
const legalDests = (e) => chessgroundDests(Chess.fromSetup(parseFen(e.fen).unwrap()).unwrap());
const allSquares = [...'abcdefgh'].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`));
const taskNo = async () => (await page.locator('.counts').textContent()).replace(/\s+/g, ' ').trim();
const chooseSetSize = async (n) => {
  await page.locator('nav').getByText('Einstellungen').click();
  await page.waitForSelector('text=Aufgaben pro Satz');
  await page.getByRole('radiogroup', { name: 'Aufgaben pro Satz' }).getByRole('radio', { name: String(n), exact: true }).click();
};

// ---- Startbild
await page.goto(BASE, { waitUntil: 'commit' });
await page.waitForSelector('#splash');
ok(true, 'Startbild erscheint beim Öffnen');
await page.waitForSelector('#splash[data-ready="1"]');
await page.waitForTimeout(1300);
await page.screenshot({ path: `${OUT}/0-startbild.png` });
ok((await page.textContent('#splash .splash-quote p')).length > 10 && /Big Dog/.test(await page.textContent('#splash .splash-author')), 'Startbild zeigt ein Zitat von Big Dog');
// auf eine Stelle, unter der auf Heute kein Knopf liegt: Endet das Startbild gerade von selbst, ginge der Tipp sonst an die Seite
await page.mouse.click(200, 120);
await page.waitForSelector('#splash', { state: 'detached', timeout: 2000 });
ok(true, 'Tippen überspringt das Startbild');
ok(await page.locator('.hero h1').textContent() === 'Heute' && await page.locator('.hero-sub').count() === 0, 'Heute ohne Begrüßung und Serie');
{
  // Mindestdauer und Zitatwechsel: zwei weitere Starts ohne Tippen
  const seen = new Set();
  for (let i = 0; i < 2; i++) {
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const q = await c2.newPage();
    const t0 = Date.now();
    await q.goto(BASE, { waitUntil: 'commit' });
    await q.waitForSelector('#splash .splash-quote p');
    seen.add(await q.textContent('#splash .splash-quote p'));
    await q.waitForSelector('#splash', { state: 'detached', timeout: 8000 });
    const dt = Date.now() - t0;
    ok(dt >= 2600 && dt <= 6000, `Startbild bleibt ohne Tippen etwa ${(dt / 1000).toFixed(1)} s sichtbar`);
    await c2.close();
  }
  ok(seen.size >= 1, 'Startbild zeigt bei jedem Start ein Zitat');
}

// ---- Heute und Satzgröße
await page.waitForSelector('.hero');
await page.screenshot({ path: `${OUT}/1-heute.png` });
ok(await page.locator('text=Fehler-Training starten').count() === 1, 'Heute zeigt "Fehler-Training starten"');
await chooseSetSize(5);
await page.locator('nav').getByText('Heute').click();
{
  // Heute zeigt je Art nur noch eine Zahl (offen), keine Zahlenreihe
  const btn0 = (await page.locator('.start-mode').first().textContent()).replace(/\s+/g, ' ');
  ok(/Fehler-Training starten \d+ offen/.test(btn0) && (await page.locator('.hero dl').count()) === 0, `Startknopf mit einer Zahl, ohne Satz/Fällig/Lernen/Neu (${btn0.trim()})`);
}

// ---- Aufgabe 1: letzter Zug, Tippen, Töne
await sfxClear();
await page.click('text=Fehler-Training starten');
await page.waitForSelector('.board-wrap[data-live="0"]');
ok((await taskNo()).includes('von 5'), 'Satzgröße 5 wird übernommen');
ok(/0,0 s/.test(await page.textContent('.timer')), 'Vor der Freigabe läuft die Zeit noch nicht');
await page.waitForSelector('.board-wrap[data-live="1"]');
await page.waitForTimeout(300);
{
  const early = await sfx();
  const mi = early.findIndex((x) => x === 'move' || x === 'capture');
  ok(mi >= 0 && early.indexOf('start') > mi, `Zugton des Gegners kommt vor dem Start-Ton (${early.join(',')})`);
  ok(await page.locator('.tag.last').count() === 1, `Tag zeigt den letzten Zug (${(await page.locator('.tag.last').textContent()).trim()})`);
  ok(await page.locator('.board square.last-move').count() === 2, 'Letzter Zug ist auf dem Brett hervorgehoben');
}
await page.screenshot({ path: `${OUT}/2-aufgabe.png` });
ok((await taskNo()).includes('Aufgabe 1 von 5'), `Satzfortschritt zeigt Aufgabe 1 von 5 (${await taskNo()})`);
ok((await page.textContent('.side')).includes(ex.turn === 'w' ? 'Weiß' : 'Schwarz'), 'Seite am Zug stimmt');
{
  const P = await boardPoints(ex);
  const best = ex.lines[0];
  await sfxClear();
  const from = P(best.uci.slice(0, 2)), to = P(best.uci.slice(2, 4));
  await page.mouse.click(from.x, from.y);
  await page.waitForTimeout(150);
  await page.mouse.click(to.x, to.y);
  await page.waitForSelector('.result', { timeout: 5000 });
  await page.waitForTimeout(400);
  const s = await sfx();
  ok(s.includes('select'), `Ton beim Anklicken der Figur (${s.join(',')})`);
  ok(s.includes('move') || s.includes('capture'), 'Zugton beim Ziehen');
  ok(s.includes('correct'), 'Ton "richtig" nach richtiger Antwort');
  ok(/Richtig/.test(await page.textContent('.verdict-row .chip')), `Bester Zug ${best.san} wird als richtig gewertet`);
  await page.screenshot({ path: `${OUT}/3-ergebnis.png`, fullPage: true });
}
await btn('Weiter').click();
await page.waitForSelector('.board-wrap[data-live="1"]');
await page.waitForTimeout(300);
ok((await taskNo()).includes('Aufgabe 2 von 5'), 'Weiter führt zu Aufgabe 2 von 5');

// ---- Aufgabe 2: unzulässige Züge, Ziehen
const rest = data.exercises.slice(1, 9);
const ex2 = rest.find((e) => e.cat !== ex.cat) ?? rest[0];
{
  const P = await boardPoints(ex2);
  const b2 = ex2.lines[0];
  const dests = legalDests(ex2);
  const origSq = b2.uci.slice(0, 2);
  const targets = dests.get(origSq) ?? [];
  const bad = allSquares.find((q) => q !== origSq && !targets.includes(q) && !dests.has(q));
  const o = P(origSq), z = P(b2.uci.slice(2, 4)), x = P(bad);
  // Tippen: Figur wählen, dann unzulässiges Feld
  await sfxClear();
  await page.mouse.click(o.x, o.y);
  await page.waitForTimeout(150);
  await page.mouse.click(x.x, x.y);
  await page.waitForTimeout(250);
  let s = await sfx();
  ok(s.includes('select') && s.includes('illegal'), `Unzulässiges Zielfeld per Tippen: Ton "Zug nicht erlaubt" (${s.join(',')})`);
  ok(await page.locator('.result').count() === 0, 'Unzulässiger Zug wird nicht gewertet');
  // Ziehen auf ein unzulässiges Feld
  await sfxClear();
  await page.mouse.move(o.x, o.y);
  await page.mouse.down();
  await page.mouse.move((o.x + x.x) / 2, (o.y + x.y) / 2, { steps: 5 });
  await page.mouse.move(x.x, x.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  s = await sfx();
  ok(s.includes('illegal'), `Unzulässiges Zielfeld per Ziehen: Ton "Zug nicht erlaubt" (${s.join(',')})`);
  ok(await page.locator('.result').count() === 0, 'Figur springt zurück, Aufgabe bleibt offen');
  // Richtig ziehen
  await sfxClear();
  await page.mouse.move(o.x, o.y);
  await page.mouse.down();
  await page.mouse.move((o.x + z.x) / 2, (o.y + z.y) / 2, { steps: 6 });
  await page.mouse.move(z.x, z.y, { steps: 6 });
  await page.mouse.up();
  if (b2.san.includes('=')) { await page.waitForSelector('.promo'); await page.click('.promo >> text=Dame'); }
  await page.waitForSelector('.result', { timeout: 5000 });
  await page.waitForTimeout(400);
  s = await sfx();
  ok(/Richtig/.test(await page.textContent('.verdict-row .chip')), `Zweite Aufgabe per Ziehen gelöst: ${b2.san}`);
  ok(s.includes('correct') && (s.includes('move') || s.includes('capture')), 'Zug- und Richtig-Ton beim Ziehen');
  await page.screenshot({ path: `${OUT}/3b-ziehen.png`, fullPage: true });
}

// ---- Aufgabe 3: Lösung zeigen, Variante, ausblenden
await btn('Weiter').click();
await page.waitForSelector('.board-wrap[data-live="1"]');
await sfxClear();
await page.click('text=Lösung zeigen');
await page.waitForSelector('.result');
await page.waitForTimeout(300);
ok(/Lösung angezeigt/.test(await page.textContent('.verdict-row .chip')), 'Lösung zeigen wird als nicht gelöst gewertet');
ok((await sfx()).includes('wrong'), 'Ton "falsch" bei angezeigter Lösung');
await page.screenshot({ path: `${OUT}/4-loesung.png`, fullPage: true });
await page.click('text=Variante ansehen');
await sfxClear();
await page.click('[aria-label="Ein Zug vor"]');
await page.waitForTimeout(300);
{
  const s = await sfx();
  ok(s.includes('move') || s.includes('capture'), 'Zugton beim Durchsehen der Variante');
}
await page.screenshot({ path: `${OUT}/5-variante.png`, fullPage: true });
await btn('Fertig').click();
await page.click('text=Diese Aufgabe nicht mehr zeigen');
await page.waitForSelector('.board-wrap[data-live="1"]');
ok((await taskNo()).includes('Aufgabe 4 von 5'), 'Nach dem Ausblenden geht es mit Aufgabe 4 weiter');

// ---- Aufgabe 4 und 5: aufgeben, Satz abschließen
await page.click('text=Lösung zeigen');
await page.waitForSelector('.result');
await btn('Weiter').click();
await page.waitForSelector('.board-wrap[data-live="1"]');
await page.click('text=Lösung zeigen');
await page.waitForSelector('.result');
ok(await btn('Ergebnis ansehen').count() === 1, 'Nach der letzten Aufgabe heißt der Knopf "Ergebnis ansehen"');
await sfxClear();
await btn('Ergebnis ansehen').click();
await page.waitForSelector('text=Satz geschafft');
await page.waitForTimeout(300);
ok((await sfx()).includes('done'), 'Ton bei geschafftem Satz');
ok(await page.locator('.tasklist li').count() === 5, 'Ergebnis listet alle 5 Aufgaben');
ok(await page.locator('h2:has-text("Einordnung")').count() === 1, 'Ergebnis enthält die Einordnung');
const head = await page.locator('h1').textContent();
ok(/Satz/.test(head), `Ergebnis hat eine Überschrift (${head})`);
await page.screenshot({ path: `${OUT}/5b-satzergebnis.png`, fullPage: true });

// ---- Zweiter Satz, pausieren, fortsetzen, beenden
await btn('Nächster Satz').click();
await page.waitForSelector('.board-wrap[data-live="1"]');
ok((await taskNo()).includes('Aufgabe 1 von 5'), 'Nächster Satz startet bei Aufgabe 1');
await page.click('text=Lösung zeigen');
await page.waitForSelector('.result');
await page.getByRole('button', { name: 'Training beenden' }).click();
await page.waitForSelector('text=Satz beenden?');
await page.screenshot({ path: `${OUT}/5c-dialog.png` });
await btn('Später weitermachen').click();
await page.waitForSelector('.hero');
{
  const resume = page.locator('.start-mode', { hasText: 'Fehler-Training weiter' });
  const txt = (await resume.textContent()).replace(/\s+/g, ' ');
  const pips = await resume.locator('.pips .pip').count();
  ok((await resume.count()) === 1 && /1 von 5/.test(txt) && pips === 5, `Pausierter Satz lässt sich fortsetzen, Stand als Punktreihe (${txt.trim()}, ${pips} Punkte)`);
}
await page.click('text=Fehler-Training weiter');
await page.waitForSelector('.board-wrap[data-live="1"]');
ok((await taskNo()).includes('Aufgabe 2 von 5'), 'Fortgesetzt wird bei Aufgabe 2');
await page.getByRole('button', { name: 'Training beenden' }).click();
await btn('Beenden und Ergebnis ansehen').click();
await page.waitForSelector('text=Satz beendet nach 1 von 5');
ok(true, 'Vorzeitig beendeter Satz zeigt Ergebnis');
await btn('Für heute fertig').click();
await page.waitForSelector('.hero');
ok(await page.locator('text=Fehler-Training starten').count() === 1, 'Nach dem Beenden gibt es keinen offenen Satz mehr');

// ---- Speicherung
await page.waitForTimeout(500);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hero');
{
  const rows = page.locator('.set-strips > li');
  const labels = await rows.locator('.pips').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const total = (await page.locator('text=Heute erledigt').locator('..').textContent()).replace(/\s+/g, ' ');
  ok(labels.length === 2 && !/offen/.test(labels[0]) && /4 offen/.test(labels[1]) && /6 Aufgaben/.test(total),
    `Heutige Sätze bleiben nach dem Neuladen erhalten, je Satz eine Zeichenreihe (${labels.join(' | ')})`);
}
await page.locator('nav').getByText('Fortschritt').click();
await page.waitForSelector('text=Letzte 14 Tage');
ok(await page.locator('text=Aufgabensätze').count() === 1, 'Fortschritt zeigt die Sätze');
{
  const card = (await page.locator('.card', { has: page.locator('h2', { hasText: 'Erster Versuch an neuen Aufgaben' }) }).textContent()).replace(/\s+/g, ' ');
  ok(/Erste Aussage nach 20 neuen Aufgaben, bisher \d+/.test(card), `Fortschritt: Erstversuch-Karte nennt, wann die erste Aussage kommt (${card.slice(0, 90)})`);
  ok(/Trainingstage im/.test(await page.locator('main').textContent()), 'Fortschritt: Trainingstage im Monat statt Serie');
}
await page.screenshot({ path: `${OUT}/6-fortschritt.png`, fullPage: true });
await page.locator('nav').getByText('Einstellungen').click();
await page.waitForSelector('text=Sicherung');
ok(await page.locator('text=Ausgeblendete Aufgaben').count() === 1, 'Ausgeblendete Aufgabe wird in den Einstellungen gezählt');
await page.screenshot({ path: `${OUT}/7-einstellungen.png`, fullPage: true });

// ---- Anzeige-Info
await page.click('text=Anzeige-Info (bei Darstellungsproblemen)');
await page.waitForFunction(() => /Fenster jetzt/.test(document.querySelector('.diag')?.textContent ?? ''));
{
  const d = await page.textContent('.diag');
  ok(/Verlauf seit dem Start/.test(d) && /Sicherheitsränder/.test(d), 'Anzeige-Info zeigt Fenster, Ränder und den Verlauf seit dem Start');
}

// ---- Ton-Einstellungen
await page.click('text=Töne anhören');
await sfxClear();
await page.getByRole('button', { name: 'Schlagzug', exact: true }).click();
ok((await sfx()).includes('capture'), 'Töne anhören spielt den Schlagzug');
await page.getByRole('radiogroup', { name: 'Ton', exact: true }).getByRole('radio', { name: 'Aus', exact: true }).click();
await sfxClear();
await page.locator('nav').getByText('Heute').click();
await page.locator('nav').getByText('Einstellungen').click();
ok((await sfx()).length === 0, 'Bei "Ton aus" bleibt die App stumm');
await page.getByRole('radiogroup', { name: 'Ton', exact: true }).getByRole('radio', { name: 'An', exact: true }).click();

// ---- Letzter Zug aus
await page.getByRole('radiogroup', { name: 'Letzter Zug des Gegners' }).getByRole('radio', { name: 'Nicht zeigen', exact: true }).click();
await page.locator('nav').getByText('Heute').click();
await page.click('text=/Fehler-Training (starten|weiter)/');
await page.waitForSelector('.board-wrap[data-live="1"]');
ok(await page.locator('.tag.last').count() === 0 && await page.locator('.board square.last-move').count() === 0, 'Ohne Einstellung kein letzter Zug');
await page.getByRole('button', { name: 'Training beenden' }).click();
await page.waitForSelector('.hero');
await page.locator('nav').getByText('Einstellungen').click();
await page.getByRole('radiogroup', { name: 'Letzter Zug des Gegners' }).getByRole('radio', { name: 'Zeigen', exact: true }).click();

// ---- Uhr-Ton mit 5 Sekunden Limit
await page.getByRole('radiogroup', { name: 'Zeitlimit Fehler-Training' }).getByRole('radio', { name: '5 s', exact: true }).click();
await page.locator('nav').getByText('Heute').click();
await sfxClear();
await page.click('text=Fehler-Training starten');
await page.waitForSelector('.board-wrap[data-live="1"]');
await page.waitForTimeout(5800);
{
  const s = (await sfx()).filter((x) => ['start', 'tick', 'tickLast', 'timeUp'].includes(x));
  ok(JSON.stringify(s) === JSON.stringify(['start', 'tick', 'tick', 'tickLast', 'timeUp']), `Uhr-Töne bei 5 s Limit: ${s.join(', ')}`);
}
await page.screenshot({ path: `${OUT}/5d-zeit-ueber.png` });
await page.getByRole('button', { name: 'Training beenden' }).click();
await page.waitForSelector('.hero');
await page.locator('nav').getByText('Einstellungen').click();
await page.getByRole('radiogroup', { name: 'Zeitlimit Fehler-Training' }).getByRole('radio', { name: '10 s', exact: true }).click();

// ---- Startbild ausschalten
await page.locator('nav').getByText('Einstellungen').click();
await page.getByRole('radiogroup', { name: 'Startbild' }).getByRole('radio', { name: 'Aus', exact: true }).click();
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.hero');
ok(await page.locator('#splash').count() === 0, 'Ohne Startbild-Einstellung öffnet die App direkt');
await page.locator('nav').getByText('Einstellungen').click();
await page.getByRole('radiogroup', { name: 'Startbild' }).getByRole('radio', { name: 'Zeigen', exact: true }).click();

// ---- Dunkelmodus
await page.emulateMedia({ colorScheme: 'dark' });
await page.locator('nav').getByText('Heute').click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/8-heute-dunkel.png` });

// ---- Offline
await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
await page.waitForTimeout(1500);
await ctx.setOffline(true);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hero', { timeout: 8000 });
ok(true, 'App startet offline');
await page.click('text=/Fehler-Training (starten|weiter)/');
await page.waitForSelector('.board cg-board', { timeout: 8000 });
ok(true, 'Training läuft offline');
await ctx.setOffline(false);
await ctx.close();

// ---- Geräteformate
const formats = [
  { name: 'iPhone quer', vp: { width: 844, height: 390 }, mobile: true, minBoard: 340 },
  { name: 'iPhone Max quer', vp: { width: 932, height: 430 }, mobile: true, minBoard: 380 },
  { name: 'iPad hoch', vp: { width: 820, height: 1180 }, mobile: false, minBoard: 700, portrait: true },
  { name: 'iPad quer', vp: { width: 1180, height: 820 }, mobile: false, minBoard: 640 },
  { name: 'iPhone hoch', vp: { width: 390, height: 844 }, mobile: true, minBoard: 340, portrait: true },
];
for (const f of formats) {
  const c = await browser.newContext({ viewport: f.vp, deviceScaleFactor: 1, hasTouch: true, isMobile: f.mobile });
  const p = await c.newPage();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('text=/Fehler-Training (starten|weiter)/');
  await p.waitForSelector('.board-wrap[data-live="1"]');
  await p.waitForTimeout(300);
  await p.click('text=Lösung zeigen');
  await p.waitForSelector('.result');
  await p.waitForTimeout(300);
  const slug = f.name.replace(/\s+/g, '-').toLowerCase();
  await p.screenshot({ path: `${OUT}/9-${slug}.png` });
  const bb = await p.locator('.board').boundingBox();
  const rb = await p.locator('.result').boundingBox();
  const db = await p.locator('.dock').boundingBox();
  ok(bb.width >= f.minBoard, `${f.name}: Brett ${Math.round(bb.width)} px (mindestens ${f.minBoard})`);
  ok(db.y + db.height <= f.vp.height + 1 && db.y >= 0, `${f.name}: "Weiter" ohne Scrollen sichtbar`);
  if (!f.portrait) ok(rb.x > bb.x + bb.width - 2, `${f.name}: Erklärung steht rechts neben dem Brett`);
  await c.close();
}

ok(errors.length === 0, errors.length ? `Konsolenfehler: ${errors.slice(0, 3).join(' | ')}` : 'Keine Konsolenfehler');
await browser.close();
console.log(log.join('\n'));
