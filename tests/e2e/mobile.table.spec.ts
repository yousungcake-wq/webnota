import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: insert a table from the block panel, table menu opens as a sheet (ED-B16)', async ({ page }) => {
  await openApp(page)
  await page.locator('.wn-editor p').first().tap()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '블록 추가' }).tap()
  await page.locator('.kb-panel').getByRole('button', { name: '표', exact: true }).tap()
  const table = page.locator('.wn-editor table')
  await expect(table.locator('tr')).toHaveCount(3)
  await table.locator('td').first().tap()
  await page.getByRole('button', { name: '표 메뉴' }).tap()
  await expect(page.getByRole('dialog', { name: '표 메뉴' })).toBeVisible()
  await page.getByRole('menuitem', { name: '오른쪽에 열 추가' }).tap()
  await expect(table.locator('tr').first().locator('th')).toHaveCount(4)
})
