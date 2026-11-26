import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
})

test('columns: insert 3, type in each, drag to resize, persists (ED-B17)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  const ed = page.locator('.wn-editor')
  await page.keyboard.type('/3단')
  await expect(page.locator('.slash-item.is-selected')).toContainText('3단')
  await page.keyboard.press('Enter')
  const cols = ed.locator('.columns .column')
  await expect(cols).toHaveCount(3)
  for (let i = 0; i < 3; i++) {
    await cols.nth(i).locator('p').click()
    await page.keyboard.type(`단${i + 1}`)
  }
  await expect(cols.nth(1)).toHaveText('단2')

  const first = await cols.nth(0).boundingBox()
  const handle = cols.nth(0).locator('.column-resize')
  await cols.nth(0).hover()
  const h = await handle.boundingBox()
  await page.mouse.move(h!.x + 2, h!.y + 10)
  await page.mouse.down()
  await page.mouse.move(h!.x + 120, h!.y + 10, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await cols.nth(0).boundingBox())!.width).toBeGreaterThan(first!.width + 60)

  await page.waitForTimeout(300)
  await page.reload()
  await expect(cols).toHaveCount(3)
  await expect(cols.nth(0)).toHaveAttribute('style', /flex-grow: 1\.[3-9]|flex-grow: [2-9]/)
  check()
})

test('outline lists headings live and jumps to them (ED-B18)', async ({ page }) => {
  const ed = page.locator('.wn-editor')
  await page.keyboard.type('/목차')
  await expect(page.locator('.slash-item.is-selected')).toContainText('목차')
  await page.keyboard.press('Enter')
  await expect(ed.locator('.outline')).toContainText('제목을 추가하면')
  await page.keyboard.type('# 첫 장')
  await page.keyboard.press('Enter')
  await page.keyboard.type('본문')
  await page.keyboard.press('Enter')
  await page.keyboard.type('## 둘째 절')
  const items = ed.locator('.outline li')
  await expect(items).toHaveText(['첫 장', '둘째 절'])
  await items.nth(0).getByRole('button').click()
  await page.keyboard.type('!')
  await expect(ed.locator('h1')).toHaveText('!첫 장')
})
