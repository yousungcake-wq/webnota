import { expect, test, type Page } from '@playwright/test'
import { openApp, reload, waitForNewPage } from './helpers'

async function newFavorite(page: Page, title: string) {
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.fill('.page-title', title)
  await page.getByRole('button', { name: '즐겨찾기에 추가' }).click()
}

test('favorites keep their order and can be reordered by drag (WS-04)', async ({ page }) => {
  await openApp(page)
  for (const t of ['Xray', 'Yank', 'Zulu']) await newFavorite(page, t)
  const favs = page.locator('.sidebar .fav-list .list-title')
  await expect(favs).toHaveText(['Xray', 'Yank', 'Zulu'])

  const from = (await page.locator('.sidebar .fav-list .list-item', { hasText: 'Zulu' }).boundingBox())!
  const to = (await page.locator('.sidebar .fav-list .list-item', { hasText: 'Xray' }).boundingBox())!
  await page.mouse.move(from.x + 40, from.y + from.height / 2)
  // hovering preloads the drag module; under load it can take a while, and a drag that
  // ends before the module arrives is dropped (by design), so wait for the chunk
  await expect
    .poll(() =>
      page.evaluate(() => performance.getEntriesByType('resource').some((e) => /\/drag-[\w-]+\.js$/.test(e.name))),
    )
    .toBe(true)
  await page.waitForTimeout(100)
  await page.mouse.down()
  await page.mouse.move(from.x + 40, from.y + from.height / 2 - 10, { steps: 3 })
  await expect(page.locator('.tree-ghost')).toHaveCount(1) // the drag has started
  await page.mouse.move(to.x + 40, to.y + 4, { steps: 8 })
  await expect(page.locator('.tree-drop-line')).toBeVisible()
  await page.mouse.up()
  await expect(favs).toHaveText(['Zulu', 'Xray', 'Yank'])
  await reload(page)
  await expect(favs).toHaveText(['Zulu', 'Xray', 'Yank'])
})
