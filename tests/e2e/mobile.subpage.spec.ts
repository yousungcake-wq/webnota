import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: sub-page from the block panel opens the child, its block is tappable (ED-B19)', async ({ page }) => {
  await openApp(page)
  await page.locator('.wn-editor p').first().tap()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '블록 바꾸기' }).tap()
  await page.locator('.kb-panel').getByRole('button', { name: '페이지', exact: true }).tap()
  await expect(page.locator('.page-title')).toHaveValue('')
  await page.locator('.page-title').fill('폰 자식')
  await page.goBack()
  const block = page.locator('.wn-editor .sub-page')
  await expect(block).toContainText('폰 자식')
  await block.getByRole('button').first().tap()
  await expect(page.locator('.page-title')).toHaveValue('폰 자식')
})
