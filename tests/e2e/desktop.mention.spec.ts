import { expect, test, type Page } from '@playwright/test'
import { failOnConsoleErrors, openApp, reload, waitForNewPage } from './helpers'

async function newPage(page: Page, title: string) {
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.fill('.page-title', title)
}

test('page mention: @ menu, live title, click to open, trashed style (ED-I04)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await newPage(page, '회의록 원본')
  await newPage(page, '멘션하는 쪽')
  const ed = page.locator('.wn-editor')
  await ed.click()
  await page.keyboard.type('see @회의')
  const menu = page.getByRole('listbox', { name: '멘션' })
  await expect(menu.getByRole('option').first()).toContainText('회의록 원본')
  await page.keyboard.press('Enter')
  const chip = ed.locator('.mention[data-kind="page"]')
  await expect(chip).toHaveText('회의록 원본')

  // rename the target: the chip follows
  await page.locator('.tree-row', { hasText: '회의록 원본' }).click()
  await expect(page.locator('.page-title')).toHaveValue('회의록 원본') // navigation done before renaming
  await page.fill('.page-title', '회의록 v2')
  await page.locator('.tree-row', { hasText: '멘션하는 쪽' }).click()
  await expect(page.locator('.page-title')).toHaveValue('멘션하는 쪽')
  await expect(chip).toHaveText('회의록 v2')

  // click opens the page
  await chip.click()
  await expect(page.locator('.page-title')).toHaveValue('회의록 v2')

  // trash it: the chip is struck through
  await page.locator('.tree-row', { hasText: '회의록 v2' }).hover()
  await page.locator('.tree-row', { hasText: '회의록 v2' }).getByRole('button', { name: '더보기' }).click()
  await page.getByRole('menuitem', { name: '휴지통으로 이동' }).click()
  await page.locator('.tree-row', { hasText: '멘션하는 쪽' }).click()
  await expect(page.locator('.page-title')).toHaveValue('멘션하는 쪽')
  await expect(ed.locator('.mention-page.is-deleted')).toHaveCount(1)
  check()
})

test('[[ links pages, @ inserts dates and the date chip can be changed (ED-I05)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await newPage(page, '날짜 테스트')
  const ed = page.locator('.wn-editor')
  await ed.click()
  await page.keyboard.type('[[WebNota')
  await page.keyboard.press('Enter')
  await expect(ed.locator('.mention[data-kind="page"]')).toHaveText(/WebNota 시작하기/)

  await page.keyboard.type('due @내일')
  await expect(page.getByRole('listbox', { name: '멘션' }).getByRole('option').first()).toContainText('내일')
  await page.keyboard.press('Enter')
  const date = ed.locator('.mention[data-kind="date"]')
  await expect(date).toHaveText('내일')

  await date.click()
  await page.getByRole('button', { name: '오늘' }).click()
  await expect(date).toHaveText('오늘')

  // @ with no match keeps typing normally (menu hidden, Enter makes a new line)
  await page.keyboard.press('End')
  await page.keyboard.type(' mail@zzzz qq')
  await page.keyboard.press('Enter')
  await expect(ed.locator('p')).toHaveCount(2)
  await page.waitForTimeout(300)
  await reload(page)
  await expect(ed.locator('.mention[data-kind="date"]')).toHaveText('오늘')
  check()
})
