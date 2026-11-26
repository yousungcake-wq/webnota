import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('global shortcuts: new page, theme, back, help (WS-14)', async ({ page }) => {
  await openApp(page)
  const first = page.url()
  await page.locator('.sidebar').click({ position: { x: 100, y: 500 } }) // focus outside the editor
  await page.keyboard.press('Control+Alt+n')
  await page.waitForFunction(() => (document.querySelector('.page-title') as HTMLTextAreaElement | null)?.value === '')
  expect(page.url()).not.toBe(first)

  await page.keyboard.press('Control+BracketLeft')
  await expect(page).toHaveURL(first)

  await page.keyboard.press('Control+Shift+L')
  await expect(page.locator('html')).toHaveAttribute('data-theme', /dark|light/)

  await page.keyboard.press('Control+Slash')
  const help = page.getByRole('dialog', { name: '단축키' })
  await expect(help).toContainText('새 페이지')
  await page.keyboard.press('Escape')
  await expect(help).toHaveCount(0)
})
