import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: page style sheet and cover (ED-F10, ED-F11)', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '더보기' }).first().tap()
  await page.getByRole('menuitem', { name: '페이지 스타일' }).tap()
  const sheet = page.getByRole('dialog', { name: '페이지 스타일' })
  await sheet.getByRole('radio', { name: '모노' }).tap()
  await expect(page.locator('.page-body')).toHaveAttribute('data-font', 'mono')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '커버 추가' }).tap()
  await expect(page.locator('.page-cover')).toBeVisible()
  await expect(page.getByRole('button', { name: '커버 변경' })).toBeVisible() // actions always shown on touch
})
