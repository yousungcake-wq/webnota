import { expect, test } from '@playwright/test'
import { failOnConsoleErrors } from './helpers'

// spec/02 §7 end to end: PoC (v1) data in IndexedDB → schema v2 + `wn:<wsId>:doc/` databases (M0-16, M0-18).
// `webnota:debug=seed-v1` writes the v1 fixture (src/app/qa/seedV1.ts) before boot.
test('upgrades PoC data: tree, order, favorites, icons and page bodies survive', async ({ page }) => {
  const checkConsole = failOnConsoleErrors(page)
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('wn-test-init')) {
      sessionStorage.setItem('wn-test-init', '1')
      localStorage.setItem('webnota:debug', 'seed-v1')
    }
  })
  await page.goto('/')

  const tree = page.locator('.section').filter({ hasText: '페이지' }).locator('.tree-title')
  await expect(tree).toHaveText(['Old page', 'Second page']) // v1 order kept, child collapsed
  await expect(page.locator('.fav-list')).toContainText('Old page')
  await expect(page.locator('.tree-row', { hasText: 'Old page' }).locator('.tree-icon')).toHaveText('📘')

  await page.locator('.tree-link', { hasText: 'Old page' }).click()
  await expect(page.locator('.wn-editor')).toContainText('Body written in the PoC')
  await page.locator('.tree-row', { hasText: 'Old page' }).locator('.tree-toggle').click()
  await expect(tree).toHaveText(['Old page', 'Child page', 'Second page'])

  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name).sort())
  const wsId = await page.evaluate(() => JSON.parse(localStorage.getItem('webnota:workspaces')!).current)
  expect(dbs).toContain(`wn:${wsId}:doc/v1root`)
  expect(dbs).toContain(`wn:${wsId}:workspace`)
  expect(dbs.filter((n) => n?.startsWith('webnota:'))).toEqual([]) // legacy names all moved

  // edits land in the new databases and survive a reload
  await page.locator('.wn-editor p').first().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' — v2에서 이어 씀')
  await page.waitForTimeout(300)
  await page.evaluate(() => localStorage.removeItem('webnota:debug'))
  await page.reload()
  await expect(page.locator('.wn-editor')).toContainText('Body written in the PoC — v2에서 이어 씀')
  await expect(tree.first()).toHaveText('Old page')
  checkConsole()
})
