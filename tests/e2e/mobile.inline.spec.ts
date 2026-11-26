import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: emoji suggestion is tappable (ED-I07)', async ({ page }) => {
  await openApp(page)
  await page.locator('.wn-editor p').first().tap()
  await page.keyboard.press('End')
  await page.keyboard.type(' :grinning')
  const option = page.getByRole('listbox', { name: '이모지 제안' }).getByRole('option').first()
  await expect(option).toContainText('😀')
  await option.tap()
  await expect(page.locator('.wn-editor p').first()).toContainText('😀')
})
