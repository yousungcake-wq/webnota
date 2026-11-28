import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, newPageFromSidebar, openApp, waitForNewPage } from './helpers'

test('command palette: Ctrl+K, keyboard navigation, commands (WS-07)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await newPageFromSidebar(page)
  await waitForNewPage(page)
  await page.fill('.page-title', 'Palette target')

  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog', { name: '검색' })
  await expect(palette).toBeVisible()
  // empty: recent pages, newest first
  await expect(palette.getByRole('option').first()).toContainText('Palette target')
  await palette.getByRole('combobox').fill('webnota')
  await expect(palette.getByRole('option').first()).toContainText('WebNota 시작하기')
  await page.keyboard.press('Enter')
  await expect(palette).toHaveCount(0)
  await expect(page.locator('.page-title')).toHaveValue('WebNota 시작하기')

  // sidebar button opens it too; commands are searchable
  await page.locator('.sidebar').getByRole('button', { name: /검색/ }).click()
  await palette.getByRole('combobox').fill('다크')
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  // Esc closes
  await page.keyboard.press('Control+k')
  await page.keyboard.press('Escape')
  await expect(palette).toHaveCount(0)
  check()
})
