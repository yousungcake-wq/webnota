import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: find in page from the page menu (ED-F07)', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '더보기' }).first().tap()
  await page.getByRole('menuitem', { name: '페이지에서 찾기' }).tap()
  const bar = page.getByRole('search', { name: '찾기' })
  await expect(bar).toBeVisible()
  await bar.getByLabel('찾기').fill('GitHub')
  await expect(bar.locator('.find-count')).toHaveText(/^1\/\d+$/)
  await expect(page.locator('.wn-editor .find-match.is-current')).toHaveCount(1)
})
