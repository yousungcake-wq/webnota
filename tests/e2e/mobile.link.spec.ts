import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: tapping a link while editing opens the link sheet (MB-25)', async ({ page }) => {
  await openApp(page)
  // the welcome page has no link: make one through the editor API surface (paste HTML)
  await page.locator('.wn-editor p').first().tap()
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.setData('text/html', '<a href="https://example.com">tap me</a>')
    document
      .querySelector('.wn-editor')!
      .dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
  })
  const link = page.locator('.wn-editor a', { hasText: 'tap me' })
  await expect(link).toHaveCount(1)
  await link.tap()
  await expect(page.getByRole('menuitem', { name: '링크 열기' })).toBeVisible()
  await page.getByRole('menuitem', { name: '링크 제거' }).tap()
  await expect(page.locator('.wn-editor a', { hasText: 'tap me' })).toHaveCount(0)
})
