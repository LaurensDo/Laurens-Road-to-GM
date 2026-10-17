import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };
const BUILD = new Date().toISOString();

// GitHub Pages: https://laurensdo.github.io/Laurens-Road-to-GM/
const base = process.env.BASE ?? '/Laurens-Road-to-GM/';

export default defineConfig({
  base,
  // Zeitpunkt des Builds: steht in den Einstellungen, damit man sieht, ob die installierte App aktuell ist
  define: { __BUILD__: JSON.stringify(BUILD), __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    preact(),
    // version.json: kleine Datei, die die App am Zwischenspeicher vorbei liest, um zu sehen, ob es eine neuere Version gibt (src/lib/updater.ts)
    {
      name: 'road-to-gm-version',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: pkg.version, build: BUILD }) });
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Road to GM',
        short_name: 'Road to GM',
        description: 'Persönlicher Schach-Trainer: eigene Fehler üben, Zeit managen.',
        lang: 'de',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0d2c24',
        theme_color: '#1d6b58',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        // version.json darf nie aus dem Zwischenspeicher kommen, sonst sieht die App neue Versionen nicht
        globIgnores: ['launch/**', 'version.json'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 8_000_000,
      },
    }),
  ],
  build: { target: 'es2020', sourcemap: false },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
