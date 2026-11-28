import { expect, test, type Page } from '@playwright/test'
import { failOnConsoleErrors, newPageFromSidebar, openApp, reload, waitForNewPage } from './helpers'

// M0-25: PoC features not covered elsewhere, on the schema v2 model.
test.describe('PoC regression (desktop)', () => {
  let assertNoErrors: () => void
  test.beforeEach(async ({ page }) => {
    assertNoErrors = failOnConsoleErrors(page)
    await openApp(page)
  })
  test.afterEach(() => assertNoErrors())

  async function newPage(page: Page, title: string) {
    await newPageFromSidebar(page)
    await waitForNewPage(page)
    await page.fill('.page-title', title)
  }

  test('favorites: star a page, it appears in the sidebar and survives a reload', async ({ page }) => {
    await newPage(page, '즐겨찾기 테스트')
    await page.getByRole('button', { name: '즐겨찾기에 추가' }).click()
    await expect(page.locator('.fav-list')).toContainText('즐겨찾기 테스트')
    await reload(page)
    await expect(page.locator('.fav-list')).toContainText('즐겨찾기 테스트')
    await page.getByRole('button', { name: '즐겨찾기에서 제거' }).click()
    await expect(page.locator('.fav-list')).toHaveCount(0)
  })

  test('search finds pages by title', async ({ page }) => {
    await newPage(page, '검색용 회의록')
    await page.goto('/#/search')
    await page.getByPlaceholder('페이지 제목 검색').fill('회의')
    await page
      .getByRole('main')
      .getByRole('link', { name: /검색용 회의록/ })
      .click()
    await expect(page.locator('.page-title')).toHaveValue('검색용 회의록')
  })

  test('duplicate copies title and body', async ({ page }) => {
    await newPage(page, '원본')
    await page.locator('.wn-editor').click()
    await page.keyboard.type('복제될 본문')
    await page.locator('.tree-row', { hasText: '원본' }).hover()
    await page.locator('.tree-row', { hasText: '원본' }).getByRole('button', { name: '더보기' }).click()
    await page.getByRole('menuitem', { name: '복제' }).click()
    await expect(page.locator('.page-title')).toHaveValue('원본 (사본)')
    await expect(page.locator('.wn-editor')).toContainText('복제될 본문')
    await expect(page.locator('.tree-title', { hasText: '원본' })).toHaveCount(2)
  })

  test('to-do items toggle and the state persists', async ({ page }) => {
    await newPage(page, '할 일')
    await page.locator('.wn-editor').click()
    await page.keyboard.type('[] 우유 사기')
    const box = page.getByRole('checkbox', { name: /우유 사기/ })
    await box.check()
    await expect(box).toBeChecked()
    await page.waitForTimeout(300)
    await reload(page)
    await expect(page.getByRole('checkbox', { name: /우유 사기/ })).toBeChecked()
  })

  test('new pages keep creation order in the sidebar across reloads (FracKey order)', async ({ page }) => {
    for (const t of ['첫째', '둘째', '셋째']) await newPage(page, t)
    const titles = page.locator('.sidebar .tree .tree-title')
    await expect(titles).toHaveText(['WebNota 시작하기', '첫째', '둘째', '셋째'])
    await reload(page)
    await expect(titles).toHaveText(['WebNota 시작하기', '첫째', '둘째', '셋째'])
  })
})
