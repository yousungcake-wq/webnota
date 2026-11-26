import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: columns stack vertically (ED-B17)', async ({ page }) => {
  await openApp(page)
  await page.locator('.wn-editor p').first().tap()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '블록 바꾸기' }).tap()
  await page.locator('.kb-panel').getByRole('button', { name: '2단', exact: true }).tap()
  const cols = page.locator('.wn-editor .columns .column')
  await expect(cols).toHaveCount(2)
  const a = (await cols.nth(0).boundingBox())!
  const b = (await cols.nth(1).boundingBox())!
  expect(b.y).toBeGreaterThan(a.y + a.height - 1)
})
