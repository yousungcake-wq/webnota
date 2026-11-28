// M8-12: import performance — 1,000 Markdown pages picked at once (time until done, JS heap).
//   npm run build && npm run perf:import
import { spawn } from 'node:child_process'
import { chromium, devices } from '@playwright/test'

const PORT = 4177
const BASE = `http://localhost:${PORT}/`
const PAGES = 1000

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))

async function run({ mobile, throttle }) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    ...(mobile ? devices['Pixel 7'] : { viewport: { width: 1280, height: 800 } }),
    locale: 'ko-KR',
  })
  const page = await ctx.newPage()
  try {
    await page.goto(BASE)
    await page.locator('.wn-editor').waitFor()
    await page.goto(`${BASE}#/settings`)
    await page.locator('[data-io-import]').waitFor()
    const files = Array.from({ length: PAGES }, (_, i) => ({
      name: `Notes/page-${String(i).padStart(4, '0')}.md`.replace('Notes/', ''),
      mimeType: 'text/markdown',
      buffer: Buffer.from(
        `# Page ${i}\n\n## Section\n\n- item one\n- item two\n\n${'Some text in a paragraph. '.repeat(20)}\n`,
      ),
    }))
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
    const chooser = page.waitForEvent('filechooser')
    await page.locator('[data-io-import]').click()
    const t0 = Date.now()
    await (await chooser).setFiles(files)
    await page.locator('.toast', { hasText: '가져왔습니다' }).waitFor({ timeout: 600_000 })
    const ms = Date.now() - t0
    const heap = await page.evaluate(() => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1024 / 1024))
    return { ms, heapMb: heap }
  } finally {
    await browser.close()
  }
}

const results = {
  pages: PAGES,
  desktop1x: await run({ mobile: false, throttle: 1 }),
  phone4x: await run({ mobile: true, throttle: 4 }),
}
server.kill()
console.log(JSON.stringify(results, null, 2))
