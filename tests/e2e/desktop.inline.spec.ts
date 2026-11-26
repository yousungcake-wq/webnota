import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
})

test(':name suggests emoji, times like 10:30 stay plain (ED-I07)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  const ed = page.locator('.wn-editor')
  await page.keyboard.type('hi :grinning')
  const list = page.getByRole('listbox', { name: '이모지 제안' })
  await expect(list.getByRole('option').first()).toContainText('😀')
  await page.keyboard.press('Enter')
  await expect(ed).toContainText('hi 😀')
  await page.keyboard.type(' at 10:30')
  await expect(list).toHaveCount(0)
  await page.keyboard.press('Enter')
  await expect(ed.locator('p')).toHaveCount(2)
  check()
})

test('superscript / subscript by shortcut and bubble (ED-I08)', async ({ page }) => {
  const ed = page.locator('.wn-editor')
  await page.keyboard.type('x2')
  await page.keyboard.press('Shift+ArrowLeft')
  await page.keyboard.press('ControlOrMeta+.')
  await expect(ed.locator('sup')).toHaveText('2')
  await page.keyboard.press('End')
  await page.keyboard.type(' H2O')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('Shift+ArrowLeft')
  await page.locator('.bubble').getByRole('button', { name: '아래 첨자' }).click()
  await expect(ed.locator('sub')).toHaveText('2')
})
