import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: columns stay side by side with a divider (ED-B17, feedback 3)', async ({ page }) => {
  await openApp(page)
  await page.locator('.wn-editor p').first().tap()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '블록 추가' }).tap()
  await page.locator('.kb-panel').getByRole('button', { name: '2열', exact: true }).tap()
  const cols = page.locator('.wn-editor .columns .column')
  await expect(cols).toHaveCount(2)
  const a = (await cols.nth(0).boundingBox())!
  const b = (await cols.nth(1).boundingBox())!
  expect(Math.abs(b.y - a.y)).toBeLessThan(2) // same row
  expect(b.x).toBeGreaterThan(a.x + a.width - 1)
  await expect(cols.nth(1)).toHaveCSS('border-left-style', 'solid')
  // the phone handle is for the block inside the column
  await cols.nth(1).locator('p').tap()
  await page.locator('.phone-grip').tap()
  await expect(page.getByRole('menuitem', { name: '복제' })).toBeVisible()
})
