import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: rename from the more sheet uses a dialog', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '더보기' }).tap()
  await page.getByRole('menuitem', { name: '이름 바꾸기' }).tap()
  const dialog = page.getByRole('dialog', { name: '이름 바꾸기' })
  await dialog.getByLabel('페이지 제목').fill('폰에서 바꾼 제목')
  await dialog.getByRole('button', { name: '확인' }).tap()
  await expect(page.locator('.page-title')).toHaveValue('폰에서 바꾼 제목')
})

test('phone: change icon from the more sheet', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '더보기' }).tap()
  await page.getByRole('menuitem', { name: '아이콘 변경' }).tap()
  await page.locator('.emoji-btn', { hasText: '🚀' }).tap()
  await expect(page.locator('.page-icon')).toHaveText('🚀')
  await expect(page.locator('.page-title')).toBeVisible()
})
