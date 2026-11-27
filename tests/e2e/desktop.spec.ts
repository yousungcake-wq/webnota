import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, reload, waitForNewPage } from './helpers'

test.describe('desktop', () => {
  let assertNoErrors: () => void
  test.beforeEach(async ({ page }) => {
    assertNoErrors = failOnConsoleErrors(page)
    await openApp(page)
  })
  test.afterEach(() => assertNoErrors())

  test('welcome page is seeded and listed in the sidebar', async ({ page }) => {
    await expect(page.locator('.wn-editor')).toContainText('WebNota')
    await expect(page.locator('.tree-title').first()).toContainText('시작하기')
  })

  test('write a page: title, slash menu, markdown shortcut, block move', async ({ page }) => {
    await page.click('.sidebar-bottom >> text=새 페이지')
    await waitForNewPage(page)
    await page.fill('.page-title', '회의록 2026')
    await page.keyboard.press('Enter')
    await page.keyboard.type('첫 번째 줄입니다')
    await page.keyboard.press('Enter')

    await page.keyboard.type('/할')
    await expect(page.locator('.slash-item').first()).toBeVisible()
    await page.keyboard.press('Enter')
    await page.keyboard.type('우유 사기')
    await expect(page.locator('.wn-editor ul[data-type="taskList"]')).toHaveCount(1)

    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.type('# 큰 제목')
    await expect(page.locator('.wn-editor h1')).toHaveCount(1)
    await expect(page.locator('.tree-title', { hasText: '회의록 2026' })).toHaveCount(1)

    await page.keyboard.press('Alt+Shift+ArrowUp')
    const tags = await page.$$eval('.wn-editor > *', (els) => els.map((e) => e.tagName))
    expect(tags[1]).toBe('H1')
  })

  test('content persists across reload (IndexedDB) and the last page reopens', async ({ page }) => {
    await page.click('.sidebar-bottom >> text=새 페이지')
    await waitForNewPage(page)
    await page.fill('.page-title', '저장 테스트')
    await page.keyboard.press('Enter')
    await page.keyboard.type('사라지면 안 되는 내용')
    await page.waitForTimeout(400)
    await reload(page)
    await expect(page.locator('.wn-editor')).toContainText('사라지면 안 되는 내용')
    await expect(page.locator('.page-title')).toHaveValue('저장 테스트')
  })

  test('subpage, breadcrumbs, trash and restore', async ({ page }) => {
    await page.click('.sidebar-bottom >> text=새 페이지')
    await waitForNewPage(page)
    await page.fill('.page-title', '부모')
    const row = page.locator('.tree-row', { hasText: '부모' })
    await row.hover()
    await row.getByLabel('하위 페이지 추가').click()
    await waitForNewPage(page)
    await page.fill('.page-title', '하위 페이지')
    await expect(page.locator('.tree [aria-level="2"] .tree-title', { hasText: '하위 페이지' })).toHaveCount(1)
    await expect(page.locator('.crumbs')).toContainText('부모')

    await page.getByLabel('더보기').last().click()
    await page.click('text=휴지통으로 이동')
    await page.goto('/#/trash')
    await expect(page.locator('.list-title', { hasText: '하위 페이지' })).toHaveCount(1)
    await page.getByLabel('복원').click()
    await expect(page.locator('.list-title', { hasText: '하위 페이지' })).toHaveCount(0)
  })

  test('bubble menu formats selected text', async ({ page }) => {
    await page.locator('.wn-editor p').first().dblclick()
    await expect(page.locator('.bubble')).toBeVisible()
    await page.getByLabel('굵게').click()
    await expect(page.locator('.wn-editor strong').first()).toBeVisible()
  })

  test('dark theme', async ({ page }) => {
    await page.goto('/#/settings')
    await page.click('.segmented >> text=다크')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})
