import { expect, test, type Page } from '@playwright/test'
import { waitForNewPage } from './helpers'

// These tests provoke errors on purpose, so they do not fail on console errors.
async function openWithDebug(page: Page, flags: string) {
  await page.addInitScript((f) => {
    if (!sessionStorage.getItem('wn-test-init')) {
      sessionStorage.setItem('wn-test-init', '1')
      localStorage.setItem('webnota:debug', f)
    }
  }, flags)
  await page.goto('/')
}

test.describe('error handling', () => {
  test('an editor crash stays inside the editor; the sidebar keeps working; retry recovers', async ({ page }) => {
    await openWithDebug(page, 'crash-editor')
    const fallback = page.getByRole('alert').filter({ hasText: '에디터를 표시하지 못했습니다' })
    await expect(fallback).toBeVisible()
    await expect(page.locator('.page-title')).toBeVisible() // page header still rendered

    await page.click('.sidebar [data-new-page] >> nth=0')
    await waitForNewPage(page)
    await page.fill('.page-title', '오류 중에도 작성')
    await expect(page.locator('.tree-title', { hasText: '오류 중에도 작성' })).toHaveCount(1)

    await page.evaluate(() => localStorage.removeItem('webnota:debug'))
    await page.getByRole('button', { name: '다시 시도' }).click()
    await expect(page.locator('.wn-editor')).toBeVisible()
  })

  test('a sidebar crash leaves the page and editor usable', async ({ page }) => {
    await openWithDebug(page, 'crash-sidebar')
    await expect(page.getByRole('alert').filter({ hasText: '사이드바 오류' })).toBeVisible()
    await expect(page.locator('.wn-editor')).toBeVisible()
    await page.locator('.wn-editor p').first().click()
    await page.keyboard.type('계속 작성')
    await expect(page.locator('.wn-editor')).toContainText('계속 작성')
  })

  test('errors outside rendering show an error toast once', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.wn-editor')).toBeVisible()
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('boom-from-timer')
      })
      setTimeout(() => {
        throw new Error('boom-from-timer')
      })
      void Promise.reject(new Error('boom-from-promise'))
    })
    await expect(page.locator('.toast.is-error', { hasText: 'boom-from-timer' })).toHaveCount(1)
    await expect(page.locator('.toast.is-error', { hasText: 'boom-from-promise' })).toHaveCount(1)
  })
})
