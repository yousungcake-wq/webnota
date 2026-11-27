import { expect, test, type Locator, type Page } from '@playwright/test'
import { failOnConsoleErrors, openApp, reload, waitForNewPage } from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
})

test('columns: insert 3, type in each, drag to resize, persists (ED-B17)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  const ed = page.locator('.wn-editor')
  await page.keyboard.type('/3열')
  await expect(page.locator('.slash-item.is-selected')).toContainText('3열')
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
  await reload(page)
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

/** Drags a block by its handle to (x, y). */
async function dragBlock(page: Page, block: Locator, x: number, y: number) {
  await block.hover()
  const grip = page.locator('.block-actions .grip')
  await expect(grip).toBeVisible()
  const g = (await grip.boundingBox())!
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2)
  await page.mouse.down()
  await page.mouse.move(g.x + 20, g.y + 20, { steps: 4 })
  await page.mouse.move(x, y, { steps: 10 })
  await page.mouse.up()
}

test('blocks move between columns, out of them, and beside other blocks (feedback 3)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  const ed = page.locator('.wn-editor')
  await page.keyboard.type('위')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/2열')
  await page.keyboard.press('Enter')
  const cols = ed.locator('.columns .column')
  await cols.nth(0).locator('p').click()
  await page.keyboard.type('왼1')
  await page.keyboard.press('Enter')
  await page.keyboard.type('왼2')
  await cols.nth(1).locator('p').click()
  await page.keyboard.type('오1')
  // a paragraph after the columns (gap cursor / arrow down below them)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.type('아래')
  await expect(ed.locator('> p')).toHaveText(['위', '아래'])

  // a block inside a column has its own handle: drag 왼2 into the right column, under 오1
  const left2 = cols.nth(0).locator('p', { hasText: '왼2' })
  const right1 = (await cols.nth(1).locator('p').first().boundingBox())!
  await dragBlock(page, left2, right1.x + right1.width / 2, right1.y + right1.height - 2)
  await expect(cols.nth(1).locator('p')).toHaveText(['오1', '왼2'])
  await expect(cols.nth(0).locator('p')).toHaveText(['왼1'])

  // drag 왼1 out below the columns: its column empties and the columns unwrap
  const below = (await ed.locator('> p', { hasText: '아래' }).boundingBox())!
  await dragBlock(page, cols.nth(0).locator('p').first(), below.x + below.width / 2, below.y + below.height - 2)
  await expect(ed.locator('.columns')).toHaveCount(0)
  await expect(ed.locator('> p')).toHaveText(['위', '오1', '왼2', '아래', '왼1'])

  // drop 위 on the right edge of 아래: the two sit side by side in new columns
  const target = (await ed.locator('> p', { hasText: '아래' }).boundingBox())!
  await dragBlock(page, ed.locator('> p').first(), target.x + target.width - 8, target.y + target.height / 2)
  await expect(ed.locator('.columns .column')).toHaveCount(2)
  await expect(ed.locator('.columns .column').nth(0)).toHaveText('아래')
  await expect(ed.locator('.columns .column').nth(1)).toHaveText('위')
  check()
})
