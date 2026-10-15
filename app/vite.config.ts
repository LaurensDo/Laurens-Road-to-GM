import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages: https://laurensdo.github.io/Laurens-Road-to-GM/
const base = process.env.BASE ?? '/Laurens-Road-to-GM/';

export default defineConfig({
  base,
  plugins: [
    preact(),
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
        orientation: 'portrait',
        background_color: '#f4f6f4',
        theme_color: '#1d6b58',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 8_000_000,
      },
    }),
  ],
  build: { target: 'es2020', sourcemap: false },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
