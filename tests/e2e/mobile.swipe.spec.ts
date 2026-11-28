import { expect, test, type CDPSession } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'

/** A horizontal finger swipe from (x, y) by dx px. */
async function swipe(cdp: CDPSession, x: number, y: number, dx: number) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / 8, y }] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test.describe('phone swipes (MB-13, M7-04)', () => {
  let assertNoErrors: () => void
  test.beforeEach(async ({ page }) => {
    assertNoErrors = failOnConsoleErrors(page)
    await openApp(page)
  })
  test.afterEach(() => assertNoErrors())

  test('swipe a tree row left: favorite and delete buttons; a tap closes it', async ({ page, context }) => {
    await page.getByRole('button', { name: '뒤로' }).click()
    const row = page.locator('.tree-row', { hasText: 'WebNota 시작하기' })
    await expect(row).toBeVisible()
    const cdp = await context.newCDPSession(page)
    const box = async () => {
      const b = (await row.boundingBox())!
      return { x: b.x + b.width - 60, y: b.y + b.height / 2 }
    }
    let p = await box()
    await swipe(cdp, p.x, p.y, -200)
    const fav = page.getByRole('button', { name: '즐겨찾기에 추가' })
    await expect(fav).toBeVisible()
    await expect(page.locator('.tabbar')).toBeVisible() // did not open the page
    // a tap on the open row closes it without opening the page
    await row.locator('.tree-title').tap()
    await expect(fav).toHaveCount(0)
    await expect(page.locator('.tabbar')).toBeVisible()

    p = await box()
    await swipe(cdp, p.x, p.y, -200)
    await fav.tap()
    await expect(fav).toHaveCount(0)
    await page.locator('.tab', { hasText: '즐겨찾기' }).tap()
    await expect(page.locator('.fav-list .list-title', { hasText: 'WebNota 시작하기' })).toBeVisible()
    await page.locator('.tab').first().tap()

    // a short swipe springs back
    p = await box()
    await swipe(cdp, p.x, p.y, -30)
    await expect(page.getByRole('button', { name: '휴지통으로 이동' })).toHaveCount(0)

    p = await box()
    await swipe(cdp, p.x, p.y, -200)
    await page.getByRole('button', { name: '휴지통으로 이동' }).tap()
    await expect(page.locator('.tree-row', { hasText: 'WebNota 시작하기' })).toHaveCount(0)
    await page.locator('.toast').getByRole('button', { name: '실행 취소' }).tap()
    await expect(row).toBeVisible()
  })

  test('swipe from the left edge goes back (Android; iOS keeps Safari’s own)', async ({ page, context }, info) => {
    const cdp = await context.newCDPSession(page)
    const y = (page.viewportSize()!.height * 2) / 3
    await swipe(cdp, 4, y, 150)
    if (info.project.name === 'iphone') {
      await expect(page.locator('.wn-editor')).toBeVisible()
      return
    }
    await expect(page.locator('.tab')).toHaveCount(4)
    // a short edge swipe does nothing
    await page.locator('.tree-row').first().locator('.tree-title').tap()
    await expect(page.locator('.wn-editor')).toBeVisible()
    await swipe(cdp, 4, y, 40)
    await page.waitForTimeout(200)
    await expect(page.locator('.wn-editor')).toBeVisible()
  })
})
