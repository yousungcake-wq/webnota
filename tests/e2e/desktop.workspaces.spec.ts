import { expect, test } from '@playwright/test'
import { newPageFromSidebar, openApp, waitForNewPage } from './helpers'

test('workspaces: create, switch (separate data), remove from the device (WS-01, ST-02)', async ({ page }) => {
  await openApp(page)
  await newPageFromSidebar(page)
  await waitForNewPage(page)
  await page.fill('.page-title', 'Only in first')

  const switcher = page.getByRole('button', { name: '워크스페이스 전환' })
  await switcher.click()
  await page.getByRole('menuitem', { name: '새 워크스페이스' }).click()
  const dialog = page.getByRole('dialog', { name: '새 워크스페이스' })
  await dialog.getByLabel('이름').fill('Second WS')
  await dialog.getByRole('button', { name: '만들기' }).click()

  // reloaded into the new, empty workspace (gets its own welcome page)
  await expect(switcher).toContainText('Second WS')
  await expect(page.locator('.sidebar .tree-title')).toHaveText(['WebNota 시작하기'])

  await switcher.click()
  await page.getByRole('menuitemcheckbox', { name: /이 기기 워크스페이스/ }).click()
  await expect(page.locator('.sidebar .tree-title', { hasText: 'Only in first' })).toHaveCount(1)
  await expect(page.locator('.page-title')).toHaveValue('Only in first') // reopened the last page

  await page.locator('.sidebar').getByRole('link', { name: '설정' }).click()
  const row = page.locator('.ws-list li', { hasText: 'Second WS' })
  await row.getByRole('button', { name: '이 기기에서 제거' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '이 기기에서 제거' }).click()
  await expect(page.locator('.ws-list')).toHaveCount(0)
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('webnota:workspaces')!).list.length)
  expect(ids).toBe(1)
  expect(dbs.every((n) => n?.startsWith(`wn:`) ?? true)).toBe(true)
})
