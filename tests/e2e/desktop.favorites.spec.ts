import { expect, test, type Page } from '@playwright/test'
import { openApp, waitForNewPage } from './helpers'

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
  await page.mouse.down()
  await page.mouse.move(from.x + 40, from.y + from.height / 2 - 10, { steps: 3 })
  await page.mouse.move(to.x + 40, to.y + 4, { steps: 8 })
  await page.mouse.up()
  await expect(favs).toHaveText(['Zulu', 'Xray', 'Yank'])
  await page.reload()
  await expect(favs).toHaveText(['Zulu', 'Xray', 'Yank'])
})
