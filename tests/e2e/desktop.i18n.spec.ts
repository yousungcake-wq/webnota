import { expect, test } from '@playwright/test'
import { enableDatabase, failOnConsoleErrors } from './helpers'

test.describe('i18n', () => {
  test.use({ locale: 'en-US' })

  test('English browser gets English UI and welcome page; switching to Korean persists', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await page.goto('/')
    await expect(page.locator('.wn-editor')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('.page-title')).toHaveValue('Getting started with WebNota')
    await expect(page.locator('.wn-editor')).toContainText('Basics')
    await expect(page.locator('.sidebar')).toContainText('Settings')

    await page.goto('/#/settings')
    await page.getByRole('radio', { name: '한국어' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
    await expect(page.locator('.view-header h1')).toHaveText('설정')
    await expect(page.getByRole('radio', { name: '한국어' })).toHaveAttribute('aria-checked', 'true')

    // Back to following the browser.
    await page.getByRole('radio', { name: '자동' }).click()
    await expect(page.locator('.view-header h1')).toHaveText('Settings')
    noErrors()
  })

  test('the database speaks English too (lazy db dictionary, M4)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await enableDatabase(page)
    await page.goto('/')
    await expect(page.locator('.wn-editor')).toBeVisible()
    await page.click('.sidebar [data-new-page] >> nth=0')
    await page.getByRole('menuitem', { name: 'Grid' }).click()
    await expect(page.getByRole('button', { name: 'Field menu: Name' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New row' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Filter', exact: true })).toBeVisible()
    noErrors()
  })
})
