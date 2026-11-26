// Renders the SVG app icons to the PNG sizes launchers need (MB-42), using the
// Playwright Chromium already installed for e2e. Run after changing public/icon*.svg:
//   node scripts/gen-icons.mjs
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const out = new URL('../public/icons/', import.meta.url)
const BG = '<rect width="96" height="96" rx="20" fill="#2f6bff"/>'
const inline = {
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${BG}<path d="M48 26v44M26 48h44" stroke="#fff" stroke-width="8" stroke-linecap="round"/></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${BG}<circle cx="43" cy="43" r="16" fill="none" stroke="#fff" stroke-width="8"/><path d="M55 55l15 15" stroke="#fff" stroke-width="8" stroke-linecap="round"/></svg>`,
}
const svg = (name) => inline[name] ?? readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8')

const jobs = [
  // [file, source svg, size, transparent background]
  ['icon-192.png', 'icon.svg', 192, true],
  ['icon-512.png', 'icon.svg', 512, true],
  ['maskable-192.png', 'icon-maskable.svg', 192, false],
  ['maskable-512.png', 'icon-maskable.svg', 512, false],
  // iOS adds its own rounded mask and shows transparency as black: full-bleed, opaque.
  ['apple-touch-icon-180.png', 'icon-maskable.svg', 180, false],
  ['shortcut-new-96.png', 'plus', 96, true],
  ['shortcut-search-96.png', 'search', 96, true],
]

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const [file, src, size, transparent] of jobs) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg(src).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  )
  await page.screenshot({ path: new URL(file, out).pathname, omitBackground: transparent })
  console.log('wrote', file)
}
await browser.close()
