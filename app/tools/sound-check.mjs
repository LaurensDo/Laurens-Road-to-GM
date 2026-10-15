// Pegelprüfung der erzeugten Töne ohne Lautsprecher: rechnet jeden Ton offline in Chromium und meldet Spitze, Dauer und Fehler.
// Aufruf: npx vite --port 4175 &  dann  node tools/sound-check.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.goto('http://localhost:4175/Laurens-Road-to-GM/', { waitUntil: 'domcontentloaded' });
const rows = await page.evaluate(async () => {
  const m = await import('/Laurens-Road-to-GM/src/lib/sound.ts');
  const out = [];
  for (const name of Object.keys(m.VOICES)) {
    const s = await m.renderSfx(name, 44100);
    let peak = 0, sum = 0, last = 0, bad = 0;
    for (let i = 0; i < s.length; i++) {
      const a = Math.abs(s[i]);
      if (!Number.isFinite(a)) bad++;
      if (a > peak) peak = a;
      sum += s[i] * s[i];
      if (a > 0.002) last = i;
    }
    out.push({ name, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / s.length).toFixed(4), ms: Math.round((last / 44100) * 1000), bad });
  }
  return out;
});
let fail = 0;
for (const r of rows) {
  const ok = r.bad === 0 && r.peak > 0.05 && r.peak < 0.98 && r.ms > 15 && r.ms < 1100;
  if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(9)} Spitze ${String(r.peak).padEnd(6)} RMS ${String(r.rms).padEnd(7)} klingt ${String(r.ms).padStart(4)} ms`);
}
await browser.close();
process.exit(fail ? 1 : 0);
