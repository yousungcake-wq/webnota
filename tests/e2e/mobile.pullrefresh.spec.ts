import { expect, test, type CDPSession, type Page } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'
import { connectFake, FakeGithub } from './fakeGithub'

async function pull(page: Page, cdp: CDPSession, dy: number) {
  const x = page.viewportSize()!.width / 2
  const y = 260
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (dy * i) / 8 }] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  // a touch right after another reads as a double-tap gesture in Chrome: keep them apart
  await page.waitForTimeout(400)
}

/** Records the classes the refresh bubble goes through (it shows "done" only briefly). */
async function recordBubble(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __pr: string[] }
    w.__pr = []
    new MutationObserver(() => {
      const b = document.querySelector('.pull-refresh')
      if (b) w.__pr.push(b.className)
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
  })
}
const bubbleStates = (page: Page) => page.evaluate(() => (window as unknown as { __pr: string[] }).__pr.join(' '))

test.describe('pull to refresh (MB-15, M7-06)', () => {
  test('without GitHub: says how to connect; a short pull does nothing', async ({ page, context }) => {
    const noErrors = failOnConsoleErrors(page)
    await openApp(page)
    await page.getByLabel('뒤로').tap()
    await page.waitForLoadState('networkidle') // the gesture chunk
    const cdp = await context.newCDPSession(page)
    await pull(page, cdp, 60)
    await expect(page.locator('.pull-refresh')).toHaveCount(0)
    await expect(page.locator('.toast')).toHaveCount(0)
    await pull(page, cdp, 200)
    await expect(page.locator('.toast')).toContainText('GitHub')
    noErrors()
  })

  test('connected: pulling home or favorites syncs now and shows it', async ({ page, context }) => {
    const noErrors = failOnConsoleErrors(page)
    const gh = new FakeGithub()
    await gh.install(page)
    await openApp(page)
    await connectFake(page)
    await page.locator('.tab', { hasText: '홈' }).tap()
    await expect(page.locator('.tree-row').first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    // wait for the first sync to settle
    await expect(page.locator('.home-top .sync-badge.is-ok')).toBeVisible({ timeout: 15000 })
    const cdp = await context.newCDPSession(page)
    const requests: string[] = []
    page.on('request', (r) => r.url().includes('api.github.com') && requests.push(r.url()))
    await recordBubble(page)
    await pull(page, cdp, 200)
    await expect.poll(() => bubbleStates(page)).toContain('is-done')
    await expect(page.locator('.pull-refresh')).toHaveCount(0)
    expect(requests.length).toBeGreaterThan(0)

    await page.locator('.tab', { hasText: '즐겨찾기' }).tap()
    await expect(page.locator('.view-header, .view h1').first()).toBeVisible()
    requests.length = 0
    await page.waitForLoadState('networkidle')
    await recordBubble(page)
    await pull(page, cdp, 200)
    await expect.poll(() => bubbleStates(page)).toContain('is-done')
    expect(requests.length).toBeGreaterThan(0)
    noErrors()
  })
})
