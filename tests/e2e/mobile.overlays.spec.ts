import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

test.describe('phone overlays', () => {
  let assertNoErrors: () => void
  test.beforeEach(async ({ page }) => {
    assertNoErrors = failOnConsoleErrors(page)
    await openApp(page)
  })
  test.afterEach(() => assertNoErrors())

  test('back button closes the sheet and stays on the page (MB-14)', async ({ page }) => {
    const url = page.url()
    await page.getByLabel('더보기').tap()
    await expect(page.locator('.sheet')).toBeVisible()
    await page.goBack()
    await expect(page.locator('.sheet')).toHaveCount(0)
    expect(page.url()).toBe(url)
    await expect(page.locator('.wn-editor')).toBeVisible()
    // The next back leaves the page for the home tabs, as before.
    await page.getByLabel('뒤로').tap()
    await expect(page.locator('.tab')).toHaveCount(4)
  })

  test('a sheet item that navigates lands on the new page; back returns', async ({ page }) => {
    const parentUrl = page.url()
    await page.getByLabel('더보기').tap()
    await page.locator('.menu-item', { hasText: '하위 페이지 추가' }).tap()
    await waitForNewPage(page)
    await expect(page.locator('.sheet')).toHaveCount(0)
    expect(page.url()).not.toBe(parentUrl)
    await page.getByLabel('뒤로').tap()
    await expect(page).toHaveURL(parentUrl)
  })

  test('drag the sheet handle down to close it', async ({ page, context }) => {
    await page.getByLabel('더보기').tap()
    const sheet = page.locator('.sheet')
    await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
    const box = (await page.locator('.sheet-handle').boundingBox())!
    const x = box.x + box.width / 2
    const cdp = await context.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: box.y + 10 }] })
    for (let i = 1; i <= 5; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: box.y + 10 + i * 40 }] })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(sheet).toHaveCount(0)
  })
})
