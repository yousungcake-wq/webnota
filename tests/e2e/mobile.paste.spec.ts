import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: pasted Markdown becomes blocks (ED-F06)', async ({ page }) => {
  await openApp(page)
  await page.locator('.wn-editor p').first().tap()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.setData('text/plain', '## 폰 제목\n- 항목')
    document
      .querySelector('.wn-editor')!
      .dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
  })
  await expect(page.locator('.wn-editor h2', { hasText: '폰 제목' })).toHaveCount(1)
})
