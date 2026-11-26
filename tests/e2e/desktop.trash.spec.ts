import { expect, test, type Page } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

async function newPage(page: Page, title: string) {
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.fill('.page-title', title)
}
async function trash(page: Page, title: string) {
  const row = page.locator('.sidebar .tree-row', { hasText: title })
  await row.hover()
  await row.getByRole('button', { name: '더보기' }).click()
  await page.getByRole('menuitem', { name: '휴지통으로 이동' }).click()
}

test('trash: banner on a trashed page, restore all, empty all (WS-06)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await newPage(page, 'Xray')
  const url = page.url()
  await newPage(page, 'Yank')
  await trash(page, 'Xray')
  await trash(page, 'Yank')

  await page.goto(url) // open a trashed page directly
  await expect(page.getByRole('status').filter({ hasText: '휴지통에 있는 페이지입니다' })).toBeVisible()
  await expect(page.locator('.wn-editor')).toHaveAttribute('contenteditable', 'false')
  await expect(page.locator('.page-title')).toHaveAttribute('readonly', '')
  await page.locator('.trash-banner').getByRole('button', { name: '복원' }).click()
  await expect(page.locator('.trash-banner')).toHaveCount(0)
  await expect(page.locator('.sidebar .tree-title', { hasText: 'Xray' })).toHaveCount(1)

  await trash(page, 'Xray')
  await page.goto('/#/trash')
  await page.getByRole('button', { name: '모두 복원' }).click()
  await expect(page.locator('.sidebar .tree-title')).toHaveText(['WebNota 시작하기', 'Xray', 'Yank'])

  await trash(page, 'Xray')
  await trash(page, 'Yank')
  await page.goto('/#/trash')
  await page.getByRole('button', { name: '휴지통 비우기' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '휴지통 비우기' }).click()
  await expect(page.getByText('휴지통이 비어 있습니다.')).toBeVisible()
  check()
})
