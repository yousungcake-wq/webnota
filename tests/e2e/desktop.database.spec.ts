import { expect, test } from '@playwright/test'
import { enableDatabase, failOnConsoleErrors, gridCell, openApp, openQaDatabase, reload } from './helpers'

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

  test('grid shows typed cells and edits text, number, time, url and checkbox (M4-05)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    const name = await gridCell(page, 0, 'Name')
    await expect(name).toHaveText('Item 1')
    await expect(page.locator('.dbg-hcell')).toHaveCount(11)

    // text: double click edits, Enter saves and moves down
    await name.click()
    await name.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('첫 행')
    await page.keyboard.press('Enter')
    await expect(name).toHaveText('첫 행')
    await expect(await gridCell(page, 1, 'Name')).toHaveAttribute('aria-selected', 'true')

    // number: typing on the active cell replaces it, currency format
    const amount = await gridCell(page, 0, 'Amount')
    await amount.click()
    await page.keyboard.type('15000')
    await expect(page.locator('.dbc-editor')).toHaveAttribute('inputmode', 'decimal')
    await page.keyboard.press('Enter')
    await expect(amount).toHaveText('₩15,000')
    // not a number: the old value stays
    await amount.click()
    await page.keyboard.type('abc')
    await page.keyboard.press('Enter')
    await expect(amount).toHaveText('₩15,000')

    const estimate = await gridCell(page, 0, 'Estimate')
    await estimate.click()
    await page.keyboard.type('1h 30m')
    await page.keyboard.press('Tab')
    await expect(estimate).toHaveText('1h 30m')

    const link = await gridCell(page, 0, 'Link')
    await link.click()
    await page.keyboard.type('example.org')
    await page.keyboard.press('Escape') // cancel
    await expect(link).toContainText('https://example.com/0')
    await page.keyboard.press('Backspace') // still the active cell: clears it
    await expect(link).toHaveText('')
    await page.keyboard.type('example.org')
    await page.keyboard.press('Enter')
    await expect(link.locator('a')).toHaveAttribute('href', 'https://example.org')

    const done = (await gridCell(page, 0, 'Done')).getByRole('checkbox')
    const was = await done.getAttribute('aria-checked')
    await done.click()
    await expect(done).toHaveAttribute('aria-checked', was === 'true' ? 'false' : 'true')

    // read-only automatic times
    const created = await gridCell(page, 0, 'Created')
    await created.click()
    await page.keyboard.type('x')
    await expect(page.locator('.dbc-editor')).toHaveCount(0)

    await reload(page)
    await expect(await gridCell(page, 0, 'Name')).toHaveText('첫 행')
    await expect(await gridCell(page, 0, 'Amount')).toHaveText('₩15,000')
    noErrors()
  })
})
