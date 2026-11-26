import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: color sheet from the keyboard toolbar (ED-I03)', async ({ page }) => {
  await openApp(page)
  await page.locator('.wn-editor p').first().tap()
  // select the paragraph's text through the DOM selection (long-press selection is OS UI)
  await page.evaluate(() => {
    const p = document.querySelector('.wn-editor p')!
    const r = document.createRange()
    r.selectNodeContents(p)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(r)
  })
  await page.getByRole('button', { name: '색상' }).tap()
  const sheet = page.getByRole('dialog', { name: '색상' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('radiogroup', { name: '배경색' }).getByRole('radio', { name: '초록' }).tap()
  await expect(page.locator('.wn-editor p').first().locator('mark[data-bg-color="green"]')).toHaveCount(1)
})
