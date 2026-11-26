import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

// WS-03 touch: long press, then drag. A quick swipe still scrolls / does nothing.
test('phone: long-press drag reorders pages on the home tree', async ({ page, context }) => {
  await openApp(page)
  await page.getByRole('button', { name: '뒤로' }).click()
  for (const t of ['Xray', 'Yank']) {
    await page.locator('.fab').tap()
    await page.waitForURL(/#\/page\//)
    await page.fill('.page-title', t)
    await page.getByRole('button', { name: '뒤로' }).click()
  }
  const titles = page.locator('.tree .tree-title')
  await expect(titles).toHaveText(['WebNota 시작하기', 'Xray', 'Yank'])

  const from = (await page.locator('.tree-row', { hasText: 'Yank' }).boundingBox())!
  const to = (await page.locator('.tree-row', { hasText: 'Xray' }).boundingBox())!
  const x = from.x + 120
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: from.y + from.height / 2 }] })
  await page.waitForTimeout(550) // long press
  for (let i = 1; i <= 6; i++) {
    const y = from.y + from.height / 2 + ((to.y + 4 - (from.y + from.height / 2)) * i) / 6
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(titles).toHaveText(['WebNota 시작하기', 'Yank', 'Xray'])
  await expect(page.locator('.tabbar')).toBeVisible() // the release did not open the page
})
