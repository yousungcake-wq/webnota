import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: home shows recently opened pages, newest first (WS-05)', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '뒤로' }).click()
  await page.locator('.fab').tap()
  await page.waitForURL(/#\/page\//)
  await page.fill('.page-title', 'Recent X')
  await page.getByRole('button', { name: '뒤로' }).click()
  const recent = page.locator('.recent-list .list-title')
  await expect(recent).toHaveText(['Recent X', 'WebNota 시작하기'])
  await page.locator('.tree-link', { hasText: 'WebNota' }).tap()
  await page.getByRole('button', { name: '뒤로' }).click()
  await expect(recent).toHaveText(['WebNota 시작하기', 'Recent X'])
  await page.reload()
  await expect(recent).toHaveText(['WebNota 시작하기', 'Recent X'])
})
