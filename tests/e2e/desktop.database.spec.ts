import { expect, test } from '@playwright/test'
import { enableDatabase, failOnConsoleErrors, openApp } from './helpers'

test.describe('database (M4)', () => {
  test('without the flag, "+" creates a document directly', async ({ page }) => {
    await openApp(page)
    await page.click('.sidebar-bottom >> text=새 페이지')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(page.locator('.wn-editor')).toBeVisible()
  })

  test('with the flag, the new view menu offers Grid and opens a database view', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await enableDatabase(page)
    await openApp(page)
    await page.click('.sidebar-bottom >> text=새 페이지')
    await expect(page.getByRole('menuitem', { name: '보드' })).toBeDisabled()
    await page.getByRole('menuitem', { name: '표 (Grid)' }).click()
    // a new database starts with three empty rows (DB-F05)
    await expect(page.locator('.db-view[data-layout="grid"]')).toHaveAttribute('data-rows', '3')
    await expect(page.locator('.wn-editor')).toHaveCount(0)
    noErrors()
  })
})
