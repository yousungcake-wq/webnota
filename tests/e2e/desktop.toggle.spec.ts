import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, newPageFromSidebar, openApp, reload, waitForNewPage } from './helpers'

test('toggle: "> " creates it, Enter goes inside, collapse persists per device; quote is now " (ED-B06)', async ({
  page,
}) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await newPageFromSidebar(page)
  await waitForNewPage(page)
  const ed = page.locator('.wn-editor')
  await ed.click()
  await page.keyboard.type('> Summary')
  const toggle = ed.locator('.toggle')
  await expect(toggle).toHaveCount(1)
  await expect(toggle.locator('[data-type="toggleSummary"]')).toHaveText('Summary')
  await page.keyboard.press('Enter')
  await page.keyboard.type('hidden body')
  await expect(toggle.locator('[data-type="toggleContent"]')).toHaveText('hidden body')

  await toggle.locator('.toggle-arrow').click()
  await expect(toggle.locator('[data-type="toggleContent"]')).toBeHidden()
  await page.waitForTimeout(300)
  await reload(page)
  await expect(page.locator('.wn-editor .toggle [data-type="toggleContent"]')).toBeHidden()
  await page.locator('.wn-editor .toggle-arrow').click()
  await expect(page.locator('.wn-editor .toggle [data-type="toggleContent"]')).toHaveText('hidden body')

  // toggle heading from the slash menu; " + space makes a quote
  await page.locator('.wn-editor [data-type="toggleContent"] p').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('" quoted')
  await expect(page.locator('.wn-editor blockquote')).toHaveText('quoted')
  check()
})

test('slash menu creates a toggle heading', async ({ page }) => {
  await openApp(page)
  await newPageFromSidebar(page)
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
  await page.keyboard.type('/토글') // the menu stops at a space: pick the 3rd match
  await expect(page.locator('.slash-title').nth(2)).toHaveText('토글 제목 2')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Big')
  await expect(page.locator('.wn-editor .toggle[data-level="2"]')).toContainText('Big')
})
