import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: @ menu is tappable and inserts a page mention (ED-I04)', async ({ page }) => {
  await openApp(page)
  await page.locator('.wn-editor p').first().tap()
  await page.keyboard.press('End')
  await page.keyboard.type(' @WebNota')
  const option = page.getByRole('listbox', { name: '멘션' }).getByRole('option').first()
  await expect(option).toContainText('WebNota 시작하기')
  await option.tap()
  await expect(page.locator('.wn-editor .mention[data-kind="page"]')).toHaveCount(1)
})
