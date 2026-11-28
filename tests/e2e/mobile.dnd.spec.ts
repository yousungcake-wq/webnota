import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

// WS-03 touch: long press, then drag. A quick swipe still scrolls / does nothing.
test('phone: long-press drag reorders pages on the home tree', async ({ page, context }) => {
  await openApp(page)
  await page.getByRole('button', { name: '뒤로' }).click()
  for (const t of ['Xray', 'Yank']) {
    await page.locator('.fab').tap()
    await page.waitForURL(/#\/w\/[^/]+\/v\//)
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
  await page.waitForTimeout(700) // long press (500ms)
  for (let i = 1; i <= 6; i++) {
    const y = from.y + from.height / 2 + ((to.y + 4 - (from.y + from.height / 2)) * i) / 6
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(titles).toHaveText(['WebNota 시작하기', 'Yank', 'Xray'])
  await expect(page.locator('.tabbar')).toBeVisible() // the release did not open the page
})

// MB-12 (M7-03): a long press released without moving opens the page's menu sheet.
test('phone: long press on a tree row or a favorite opens its menu; a short tap opens the page', async ({
  page,
  context,
}) => {
  await openApp(page)
  await page.getByRole('button', { name: '뒤로' }).click()
  const row = page.locator('.tree-row', { hasText: 'WebNota 시작하기' })
  const box = (await row.boundingBox())!
  const cdp = await context.newCDPSession(page)
  const hold = async (x: number, y: number, ms: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await page.waitForTimeout(ms)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  await hold(box.x + 120, box.y + box.height / 2, 700)
  const sheet = page.locator('.sheet')
  await expect(sheet).toBeVisible()
  await expect(page.locator('.tabbar')).toBeVisible() // still home: the release did not open the page
  await sheet.locator('.menu-item', { hasText: '즐겨찾기에 추가' }).tap()
  await expect(sheet).toHaveCount(0)

  await page.locator('.tab', { hasText: '즐겨찾기' }).tap()
  const fav = page.locator('.fav-list .list-item').first()
  await expect(fav).toBeVisible()
  const fb = (await fav.boundingBox())!
  await hold(fb.x + 100, fb.y + fb.height / 2, 700)
  await expect(page.locator('.sheet .menu-item', { hasText: '즐겨찾기에서 제거' })).toBeVisible()
  await page.goBack()
  await expect(page.locator('.sheet')).toHaveCount(0)

  // a short tap still opens the page
  await hold(fb.x + 100, fb.y + fb.height / 2, 60)
  await expect(page.locator('.wn-editor')).toBeVisible()
})
