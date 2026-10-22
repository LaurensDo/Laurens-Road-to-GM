// Erzeugt die iOS-Startbilder (apple-touch-startup-image) aus dem echten Startbild der App, ohne Zitat und Beschriftung.
// Aufruf: npx vite preview --port 4173 &  dann  node tools/make-launch-images.mjs
// Neue Geräte: Eintrag in DEVICES ergänzen (Punkte, Faktor) und die passende <link>-Zeile in index.html.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = 'http://localhost:4173/Laurens-Road-to-GM/';
const OUT = new URL('../public/launch/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
// iPhone 13 (gleiche Maße wie iPhone 12, 12 Pro, 13 Pro, 14) und iPad Pro 12,9 Zoll
const DEVICES = [
  { name: 'ipad-pro-12-9', w: 1024, h: 1366, dpr: 2 },
  { name: 'iphone-13', w: 390, h: 844, dpr: 3 },
];
// ONLY=iphone-13 erzeugt nur die Bilder eines Geräts

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const d of DEVICES.filter((x) => !process.env.ONLY || x.name === process.env.ONLY)) {
  for (const [orient, vw, vh] of [['portrait', d.w, d.h], ['landscape', d.h, d.w]]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: d.dpr, colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'commit' });
    await page.waitForSelector('#splash .splash-mark');
    await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}.splash-quote,.splash-foot{visibility:hidden!important}' });
    await page.waitForTimeout(250);
    const file = `${OUT}${d.name}-${orient}.png`;
    await page.screenshot({ path: file });
    // verlustfrei verkleinern (ohne Farbreduktion: der weiße Bauer würde sonst verwaschen)
    try {
      execFileSync('python3', ['-c', 'import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB");im.save(sys.argv[1],optimize=True,compress_level=9)', file]);
    } catch {
      console.log('(Pillow fehlt: Bild bleibt unoptimiert)');
    }
    console.log(file, `${vw * d.dpr}×${vh * d.dpr}`, `${Math.round(statSync(file).size / 1024)} KB`);
    await ctx.close();
  }
}
await browser.close();
