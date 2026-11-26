import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
})

test('Tab moves a block into the toggle / list above, Shift+Tab back out (ED-F09)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  const ed = page.locator('.wn-editor')
  await page.keyboard.type('> 접기')
  await page.keyboard.press('Enter') // into the toggle content
  await page.keyboard.type('안')
  await expect(ed.locator('.toggle')).toContainText('안')
  // a paragraph after the toggle
  await page.keyboard.press('Enter')
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.type('밖')
  await expect(ed.locator('.toggle')).not.toContainText('밖')
  await page.keyboard.press('Tab')
  await expect(ed.locator('.toggle')).toContainText('밖')
  await page.keyboard.press('Shift+Tab')
  await expect(ed.locator('.toggle')).not.toContainText('밖')
  await expect(ed.locator(':scope > p', { hasText: '밖' })).toHaveCount(1)

  // list: a paragraph after it becomes a child of the last item
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('- 가')
  await page.keyboard.press('Enter')
  await page.keyboard.type('나')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter') // leaves the list
  await page.keyboard.type('메모')
  await page.keyboard.press('Tab')
  await expect(ed.locator('ul li').last()).toContainText('메모')
  await expect(ed.locator('ul li')).toHaveCount(2)
  check()
})

test('[text](url) typed becomes a link; block menu sets text direction (ED-F16, ED-F13)', async ({ page }) => {
  const ed = page.locator('.wn-editor')
  await page.keyboard.type('보기 [사이트](https://example.com) 끝')
  await expect(ed.locator('a')).toHaveText('사이트')
  await expect(ed.locator('a')).toHaveAttribute('href', 'https://example.com')

  await ed.locator('p').first().hover()
  await page.locator('.block-actions .grip').click()
  await page.getByRole('menuitem', { name: '텍스트 방향' }).click()
  await page.getByRole('menuitemcheckbox', { name: '오른쪽에서 왼쪽' }).click()
  await expect(ed.locator('p').first()).toHaveAttribute('dir', 'rtl')
})
