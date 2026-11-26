import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

// WS-07: full-text search in a worker, Hangul bigrams, persisted index.
test('finds pages by body text and inside Korean words; index survives a reload', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.fill('.page-title', '주간 정리')
  await page.locator('.wn-editor').click()
  await page.keyboard.type('다음 분기 예산안을 검토했습니다')

  const searchFor = async (q: string) => {
    await page.goto('/#/search')
    await page.getByPlaceholder('페이지 제목 검색').fill(q)
  }
  await page.waitForTimeout(2500) // live re-index is debounced 2 s
  await searchFor('예산')
  const hit = page.locator('.list-item', { hasText: '주간 정리' })
  await expect(hit).toBeVisible()
  await expect(hit.locator('mark').first()).toHaveText('예산')
  await expect(hit.locator('.search-snippet')).toContainText('예산안을 검토')

  await searchFor('분기 검토') // every word must match
  await expect(hit).toBeVisible()
  await searchFor('분기 우주')
  await expect(page.getByText('일치하는 페이지가 없습니다.')).toBeVisible()

  await page.waitForTimeout(2500) // index saved 2 s after the last change
  await page.reload()
  await page.getByPlaceholder('페이지 제목 검색').fill('예산')
  await expect(page.locator('.list-item', { hasText: '주간 정리' })).toBeVisible()
  check()
})
