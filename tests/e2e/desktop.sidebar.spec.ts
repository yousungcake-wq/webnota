import { expect, test } from '@playwright/test'
import { openApp, reload } from './helpers'

test('sidebar: resize (persisted), collapse with Ctrl+\\, hover to peek (WS-10)', async ({ page }) => {
  await openApp(page)
  const sidebar = page.locator('.sidebar-dock .sidebar')
  const w0 = (await sidebar.boundingBox())!.width
  const handle = page.getByRole('separator', { name: '사이드바 폭 조절' })
  const h = (await handle.boundingBox())!
  await page.mouse.move(h.x + 3, h.y + 200)
  await page.mouse.down()
  await page.mouse.move(h.x + 103, h.y + 200, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(Math.round(w0 + 100))
  await reload(page)
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(Math.round(w0 + 100))

  await page.keyboard.press('Control+\\')
  await expect(page.locator('.desktop')).toHaveClass(/sidebar-collapsed/)
  await expect(page.locator('.sidebar-dock')).toHaveAttribute('aria-hidden', 'true')
  // a hover zone wider than the window edge (feedback 6)
  await page.mouse.move(16, 400)
  await expect(page.locator('.sidebar-overlay .sidebar')).toBeVisible()
  await page.mouse.move(900, 400)
  await expect(page.locator('.sidebar-overlay')).toHaveCount(0)
  // hovering the "open sidebar" button peeks too; clicking it docks the sidebar
  await page.getByRole('button', { name: '사이드바 열기' }).hover()
  await expect(page.locator('.sidebar-overlay .sidebar')).toBeVisible()
  await page.getByRole('button', { name: '사이드바 열기' }).click()
  await expect(page.locator('.desktop')).not.toHaveClass(/sidebar-collapsed/)
  await expect(page.locator('.sidebar-overlay')).toHaveCount(0) // never two sidebars at once

  // settings: collapse there too, then open with the button (feedback 6)
  await page.goto('/#/settings')
  await page.keyboard.press('Control+\\')
  await page.getByRole('button', { name: '사이드바 열기' }).click()
  await expect(page.locator('.desktop')).not.toHaveClass(/sidebar-collapsed/)
  await expect(page.locator('.sidebar')).toHaveCount(1)
})

test.describe('tablet', () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true })
  test('sidebar is a drawer: toolbar button and edge swipe open it, backdrop closes (WS-10)', async ({
    page,
    context,
  }) => {
    await openApp(page)
    await expect(page.locator('.sidebar-dock')).toHaveCount(0)
    await page.getByRole('button', { name: '사이드바 열기' }).tap()
    await expect(page.locator('.sidebar-overlay.is-drawer')).toBeVisible()
    await page.locator('.sidebar-backdrop').tap({ position: { x: 700, y: 600 } })
    await expect(page.locator('.sidebar-overlay')).toHaveCount(0)

    const cdp = await context.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 5, y: 600 }] })
    for (let x = 20; x <= 140; x += 30)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 600 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.locator('.sidebar-overlay.is-drawer')).toBeVisible()
  })
})
