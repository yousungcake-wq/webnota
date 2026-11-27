import { expect, test } from '@playwright/test'
import { openApp, reload, waitForNewPage } from './helpers'

test('headings 4–6 by markdown; nested numbered lists cycle 1/a/i (ED-B02, ED-B05)', async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  const ed = page.locator('.wn-editor')
  await ed.click()
  await page.keyboard.type('#### Four')
  await page.keyboard.press('Enter')
  await page.keyboard.type('###### Six')
  await page.keyboard.press('Enter')
  await expect(ed.locator('h4')).toHaveText('Four')
  await expect(ed.locator('h6')).toHaveText('Six')

  await page.keyboard.type('1. one')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await page.keyboard.type('nested')
  await expect(ed.locator('ol ol li')).toHaveText('nested')
  const style = await ed.locator('ol ol').evaluate((el) => getComputedStyle(el).listStyleType)
  expect(style).toBe('lower-alpha')
  await reload(page)
  await expect(page.locator('.wn-editor h4')).toHaveText('Four')
})
