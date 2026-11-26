import { expect, test, type Page } from '@playwright/test'
import { composeKorean, failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

test.describe('phone', () => {
  let assertNoErrors: () => void
  test.beforeEach(async ({ page }) => {
    assertNoErrors = failOnConsoleErrors(page)
    await openApp(page)
  })
  test.afterEach(() => assertNoErrors())

  test('opens full-screen; back goes to home tabs (not out of the app)', async ({ page }) => {
    await expect(page.locator('.sidebar')).toHaveCount(0)
    await page.getByLabel('뒤로').tap()
    await expect(page.locator('.tab')).toHaveCount(4)
  })

  async function newPageAndFocusBody(page: Page) {
    await page.getByLabel('뒤로').tap()
    await page.click('.fab')
    await waitForNewPage(page)
    await page.locator('.page-title').tap()
    await page.keyboard.type('모바일 메모')
    await page.keyboard.press('Enter')
    await expect(page.locator('.kb-toolbar')).toBeVisible()
  }

  test('Korean IME composition commits correctly', async ({ page }) => {
    await newPageAndFocusBody(page)
    await composeKorean(page, ['ㅎ', '하', '한', '한ㄱ', '한그'], '한글')
    await page.keyboard.type(' 입력')
    await expect(page.locator('.wn-editor p').first()).toHaveText('한글 입력')
  })

  test('keyboard toolbar: block panel, indent, bold, undo — keeps editor focus', async ({ page }) => {
    await newPageAndFocusBody(page)
    await page.keyboard.type('첫 줄')
    await page.getByLabel('블록 바꾸기').tap()
    await page.locator('.kb-block', { hasText: '할 일 목록' }).tap()
    await expect(page.locator('.wn-editor ul[data-type="taskList"]')).toHaveCount(1)
    expect(await page.evaluate(() => document.activeElement?.classList.contains('wn-editor'))).toBe(true)

    await page.keyboard.press('Enter')
    await page.keyboard.type('두 번째')
    await page.getByLabel('들여쓰기').tap()
    await expect(page.locator('.wn-editor li li')).toHaveCount(1)

    await page.getByLabel('굵게').tap()
    await page.keyboard.type('굵게')
    await expect(page.locator('.wn-editor strong')).toHaveCount(1)
    await page.getByLabel('실행 취소').tap()
    await expect(page.locator('.wn-editor strong')).toHaveCount(0)
  })

  test('page menu is a bottom sheet; favorites and search tabs', async ({ page }) => {
    await newPageAndFocusBody(page)
    await page.getByLabel('더보기').tap()
    await expect(page.locator('.sheet')).toBeVisible()
    await page.locator('.menu-item', { hasText: '즐겨찾기에 추가' }).tap()

    await page.getByLabel('뒤로').tap()
    await page.locator('.tab', { hasText: '즐겨찾기' }).tap()
    await expect(page.locator('.list-title', { hasText: '모바일 메모' })).toHaveCount(1)
    await page.locator('.tab', { hasText: '검색' }).tap()
    await page.fill('.search-box input', '모바일')
    await expect(page.locator('.list-title', { hasText: '모바일 메모' })).toHaveCount(1)
  })
})
