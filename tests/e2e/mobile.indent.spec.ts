import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: toolbar indent moves a paragraph under the list above (ED-F09)', async ({ page }) => {
  await openApp(page)
  const ed = page.locator('.wn-editor')
  const lastItem = ed.locator('ul li').last()
  await lastItem.tap()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter') // out of the list
  await page.keyboard.type('폰 메모')
  await page.getByRole('button', { name: '들여쓰기', exact: true }).tap()
  await expect(ed.locator('ul li').last()).toContainText('폰 메모')
})
