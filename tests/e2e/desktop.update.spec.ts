import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'

const SW = join(import.meta.dirname, '../../', process.env.E2E_DIST ?? 'dist', 'sw.js')

/**
 * App update (MB-41, M7-10): a new service worker waits; the app shows "update ready" with
 * a reload button and is not reloaded by itself; the button switches to the new version.
 */
test('a new version waits, "update ready" offers a reload, the button applies it', async ({ page }) => {
  const noErrors = failOnConsoleErrors(page)
  const original = readFileSync(SW, 'utf8')
  try {
    await openApp(page)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload() // now the worker controls the page
    await expect(page.locator('.wn-editor')).toBeVisible()
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    await expect(page.locator('.toast', { hasText: '업데이트' })).toHaveCount(0)

    // a new deploy
    writeFileSync(SW, original + '\n// next version\n')
    await page.evaluate(() => {
      ;(window as unknown as { __marker: number }).__marker = 1
      return navigator.serviceWorker.getRegistration().then((r) => r!.update())
    })
    const toast = page.locator('.toast', { hasText: '업데이트가 준비되었습니다' })
    await expect(toast).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(500)
    // not reloaded by itself
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1)

    const reloaded = page.waitForEvent('load')
    await toast.getByRole('button', { name: '새로 고침' }).click()
    await reloaded
    await expect(page.locator('.wn-editor')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBeUndefined()
    await expect(page.locator('.toast', { hasText: '업데이트가 준비되었습니다' })).toHaveCount(0)
    noErrors()
  } finally {
    writeFileSync(SW, original)
  }
})
