import { expect, test } from '@playwright/test'
import { openApp, waitForNewPage } from './helpers'

test('slash menu: categories when browsing, recent first, ranked search (ED-F01)', async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
  await page.keyboard.type('/')
  const menu = page.locator('.slash-menu')
  await expect(menu.locator('.slash-heading')).toHaveText(['기본', '목록', '미디어', '고급'])
  await page.keyboard.type('code')
  await expect(menu.locator('.slash-title').first()).toHaveText('코드 블록')
  await page.keyboard.press('Enter')
  await expect(page.locator('.wn-editor pre')).toHaveCount(1)

  await page.keyboard.press('Control+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await page.keyboard.type('/')
  await expect(menu.locator('.slash-heading').first()).toHaveText('최근 사용')
  await expect(menu.locator('.slash-title').first()).toHaveText('코드 블록')
})

test('a click outside the slash menu closes it; nothing stays highlighted (feedback 2-7)', async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
  await page.keyboard.type('/he')
  await expect(page.locator('.slash-wrap')).toBeVisible()
  await page.mouse.click(1100, 760)
  await expect(page.locator('.slash-wrap')).toHaveCount(0)
  await expect(page.locator('.wn-editor .suggestion')).toHaveCount(0)
  await expect(page.locator('.wn-editor .block-selected')).toHaveCount(0)
  await page.keyboard.type('x')
  await expect(page.locator('.wn-editor p').last()).toHaveText('/hex')
})
