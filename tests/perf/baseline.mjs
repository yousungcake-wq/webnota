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

// 1b. M7-12: first run over a slow 4G line (Lighthouse's mobile preset: 150ms RTT,
// 1.6 Mbps down, 750 Kbps up) — largest contentful paint and the editor showing.
const lcp4g = []
const editor4g = []
for (let i = 0; i < 3; i++) {
  const [l, e] = await withPage(async (page, ctx) => {
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    })
    await page.addInitScript(() => {
      window.__lcp = 0
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__lcp = e.startTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    })
    const t0 = Date.now()
    await page.goto(BASE)
    await page.locator('.wn-editor').waitFor()
    const editorMs = Date.now() - t0
    await page.waitForTimeout(300)
    return [Math.round(await page.evaluate(() => window.__lcp)), editorMs]
  })
  lcp4g.push(l)
  editor4g.push(e)
}
results.firstRun4gLcpMs = median(lcp4g)
results.firstRun4gEditorMs = median(editor4g)

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
    const link = page.locator('.tree-link').first()
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
  // M7-12: JS heap after the visits above (Chromium only)
  results.heapAfterUseMb = await page.evaluate(() =>
    Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1024 / 1024),
  )
})
results.revisitShellMs = median(revisitShell)
results.openPageFromHomeMs = median(revisitEditor)
results.typingToPaintMs = Math.round(median(typingMs) * 10) / 10

// 4. Page switch on desktop between two pages already in IndexedDB.
await withPage(
  async (page) => {
    await page.goto(BASE)
    await page.locator('.wn-editor').waitFor()
    await page.click('.sidebar [data-new-page] >> nth=0')
    await page.getByRole('menuitem', { name: '문서' }).click() // M5-11: "+" offers every layout
    await page.waitForFunction(() => document.querySelector('.page-title')?.value === '')
    await page.fill('.page-title', 'B')
    await page.locator('.wn-editor').click()
    await page.keyboard.type('some text in B')
    // Measured inside the page (click → title and editor content painted): Playwright
    // round-trips would otherwise dominate (M0 measured ~187ms that way).
    for (let i = 0; i < RUNS * 2; i++) {
      const want = i % 2 ? 'B' : 'WebNota 시작하기'
      switchMs.push(
        await page.evaluate(
          (want) =>
            new Promise((resolve) => {
              const link = [...document.querySelectorAll('.tree-link')].find((a) =>
                a.textContent.includes(want === 'B' ? 'B' : 'WebNota'),
              )
              const t0 = performance.now()
              const check = () => {
                const ed = document.querySelector('.wn-editor')
                const ok =
                  document.querySelector('.page-title')?.value === want &&
                  ed?.textContent.includes(want === 'B' ? 'some text' : 'WebNota')
                if (ok) resolve(Math.round(performance.now() - t0))
                else requestAnimationFrame(check)
              }
              link.click()
              requestAnimationFrame(check)
            }),
          want,
        ),
      )
    }
  },
  { mobile: false },
)
results.pageSwitchDesktopMs = median(switchMs)

server.kill()
console.log(JSON.stringify({ cpuThrottle: 4, runs: RUNS, ...results }, null, 2))
