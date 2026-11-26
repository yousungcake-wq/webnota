import { expect, test, type Page } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

async function newPage(page: Page, title: string) {
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.fill('.page-title', title)
}
const openMove = async (page: Page) => {
  await page.locator('.topbar').getByRole('button', { name: '더보기' }).click()
  await page.getByRole('menuitem', { name: '이동', exact: true }).click()
  return page.getByRole('dialog', { name: /이동/ })
}

test('move dialog: under another page, own subtree excluded, to another space (WS-12)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await newPage(page, 'Xray')
  await newPage(page, 'Yank')

  let dialog = await openMove(page)
  await expect(dialog.getByRole('option', { name: 'Yank' })).toBeDisabled()
  await dialog.getByRole('searchbox').fill('xr')
  await dialog.getByRole('option', { name: 'Xray' }).click()
  await expect(page.locator('.sidebar .tree [aria-level="2"] .tree-title')).toHaveText(['Yank'])
  await expect(page.locator('.crumbs')).toContainText('Xray')

  // a new space, then move Xray (with Yank inside) there
  await page.locator('.sidebar').getByRole('button', { name: '스페이스 전환' }).click()
  await page.getByRole('menuitem', { name: '새 스페이스' }).click()
  await page.getByRole('dialog', { name: '새 스페이스' }).getByLabel('이름').fill('Other')
  await page.getByRole('dialog', { name: '새 스페이스' }).getByRole('button', { name: '만들기' }).click()
  await page.locator('.sidebar').getByRole('button', { name: '스페이스 전환' }).click()
  await page.getByRole('menuitemcheckbox', { name: '일반' }).click()
  await page.locator('.tree-link', { hasText: 'Xray' }).click()

  dialog = await openMove(page)
  await expect(dialog.getByRole('option', { name: 'Yank' })).toBeDisabled() // descendant
  await dialog.getByRole('option', { name: 'Other' }).click()
  await expect(page.locator('.sidebar').getByRole('button', { name: '스페이스 전환' })).toContainText('Other')
  await expect(page.locator('.sidebar .tree-title').first()).toHaveText('Xray')
  check()
})
