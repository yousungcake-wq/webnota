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

test('phone: link from the selection bar, then typing continues after the link', async ({ page }) => {
  await openApp(page)
  const p = page.locator('.wn-editor p').first()
  await p.tap()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('tap here')
  await page.keyboard.press('Shift+Home')
  const bar = page.getByRole('toolbar', { name: '선택한 텍스트' })
  await bar.getByRole('button', { name: '링크', exact: true }).tap()
  const dialog = page.getByRole('dialog', { name: '링크' })
  await dialog.getByLabel('링크 주소').fill('example.com')
  await dialog.getByRole('button', { name: '확인' }).tap()
  const a = page.locator('.wn-editor a', { hasText: 'tap here' })
  await expect(a).toHaveCount(1)
  await page.keyboard.type(' more')
  await expect(page.locator('.wn-editor p', { hasText: 'tap here more' })).toHaveCount(1)
  await expect(a).toHaveText('tap here')
})
