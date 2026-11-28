import { expect, test, type Page } from '@playwright/test'
import { failOnConsoleErrors, openApp, openQaDatabase } from './helpers'

/**
 * Hardware back matrix (MB-14, M7-05): every layer closes first (sheet, dialog, row page),
 * then screens go back, tabs return home, and back from home leaves the app.
 */
const home = (page: Page) => expect(page.locator('.tabbar')).toBeVisible()
const left = (page: Page) => expect.poll(() => page.url()).not.toMatch(/^http:\/\/localhost/)

test.describe('hardware back (MB-14)', () => {
  let assertNoErrors: () => void
  test.beforeEach(({ page }) => {
    assertNoErrors = failOnConsoleErrors(page)
  })
  test.afterEach(() => assertNoErrors())

  test('page: sheet → sheet from a sheet → dialog → page → home → leaves', async ({ page }) => {
    await openApp(page)
    const sheet = page.locator('.sheet')
    await page.getByLabel('더보기').tap()
    await expect(sheet).toBeVisible()
    await page.goBack()
    await expect(sheet).toHaveCount(0)
    await expect(page.locator('.wn-editor')).toBeVisible()

    // a sheet opened from a sheet: one back closes it, the page stays
    await page.getByLabel('더보기').tap()
    await sheet.locator('.menu-item', { hasText: '아이콘 변경' }).tap()
    await expect(sheet).toHaveCount(1)
    await page.goBack()
    await expect(sheet).toHaveCount(0)
    await expect(page.locator('.wn-editor')).toBeVisible()

    // a dialog
    await page.getByLabel('더보기').tap()
    await sheet.getByRole('menuitem', { name: '이동', exact: true }).tap()
    await expect(page.locator('.dialog')).toBeVisible()
    await page.goBack()
    await expect(page.locator('.dialog')).toHaveCount(0)
    await expect(page.locator('.wn-editor')).toBeVisible()

    await page.goBack()
    await home(page)
    await page.goBack()
    await left(page)
  })

  test('tabs: any tab → back → home; tab hopping does not pile up', async ({ page }) => {
    await openApp(page)
    await page.getByLabel('뒤로').tap()
    await home(page)
    for (const name of ['검색', '즐겨찾기', '설정']) await page.locator('.tab', { hasText: name }).tap()
    await expect(page.locator('.tab.is-active')).toHaveText('설정')
    await page.goBack()
    await expect(page.locator('.tab.is-active')).toHaveText('홈')
    // the home tab from another tab is a step back too
    await page.locator('.tab', { hasText: '검색' }).tap()
    await page.locator('.tab', { hasText: '홈' }).tap()
    await expect(page.locator('.tab.is-active')).toHaveText('홈')
    await page.goBack()
    await left(page)
  })

  test('database: sheet in the row page → row page → page → home', async ({ page }) => {
    await openQaDatabase(page)
    await page.getByRole('button', { name: '카드 목록 보기' }).tap()
    await page.locator('.db-card').first().tap()
    const rowPage = page.getByRole('dialog', { name: '행 페이지' })
    await expect(rowPage).toBeVisible()
    await rowPage.getByRole('button', { name: '더보기' }).tap()
    await expect(page.locator('.sheet')).toBeVisible()
    await page.goBack()
    await expect(page.locator('.sheet')).toHaveCount(0)
    await expect(rowPage).toBeVisible()
    await page.goBack()
    await expect(rowPage).toHaveCount(0)
    await expect(page.locator('.db-view')).toBeVisible()
    await page.goBack()
    await home(page)
  })

  test('settings → trash → back → settings → back → home', async ({ page }) => {
    await openApp(page)
    await page.getByLabel('뒤로').tap()
    await page.locator('.tab', { hasText: '설정' }).tap()
    await page.locator('a[href$="#/trash"], a[href*="/trash"]').first().tap()
    await expect(page).toHaveURL(/trash/)
    await page.goBack()
    await expect(page.locator('.tab.is-active')).toHaveText('설정')
    await page.goBack()
    await expect(page.locator('.tab.is-active')).toHaveText('홈')
  })
})
