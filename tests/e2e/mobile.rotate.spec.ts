import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'

test.describe('rotation and split screen (MB-18, M7-08)', () => {
  test('turning the phone sideways keeps the phone UI, the open sheet and the caret', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openApp(page)
    const vp = page.viewportSize()!
    await page.locator('.wn-editor p').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type('XYZ')
    await page.setViewportSize({ width: vp.height, height: vp.width })
    await expect(page.locator('.phone')).toBeVisible()
    await page.keyboard.type('!')
    await expect(page.locator('.wn-editor p').first()).toContainText('XYZ!')

    await page.getByLabel('더보기').tap()
    await expect(page.locator('.sheet')).toBeVisible()
    await page.setViewportSize(vp)
    await expect(page.locator('.sheet')).toBeVisible()
    await page.goBack()
    noErrors()
  })

  test('a split screen crossing into the phone layout keeps the scroll and the caret', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    // a touch tablet: 900px wide is the tablet layout, 600px the phone layout
    await page.setViewportSize({ width: 900, height: 1100 })
    await openApp(page)
    await expect(page.locator('.phone')).toHaveCount(0)
    const editor = page.locator('.wn-editor')
    await editor.locator('p').last().click()
    for (let i = 0; i < 40; i++) await page.keyboard.press('Enter')
    await page.keyboard.type('맨 아래')
    const scroller = page.locator('.page-scroll')
    const before = await scroller.evaluate((el) => el.scrollTop)
    expect(before).toBeGreaterThan(200)
    await page.setViewportSize({ width: 600, height: 1100 })
    await expect(page.locator('.phone')).toBeVisible()
    await expect.poll(() => page.locator('.page-scroll').evaluate((el) => el.scrollTop)).toBeGreaterThan(200)
    await page.keyboard.type('!')
    await expect(page.locator('.wn-editor p', { hasText: '맨 아래!' })).toHaveCount(1)
    noErrors()
  })
})
