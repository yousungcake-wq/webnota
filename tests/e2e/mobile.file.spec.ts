import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: file block from the block panel, 44px download button (ED-B14)', async ({ page }) => {
  await openApp(page)
  await page.locator('.wn-editor p').first().tap()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '블록 추가' }).tap()
  await page.locator('.kb-panel').getByRole('button', { name: '파일', exact: true }).tap()
  const chooser = page.waitForEvent('filechooser')
  await page.locator('.file-row.is-empty').getByRole('button', { name: '파일 올리기' }).tap()
  await (await chooser).setFiles({ name: 'memo.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  const btn = page.locator('.wn-editor .file-row').getByRole('button', { name: '내려받기' })
  await expect(btn).toBeVisible()
  const box = (await btn.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  await expect(page.locator('.wn-editor .file-name')).toHaveText('memo.txt')
})
