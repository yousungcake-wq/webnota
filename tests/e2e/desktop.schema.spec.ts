import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

// spec/02 §6: data newer than the app → read-only + "update the app" banner.
// `webnota:debug=schema-newer` makes the build pretend its schema version is 0.
test('newer data opens read-only with an update banner', async ({ page }) => {
  await openApp(page) // seeds the welcome page as a normal (writable) run
  const before = await page.locator('.wn-editor').textContent()
  await page.evaluate(() => localStorage.setItem('webnota:debug', 'schema-newer'))
  await page.reload()

  const banner = page.getByRole('alert').filter({ hasText: '더 새로운 버전' })
  await expect(banner).toBeVisible()
  await expect(banner.getByRole('button', { name: '앱 업데이트' })).toBeVisible()

  const editor = page.locator('.wn-editor')
  await expect(editor).toHaveAttribute('contenteditable', 'false')
  await editor.click()
  await page.keyboard.type('지우면 안 됨')
  expect(await editor.textContent()).toBe(before)
  await expect(page.locator('.page-title')).toHaveAttribute('readonly', '')

  // model writes are refused with a toast instead of changing data
  await page.click('.sidebar-bottom >> text=새 페이지')
  await expect(page.getByText('읽기 전용 모드에서는 바꿀 수 없습니다')).toBeVisible()
  await expect(page)
    .not.toHaveURL(/#\/page\/(?!.*welcome)/, { timeout: 100 })
    .catch(() => {})

  // back to a current build: writable again
  await page.evaluate(() => localStorage.removeItem('webnota:debug'))
  await page.reload()
  await expect(page.locator('.wn-editor')).toHaveAttribute('contenteditable', 'true')
  await expect(banner).toHaveCount(0)
})
