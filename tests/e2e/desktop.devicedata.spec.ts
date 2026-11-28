import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, newPageFromSidebar, openApp, waitForNewPage } from './helpers'

test('settings → data on this device: usage, clear cache, delete everything here (ST-08, M8-10)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await newPageFromSidebar(page)
  await waitForNewPage(page)
  await page.fill('.page-title', '지워질 페이지')
  await expect(page.locator('.sidebar')).toContainText('지워질 페이지')

  await page.goto('/#/settings')
  const card = page.locator('[data-device-data]')
  await expect(card.locator('[data-usage]')).toContainText('MB')
  await card.getByRole('button', { name: '캐시 지우기' }).click()
  await expect(page.locator('.toast')).toContainText('비웠습니다')

  await card.getByRole('button', { name: '이 기기의 데이터 지우기' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('영구히 사라집니다') // not connected to GitHub
  await dialog.getByRole('button', { name: '모두 지우기' }).click()
  await expect(page.locator('.wn-editor')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.page-title')).toHaveValue('WebNota 시작하기')
  await expect(page.locator('.sidebar')).not.toContainText('지워질 페이지')
  check()
})
