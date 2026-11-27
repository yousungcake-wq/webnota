// Database benchmark (spec/05 §11, M4-14): 10,000 rows × 20 fields, CPU 4× throttled.
//   npm run build && node tests/perf/database.mjs   (THROTTLE=1 for an unthrottled run)
import { spawn } from 'node:child_process'
import { chromium } from '@playwright/test'

const PORT = 4176
const BASE = `http://localhost:${PORT}/`
const RUNS = 5
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ko-KR' })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
const throttle = (rate) => cdp.send('Emulation.setCPUThrottlingRate', { rate })
const results = {}

// seed (not measured, unthrottled): QA database 10000 (20 fields)
await page.addInitScript(() => {
  localStorage.setItem('webnota:flags', JSON.stringify({ database: true }))
  localStorage.setItem('webnota:debug', 'seed-db-10k')
})
let t = Date.now()
await page.goto(BASE)
await page.locator('.dbg-row').first().waitFor({ timeout: 120_000 })
results.seedMs = Date.now() - t
await page.waitForTimeout(3000) // IndexedDB writes settle
const RATE = Number(process.env.THROTTLE ?? 4)
await throttle(RATE)

// 1. open the grid from another page (docs in IndexedDB, not in memory: fresh reload each run)
const open = []
for (let i = 0; i < RUNS; i++) {
  await page.goto(`${BASE}#/`)
  await page.reload()
  await page.locator('.tree-link', { hasText: 'WebNota' }).first().click()
  await page.locator('.wn-editor').waitFor()
  open.push(
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const link = [...document.querySelectorAll('.tree-link')].find((a) => a.textContent.includes('QA database'))
          const t0 = performance.now()
          let first = 0
          // first screen (M5-00: the cached preview), then the live, editable grid
          const check = () => {
            const rows = document.querySelectorAll('.dbg-row').length
            const grid = document.querySelector('.dbg')
            const shown = rows > 5 && grid?.getAttribute('aria-rowcount') === '10001'
            if (shown && !first) first = Math.round(performance.now() - t0)
            if (shown && !document.querySelector('.db-view[data-preview]'))
              resolve([first, Math.round(performance.now() - t0)])
            else requestAnimationFrame(check)
          }
          link.click()
          requestAnimationFrame(check)
        }),
    ),
  )
}
results.openGrid10kMs = median(open.map((o) => o[0]))
results.openLive10kMs = median(open.map((o) => o[1]))
// phases of the last open (performance marks in session.ts)
results.openPhases = await page.evaluate(() => {
  const at = (n) => performance.getEntriesByName(n).at(-1)?.startTime ?? 0
  const o = at('db:open')
  return {
    preview: Math.round(at('db:preview') - o),
    docs: Math.round(at('db:docs') - o),
    rows: Math.round(at('db:rows') - o),
    query: Math.round(at('db:query') - o),
  }
})

// 2. scroll: 120 frames moving 120px each (a fast flick, ~7,000px/s at 60fps); fps from frame times
results.scrollFps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const el = document.querySelector('.dbg')
      const times = []
      let n = 0
      let last = performance.now()
      const step = (now) => {
        times.push(now - last)
        last = now
        el.scrollTop += 120
        if (++n < 120) requestAnimationFrame(step)
        else {
          times.shift()
          const avg = times.reduce((a, b) => a + b, 0) / times.length
          resolve(Math.round(1000 / avg))
        }
      }
      requestAnimationFrame(step)
    }),
)
await page.evaluate(() => (document.querySelector('.dbg').scrollTop = 0))
await page.waitForTimeout(300)

// 3. cell edit → painted: commit a typed value, time to the cell showing it
const edits = []
const first = page.locator('.dbg-row[aria-rowindex="2"] [aria-colindex="1"]')
for (let i = 0; i < RUNS; i++) {
  await first.click()
  await page.keyboard.type('x')
  await page.locator('.dbc-editor').waitFor()
  edits.push(
    await page.evaluate(
      (i) =>
        new Promise((resolve) => {
          const input = document.querySelector('.dbc-editor')
          const value = `edit ${i}`
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
          setter.call(input, value)
          input.dispatchEvent(new Event('input', { bubbles: true }))
          const cell = document.querySelector('.dbg-row[aria-rowindex="2"] [aria-colindex="1"]')
          const t0 = performance.now()
          const obs = new MutationObserver(() => {
            if (cell.textContent.startsWith(value)) {
              obs.disconnect()
              requestAnimationFrame(() => resolve(performance.now() - t0))
            }
          })
          obs.observe(cell, { subtree: true, childList: true, characterData: true })
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        }),
      i,
    ),
  )
}
results.cellEditToPaintMs = Math.round(median(edits) * 10) / 10

// 4. filter change (worker): Name contains "99" → row count updates
await page.getByRole('button', { name: '필터', exact: true }).click()
await page.getByRole('dialog', { name: '필터' }).getByRole('button', { name: '필터 추가' }).click()
const filters = []
for (let i = 0; i < RUNS; i++) {
  filters.push(
    await page.evaluate(
      (q) =>
        new Promise((resolve) => {
          const input = document.querySelector('.db-filter .db-input')
          const grid = document.querySelector('.dbg')
          const before = grid.getAttribute('aria-rowcount')
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
          const t0 = performance.now()
          const obs = new MutationObserver(() => {
            if (grid.getAttribute('aria-rowcount') !== before) {
              obs.disconnect()
              requestAnimationFrame(() => resolve(performance.now() - t0))
            }
          })
          obs.observe(grid, { attributes: true, attributeFilter: ['aria-rowcount'] })
          setter.call(input, q)
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }),
      i % 2 ? '' : `${9 - i}`,
    ),
  )
}
results.filterChangeMs = Math.round(median(filters))

await browser.close()
server.kill()
console.log(JSON.stringify({ cpuThrottle: RATE, rows: 10000, fields: 20, runs: RUNS, ...results }, null, 2))
