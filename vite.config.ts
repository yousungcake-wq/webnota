import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages project sites live under /<repo>/; the deploy workflow sets VITE_BASE.
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // lowlight's entry re-exports every highlight.js grammar (not tree-shaken): use the
      // core only; grammars are imported one by one (features/editor/code/languages.ts).
      {
        find: /^lowlight$/,
        replacement: fileURLToPath(new URL('./node_modules/lowlight/lib/index.js', import.meta.url)),
      },
    ],
  },
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev') },
  plugins: [
    // M7-00: the bubble menu only needs `instanceof CellSelection` — don't pull in all of
    // prosemirror-tables for that (src/features/editor/table/cellSelectionShim.ts)
    {
      name: 'bubble-menu-cell-selection',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source === '@tiptap/pm/tables' && importer?.includes('extension-bubble-menu'))
          return fileURLToPath(new URL('./src/features/editor/table/cellSelectionShim.ts', import.meta.url))
        return null
      },
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icons/apple-touch-icon-180.png'],
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
        // PNGs first: some Android launchers ignore SVG icons (MB-42). Regenerate with scripts/gen-icons.mjs.
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        // MB-44: long-press shortcuts. Names stay Korean like the rest of the manifest (lang: ko).
        shortcuts: [
          {
            name: '새 페이지',
            short_name: '새 페이지',
            url: `${base}?action=new-page`,
            icons: [{ src: 'icons/shortcut-new-96.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: '검색',
            short_name: '검색',
            url: `${base}#/search`,
            icons: [{ src: 'icons/shortcut-search-96.png', sizes: '96x96', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,png}'],
        // KaTeX fonts (~60 files) only matter on pages with math: cached when first used
        globIgnores: ['**/KaTeX_*'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/KaTeX_[^/]+\.(woff2|woff|ttf)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'katex-fonts', expiration: { maxEntries: 80 } },
          },
        ],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  build: {
    target: 'es2022',
    // The manifest lets scripts/check-size.mjs measure real eager/lazy chunk graphs.
    manifest: true,
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'app', tags: ['$initial'] }] } },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
  },
})
