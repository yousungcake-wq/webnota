import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, reload } from './helpers'

test('settings → advanced: developer option toggles and persists per device (ST-12)', async ({ page }) => {
  const noErrors = failOnConsoleErrors(page)
  await openApp(page)
  await page.goto('/#/settings')
  const sw = page.getByRole('switch', { name: /디버그 로그/ })
  await expect(sw).toHaveAttribute('aria-checked', 'false')
  await sw.click()
  await expect(sw).toHaveAttribute('aria-checked', 'true')
  await reload(page)
  await expect(page.getByRole('switch', { name: /디버그 로그/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('지금은 실험 중인 기능이 없습니다.')).toBeVisible()
  noErrors()
})

test('settings → files: "upload original images" toggles and persists (SY-04, M3-03)', async ({ page }) => {
  const noErrors = failOnConsoleErrors(page)
  await openApp(page)
  await page.goto('/#/settings')
  const sw = page.getByRole('switch', { name: '이미지 원본 그대로 올리기' })
  await expect(sw).toHaveAttribute('aria-checked', 'false')
  await sw.click()
  await reload(page)
  await expect(page.getByRole('switch', { name: '이미지 원본 그대로 올리기' })).toHaveAttribute('aria-checked', 'true')
  expect(await page.evaluate(() => localStorage.getItem('webnota:image-original'))).toBe('1')
  noErrors()
})
