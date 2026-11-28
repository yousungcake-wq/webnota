import { expect, test, type Page } from '@playwright/test'
import { openApp } from './helpers'

/** Records navigator.vibrate calls (headless Chrome has no motor). */
async function stubVibrate(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __buzz: number[] }
    w.__buzz = []
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (ms: number) => {
        w.__buzz.push(ms)
        return true
      },
    })
  })
}
const buzzes = (page: Page) => page.evaluate(() => (window as unknown as { __buzz: number[] }).__buzz.length)

test('haptics: long press and task checkbox buzz; the setting turns it off (MB-16, M7-07)', async ({
  page,
  context,
}) => {
  await stubVibrate(page)
  await openApp(page)
  // a task checkbox in the welcome page
  await page.locator('.wn-editor ul[data-type="taskList"] li > label').first().tap()
  await expect.poll(() => buzzes(page)).toBe(1)

  await page.getByLabel('뒤로').tap()
  const row = (await page.locator('.tree-row').first().boundingBox())!
  const cdp = await context.newCDPSession(page)
  const hold = async () => {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: row.x + 120, y: row.y + row.height / 2 }],
    })
    await page.waitForTimeout(700)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  await hold()
  await expect(page.locator('.sheet')).toBeVisible()
  await expect.poll(() => buzzes(page)).toBe(2)
  await page.goBack()

  // off in settings
  await page.locator('.tab', { hasText: '설정' }).tap()
  const sw = page.getByRole('switch', { name: '진동' })
  await sw.tap()
  await expect(sw).toHaveAttribute('aria-checked', 'false')
  await page.locator('.tab', { hasText: '홈' }).tap()
  await expect(page.locator('.tree-row').first()).toBeVisible()
  await hold()
  await expect(page.locator('.sheet')).toBeVisible()
  expect(await buzzes(page)).toBe(2)
})
