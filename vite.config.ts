import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages project sites live under /<repo>/; the deploy workflow sets VITE_BASE.
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev') },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'WebNota',
        short_name: 'WebNota',
        description: '설치 없이 쓰는 빠른 노트 웹앱',
        lang: 'ko',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  build: {
    target: 'es2022',
    // The manifest lets scripts/check-size.mjs measure real eager/lazy chunk graphs.
    manifest: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
