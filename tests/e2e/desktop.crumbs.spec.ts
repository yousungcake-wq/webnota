import { expect, test } from '@playwright/test'
import { openApp, waitForNewPage } from './helpers'

test('long breadcrumb trails collapse the middle into a menu (WS-09)', async ({ page }) => {
  await openApp(page)
  let parent = 'WebNota 시작하기'
  for (const t of ['L1', 'L2', 'L3', 'L4']) {
    const row = page.locator('.sidebar .tree-row', { hasText: parent }).first()
    await row.hover()
    await row.getByLabel('하위 페이지 추가').click()
    await waitForNewPage(page)
    await page.fill('.page-title', t)
    parent = t
  }
  const crumbs = page.locator('.crumbs')
  await expect(crumbs.locator('.crumb a')).toHaveText(['👋WebNota 시작하기', 'L2', 'L3'])
  await crumbs.getByRole('button', { name: '숨겨진 상위 페이지' }).click()
  await page.getByRole('menuitem', { name: 'L1' }).click()
  await expect(page.locator('.page-title')).toHaveValue('L1')
})
