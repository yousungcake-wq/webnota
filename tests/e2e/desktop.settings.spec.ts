import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'

test('settings → advanced: developer option toggles and persists per device (ST-12)', async ({ page }) => {
  const noErrors = failOnConsoleErrors(page)
  await openApp(page)
  await page.goto('/#/settings')
  const sw = page.getByRole('switch', { name: /디버그 로그/ })
  await expect(sw).toHaveAttribute('aria-checked', 'false')
  await sw.click()
  await expect(sw).toHaveAttribute('aria-checked', 'true')
  await page.reload()
  await expect(page.getByRole('switch', { name: /디버그 로그/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('지금은 실험 중인 기능이 없습니다.')).toBeVisible()
  noErrors()
})
