import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, reload, waitForNewPage } from './helpers'

test('callout: slash menu, change icon and color, persists (ED-B09)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
  await page.keyboard.type('/콜아웃')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Important note')
  const callout = page.locator('.wn-editor .callout')
  await expect(callout).toContainText('Important note')
  await expect(callout.locator('.callout-icon')).toHaveText('💡')

  await callout.locator('.callout-icon').click()
  await page.getByRole('radio', { name: '파랑' }).click()
  await expect(callout).toHaveAttribute('data-color', 'blue')
  await callout.locator('.callout-icon').click()
  await page.getByPlaceholder('이모지 검색 (한/영)').fill('rocket')
  await page.getByRole('button', { name: '🚀', exact: true }).click()
  await expect(callout.locator('.callout-icon')).toHaveText('🚀')

  await page.waitForTimeout(300)
  await reload(page)
  await expect(page.locator('.wn-editor .callout')).toHaveAttribute('data-color', 'blue')
  await expect(page.locator('.wn-editor .callout-icon')).toHaveText('🚀')
  check()
})
