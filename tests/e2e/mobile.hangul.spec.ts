import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone search tab: 초성 search finds the page (es-hangul)', async ({ page }) => {
  await openApp(page)
  await page.getByLabel('뒤로').tap()
  await page.getByRole('link', { name: '검색' }).tap()
  await page.getByPlaceholder('페이지 제목 검색').fill('ㅅㅈㅎㄱ')
  await expect(page.getByRole('link', { name: /WebNota 시작하기/ })).toBeVisible()
})
