import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, reload } from './helpers'

// ED-B23: content written by a newer app version is kept and the page opens read-only.
// `webnota:debug=seed-unknown` adds a page with an unknown block and an unknown mark.
test('unknown blocks and marks are preserved; the page opens read-only with a notice', async ({ page }) => {
  const checkConsole = failOnConsoleErrors(page)
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('wn-test-init')) {
      sessionStorage.setItem('wn-test-init', '1')
      localStorage.setItem('webnota:debug', 'seed-unknown')
    }
  })
  await page.goto('/')
  await page.locator('.tree-link', { hasText: 'Unknown content test' }).click()
  await expect(page.locator('.page-title')).toHaveValue('Unknown content test')

  const notice = page.getByRole('note').filter({ hasText: '읽기 전용' })
  await expect(notice).toBeVisible()
  await expect(notice).toContainText('futureBlock')
  await expect(notice).toContainText('futureMark')
  const editor = page.locator('.wn-editor')
  await expect(editor).toHaveAttribute('contenteditable', 'false')
  await expect(editor).toContainText('known before')
  await expect(editor).toContainText('known after')

  // typing does nothing, and after a reload the unknown content is still there
  await editor.click()
  await page.keyboard.type('xyz')
  await expect(editor).not.toContainText('xyz')
  await page.evaluate(() => localStorage.removeItem('webnota:debug'))
  await reload(page)
  await page.locator('.tree-link', { hasText: 'Unknown content test' }).click()
  await expect(page.getByRole('note').filter({ hasText: 'futureBlock' })).toBeVisible()
  await expect(page.getByRole('note')).toContainText('futureMark')

  // other pages stay editable
  await page.locator('.tree-link', { hasText: 'WebNota' }).click()
  await expect(page.locator('.wn-editor')).toHaveAttribute('contenteditable', 'true')
  checkConsole()
})
