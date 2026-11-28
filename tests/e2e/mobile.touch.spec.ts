import { expect, test } from '@playwright/test'
import { gridCell, openApp, openQaDatabase } from './helpers'
import { auditLog, smallTargets } from './touchAudit'

/**
 * Touch target audit (MB-11, M7-02): walks the phone screens — home tabs, a page, its
 * keyboard toolbar and sheets, a database (grid, card sheet), settings — and lists every
 * visible target under 44×44.
 */
test.describe('touch targets are at least 44×44 (MB-11)', () => {
  test('home, page, editor, sheets, settings', async ({ page }) => {
    const log = auditLog()
    const bad = { push: (...l: string[]) => log.add(l) }
    await openApp(page)
    bad.push(...(await smallTargets(page, 'page')))
    await page.getByLabel('더보기').tap()
    await expect(page.locator('.sheet')).toBeVisible()
    bad.push(...(await smallTargets(page, 'page menu')))
    await page.goBack()
    await expect(page.locator('.sheet')).toHaveCount(0)
    await page.getByRole('button', { name: '아이콘 변경' }).tap()
    await expect(page.locator('.sheet')).toBeVisible()
    bad.push(...(await smallTargets(page, 'icon sheet')))
    await page.goBack()
    await page.locator('.wn-editor p').first().tap()
    await expect(page.locator('.kb-toolbar')).toBeVisible()
    bad.push(...(await smallTargets(page, 'editing')))
    await page.locator('.kb-toolbar').getByLabel('블록 메뉴').tap()
    await expect(page.locator('.sheet')).toBeVisible()
    bad.push(...(await smallTargets(page, 'block menu')))
    await page.goBack()
    await expect(page.locator('.sheet')).toHaveCount(0)
    await page.locator('.wn-editor p').first().tap()
    await page.getByLabel('블록 추가').tap()
    bad.push(...(await smallTargets(page, 'block panel')))
    await page
      .getByRole('button', { name: '텍스트 스타일' })
      .tap()
      .catch(() => {})
    bad.push(...(await smallTargets(page, 'text style')))
    await page.keyboard.press('Escape')
    await page.getByLabel('뒤로').tap()
    await expect(page.locator('.tab')).toHaveCount(4)
    await expect(page.locator('.tree-row').first()).toBeVisible()
    for (const tab of await page.locator('.tab').all()) {
      await tab.tap()
      bad.push(...(await smallTargets(page, `home tab ${await tab.innerText()}`)))
    }
    await page.locator('.tab', { hasText: '검색' }).tap()
    await page.fill('.search-box input', 'WebNota')
    await expect(page.locator('.list-title').first()).toBeVisible()
    bad.push(...(await smallTargets(page, 'search results')))
    await page.goto(page.url().replace(/#.*$/, '#/trash'))
    await expect(page.locator('.view').first()).toBeVisible()
    bad.push(...(await smallTargets(page, 'trash')))
    await page.goBack()
    await page.locator('.tab').first().tap()
    await page.getByLabel('설정').first().tap()
    await page.waitForURL(/settings/)
    bad.push(...(await smallTargets(page, 'settings')))
    expect(log.list).toEqual([])
  })

  test('database: grid, sheets, card list, row page, board, calendar', async ({ page }) => {
    const log = auditLog()
    const audit = async (label: string) => log.add(await smallTargets(page, label))
    const closeSheet = async () => {
      await page.goBack()
      await expect(page.locator('.sheet')).toHaveCount(0)
    }
    await openQaDatabase(page)
    await audit('grid')
    await (await gridCell(page, 0, 'Status')).tap()
    await expect(page.locator('.sheet')).toBeVisible()
    await audit('select sheet')
    await closeSheet()
    await (await gridCell(page, 0, 'Name')).tap()
    await expect(page.locator('.sheet').getByLabel('셀 편집')).toBeFocused()
    await audit('cell editor sheet')
    await page.locator('.sheet').getByLabel('셀 편집').press('Escape')
    for (const name of ['필터', '정렬']) {
      await page.getByRole('button', { name, exact: true }).tap()
      await expect(page.locator('.sheet')).toBeVisible()
      await audit(`${name} panel`)
      await closeSheet()
    }
    await page.getByRole('button', { name: '데이터베이스 메뉴' }).tap()
    await audit('database menu')
    await closeSheet()
    await page.getByRole('button', { name: '카드 목록 보기' }).tap()
    await expect(page.locator('.db-card').first()).toBeVisible()
    await audit('card list')
    await page.locator('.db-card').first().tap()
    await expect(page.getByRole('dialog', { name: '행 페이지' })).toBeVisible()
    await audit('row page')
    await page.goBack()
    await page.getByRole('button', { name: '표 보기' }).tap()
    for (const layout of ['보드', '캘린더']) {
      await page.getByRole('button', { name: '보기 추가' }).tap()
      await page.getByRole('menuitem', { name: layout }).tap()
      await expect(page.locator(layout === '보드' ? '.dbk' : '.dbc').first()).toBeVisible()
      await audit(layout)
    }
    expect(log.list).toEqual([])
  })
})
