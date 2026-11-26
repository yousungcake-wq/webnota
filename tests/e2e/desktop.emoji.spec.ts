import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'

test('icon picker: search emoji (Korean/English), recent, named icon with color (ED-F12)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await page.locator('.page-icon').click()
  const picker = page.locator('.emoji-picker')
  await picker.getByPlaceholder('이모지 검색 (한/영)').fill('로켓')
  await picker.getByRole('button', { name: '🚀', exact: true }).click()
  await expect(page.locator('.page-icon')).toHaveText('🚀')

  await page.locator('.page-icon').click()
  await picker.getByPlaceholder('이모지 검색 (한/영)').fill('purple heart')
  await expect(picker.getByRole('button', { name: '💜', exact: true })).toBeVisible()
  await picker.getByPlaceholder('이모지 검색 (한/영)').fill('')
  await expect(picker.getByRole('heading', { name: '최근 사용' })).toBeVisible()

  await picker.getByRole('radio', { name: '아이콘' }).click()
  await picker.getByRole('radio', { name: '초록' }).click()
  await picker.getByRole('button', { name: 'rocket' }).click()
  await expect(page.locator('.page-icon svg')).toBeVisible()
  await expect(page.locator('.sidebar .tree-row', { hasText: 'WebNota' }).locator('.tree-icon svg')).toBeVisible()
  check()
})
