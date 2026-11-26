import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

test.describe('desktop overlays', () => {
  let assertNoErrors: () => void
  test.beforeEach(async ({ page }) => {
    assertNoErrors = failOnConsoleErrors(page)
    await openApp(page)
  })
  test.afterEach(() => assertNoErrors())

  test('page menu: keyboard navigation, Esc closes and restores focus', async ({ page }) => {
    const more = page.locator('.topbar').getByLabel('더보기')
    await more.click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem').nth(1)).toBeFocused()
    await page.keyboard.press('End')
    await expect(menu.getByRole('menuitem', { name: '휴지통으로 이동' })).toBeFocused()
    await page.keyboard.press('ArrowDown') // wraps
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(more).toBeFocused()
  })

  test('move to trash shows an undo toast', async ({ page }) => {
    await page.click('.sidebar-bottom >> text=새 페이지')
    await waitForNewPage(page)
    await page.fill('.page-title', '실행 취소 테스트')
    await page.locator('.topbar').getByLabel('더보기').click()
    await page.getByRole('menuitem', { name: '휴지통으로 이동' }).click()
    const toast = page.locator('.toast', { hasText: '실행 취소 테스트' })
    await expect(toast).toBeVisible()
    await expect(page.locator('.tree-title', { hasText: '실행 취소 테스트' })).toHaveCount(0)
    await toast.getByRole('button', { name: '실행 취소' }).click()
    await expect(page.locator('.tree-title', { hasText: '실행 취소 테스트' })).toHaveCount(1)
    await expect(toast).toHaveCount(0)
  })

  test('delete forever asks with an in-app dialog', async ({ page }) => {
    await page.click('.sidebar-bottom >> text=새 페이지')
    await waitForNewPage(page)
    await page.fill('.page-title', '지울 페이지')
    await page.locator('.topbar').getByLabel('더보기').click()
    await page.getByRole('menuitem', { name: '휴지통으로 이동' }).click()
    await page.goto('/#/trash')
    const item = page.locator('.list-item', { hasText: '지울 페이지' })

    await item.getByLabel('영구 삭제').click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('지울 페이지')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(item).toHaveCount(1)

    await item.getByLabel('영구 삭제').click()
    await page.getByRole('alertdialog').getByRole('button', { name: '영구 삭제' }).click()
    await expect(item).toHaveCount(0)
  })
})
