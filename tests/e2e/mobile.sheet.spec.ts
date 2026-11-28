import { expect, test, type CDPSession, type Page } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'

/** A finger drag from (x, y) by dy px, in steps. */
async function drag(cdp: CDPSession, x: number, y: number, dy: number) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (dy * i) / 6 }] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}
const settled = (page: Page) =>
  page.locator('.sheet').evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
const height = (page: Page) => page.locator('.sheet').evaluate((el) => el.getBoundingClientRect().height)

test.describe('phone bottom sheet (MB-10, M7-01)', () => {
  let assertNoErrors: () => void
  test.beforeEach(async ({ page }) => {
    assertNoErrors = failOnConsoleErrors(page)
    await openApp(page)
  })
  test.afterEach(() => assertNoErrors())

  test('height steps: drag the handle up to full, down to auto, down again to close', async ({ page, context }) => {
    // a short screen so the page menu does not fit in the auto step
    const vp = page.viewportSize()!
    await page.setViewportSize({ width: vp.width, height: 560 })
    await page.getByLabel('더보기').tap()
    const sheet = page.locator('.sheet')
    await expect(sheet).toHaveAttribute('data-size', 'auto')
    await settled(page)
    expect(await height(page)).toBeLessThanOrEqual(560 * 0.85 + 1)
    const cdp = await context.newCDPSession(page)
    const handle = async () => {
      const box = (await page.locator('.sheet-handle').boundingBox())!
      return { x: box.x + box.width / 2, y: box.y + 8 }
    }
    let h = await handle()
    await drag(cdp, h.x, h.y, -200)
    await expect(sheet).toHaveAttribute('data-size', 'full')
    await settled(page)
    await expect.poll(() => height(page)).toBeGreaterThan(560 - 60)
    h = await handle()
    await drag(cdp, h.x, h.y, 120)
    await expect(sheet).toHaveAttribute('data-size', 'auto')
    await expect(sheet).toBeVisible()
    await settled(page)
    h = await handle()
    await drag(cdp, h.x, h.y, 120)
    await expect(sheet).toHaveCount(0)
  })

  test('the content: scrolling inside does not drag; at the top a drag down closes', async ({ page, context }) => {
    const vp = page.viewportSize()!
    await page.setViewportSize({ width: vp.width, height: 560 })
    await page.getByLabel('더보기').tap()
    const sheet = page.locator('.sheet')
    await settled(page)
    // a tap on the handle expands; the content then scrolls natively
    await page.locator('.sheet-handle').tap()
    await expect(sheet).toHaveAttribute('data-size', 'full')
    await settled(page)
    const scrollable = await sheet.evaluate((el) => el.scrollHeight > el.clientHeight + 1)
    const cdp = await context.newCDPSession(page)
    const box = (await sheet.boundingBox())!
    const x = box.x + box.width / 2
    if (scrollable) {
      await sheet.evaluate((el) => (el.scrollTop = 40))
      await drag(cdp, x, box.y + box.height / 2, 100) // scrolls back up, stays open
      await expect(sheet).toHaveAttribute('data-size', 'full')
      await sheet.evaluate((el) => (el.scrollTop = 0))
    }
    // at the top: down goes to auto, then closes
    await drag(cdp, x, box.y + box.height / 2, 120)
    await expect(sheet).toHaveAttribute('data-size', 'auto')
    await settled(page)
    const b2 = (await sheet.boundingBox())!
    await drag(cdp, x, b2.y + b2.height / 2, 120)
    await expect(sheet).toHaveCount(0)
  })

  test('a menu that fits opens whole, content-sized, and cannot be expanded', async ({ page }) => {
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 900 })
    await page.getByLabel('더보기').tap()
    const sheet = page.locator('.sheet')
    await settled(page)
    expect(await sheet.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
    const before = await height(page)
    await page.locator('.sheet-handle').tap()
    await expect(sheet).toHaveAttribute('data-size', 'auto')
    expect(await height(page)).toBe(before)
  })

  test('the keyboard opening keeps the sheet height (it only shrinks to fit)', async ({ page }) => {
    await page.getByRole('button', { name: '아이콘 변경' }).tap()
    const sheet = page.locator('.sheet')
    const input = sheet.locator('input:not([type=file])').first()
    await settled(page)
    await input.tap()
    const before = await height(page)
    // the on-screen keyboard (interactive-widget=resizes-content) shrinks the viewport
    const vp = page.viewportSize()!
    await page.setViewportSize({ width: vp.width, height: vp.height - 300 })
    await expect.poll(() => height(page)).toBe(Math.min(before, vp.height - 300 - 16))
    await page.setViewportSize(vp)
    await expect.poll(() => height(page)).toBe(before)
  })
})
