// Performance baseline (spec/10 §3). Runs against `vite preview` with 4× CPU throttling
// (mid-range Android) and prints JSON for docs/perf-history.md.
//   npm run build && npm run perf
import { spawn } from 'node:child_process'
import { chromium, devices } from '@playwright/test'

const PORT = 4175
const BASE = `http://localhost:${PORT}/`
const RUNS = 5

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

async function withPage(fn, { throttle = 4, mobile = true } = {}) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ ...(mobile ? devices['Pixel 7'] : {}), locale: 'ko-KR' })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
  try {
    return await fn(page, ctx)
  } finally {
    await browser.close()
  }
}

const results = {}

// 1. First run (no cache): until the welcome page editor shows. Includes seeding.
const first = []
for (let i = 0; i < RUNS; i++)
  first.push(
    await withPage(async (page) => {
      const t0 = Date.now()
      await page.goto(BASE)
      await page.locator('.wn-editor').waitFor()
      return Date.now() - t0
    }),
  )
results.firstRunEditorMs = median(first)

// 2. Revisit: sidebar/home visible, then editor visible (same context = IndexedDB + HTTP cache).
const revisitShell = []
const revisitEditor = []
const switchMs = []
const typingMs = []
await withPage(async (page) => {
  await page.goto(BASE)
  await page.locator('.wn-editor').waitFor()
  // make a few pages for switching (phone layout: create from the home tab FAB isn't needed; use desktop-free path)
  for (let i = 0; i < RUNS; i++) {
    const t0 = Date.now()
    await page.goto(`${BASE}#/`)
    await page.reload()
    await page.locator('.tabbar').waitFor()
    revisitShell.push(Date.now() - t0)
    const link = page.locator('a[href*="#/page/"]').first()
    const t1 = Date.now()
    await link.click()
    await page.locator('.wn-editor').waitFor()
    revisitEditor.push(Date.now() - t1)
  }
  // 3. Typing latency: time from key press to the character in the DOM.
  await page.locator('.wn-editor p').first().click()
  for (let i = 0; i < 20; i++) {
    const ms = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const el = document.querySelector('.wn-editor')
          const before = el.textContent.length
          const t0 = performance.now()
          const obs = new MutationObserver(() => {
            if (el.textContent.length !== before) {
              obs.disconnect()
              requestAnimationFrame(() => resolve(performance.now() - t0))
            }
          })
          obs.observe(el, { subtree: true, characterData: true, childList: true })
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
          document.execCommand('insertText', false, 'a')
        }),
    )
    typingMs.push(ms)
  }
})
results.revisitShellMs = median(revisitShell)
results.openPageFromHomeMs = median(revisitEditor)
results.typingToPaintMs = Math.round(median(typingMs) * 10) / 10

// 4. Page switch on desktop between two pages already in IndexedDB.
await withPage(
  async (page) => {
    await page.goto(BASE)
    await page.locator('.wn-editor').waitFor()
    await page.click('.sidebar-bottom >> text=새 페이지')
    await page.waitForFunction(() => document.querySelector('.page-title')?.value === '')
    await page.fill('.page-title', 'B')
    const links = page.locator('.tree-link')
    for (let i = 0; i < RUNS * 2; i++) {
      const t0 = Date.now()
      await links.nth(i % 2).click()
      await page.waitForFunction(
        (want) => document.querySelector('.page-title')?.value === want,
        i % 2 ? 'B' : 'WebNota 시작하기',
      )
      await page.locator('.wn-editor').waitFor()
      switchMs.push(Date.now() - t0)
    }
  },
  { mobile: false },
)
results.pageSwitchDesktopMs = median(switchMs)

server.kill()
console.log(JSON.stringify({ cpuThrottle: 4, runs: RUNS, ...results }, null, 2))
