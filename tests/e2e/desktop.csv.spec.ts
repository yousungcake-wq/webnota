import { expect, test } from '@playwright/test'
import { dbLive, failOnConsoleErrors, gridCell, openApp, openQaDatabase, reload } from './helpers'

const CSV = 'Task,Hours,Status,Done\r\n"Write, review",2,Todo,yes\r\nShip,5,Done,no\r\nRest,,Todo,\r\n'
const file = (name = 'plan.csv') => ({ name, mimeType: 'text/csv', buffer: Buffer.from(CSV) })

test.describe('CSV (M6)', () => {
  test('import as a new database: preview, types, header title (M6-06)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openApp(page)
    await page.click('.sidebar [data-new-page] >> nth=0')
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('menuitem', { name: 'CSV 가져오기' }).click()
    await (await chooser).setFiles(file())
    const dialog = page.getByRole('dialog', { name: 'CSV 가져오기: plan.csv' })
    await expect(dialog.getByText('3행 · 4열')).toBeVisible()
    await expect(dialog.getByLabel('Hours 열 유형')).toHaveValue('number')
    await expect(dialog.getByLabel('Status 열 유형')).toHaveValue('select')
    await expect(dialog.getByLabel('Done 열 유형')).toHaveValue('checkbox')
    await dialog.getByLabel('Hours 열 유형').selectOption('text')
    await dialog.getByRole('button', { name: '3행 가져오기' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('.page-title')).toHaveValue('plan')
    await expect(page.getByRole('grid')).toHaveAttribute('aria-rowcount', '4')
    await expect(await gridCell(page, 0, 'Task')).toHaveText(/Write, review/)
    await expect(await gridCell(page, 1, 'Status')).toHaveText('Done')
    await reload(page)
    await dbLive(page)
    await expect(page.getByRole('grid')).toHaveAttribute('aria-rowcount', '4')
    noErrors()
  })

  test('cancelling the import of a new database removes it (M6-06)', async ({ page }) => {
    await openApp(page)
    await page.click('.sidebar [data-new-page] >> nth=0')
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('menuitem', { name: 'CSV 가져오기' }).click()
    await (await chooser).setFiles(file('gone.csv'))
    await page.getByRole('button', { name: '취소' }).click()
    await expect(page.locator('.sidebar .tree-link', { hasText: 'gone' })).toHaveCount(0)
  })

  test('append rows to an existing database: columns map by name (M6-06)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.getByRole('button', { name: '데이터베이스 메뉴' }).click()
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('menuitem', { name: 'CSV 가져오기' }).click()
    await (await chooser).setFiles(file())
    const dialog = page.getByRole('dialog', { name: /CSV 가져오기/ })
    // Status and Done match fields of the QA database; Task is the title
    await expect(dialog.getByLabel('Status 열 넣을 곳')).toHaveValue(/^(?!__new).+/)
    await expect(dialog.getByLabel('Task 열 넣을 곳')).toHaveValue('primary')
    await dialog.getByLabel('Hours 열 넣을 곳').selectOption('__skip')
    await dialog.getByRole('button', { name: '3행 가져오기' }).click()
    await expect(page.getByRole('grid')).toHaveAttribute('aria-rowcount', '54')
    await expect(page.locator('.dbg-hname', { hasText: /^Hours$/ })).toHaveCount(0)
    noErrors()
  })

  test('export the current view (filter, sort, visible fields) or everything (M6-07)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    // filter Status = Doing, sort by Name descending
    await page.getByRole('button', { name: '필터', exact: true }).click()
    const panel = page.getByRole('dialog', { name: '필터' })
    await panel.getByRole('button', { name: '필터 추가' }).click()
    await panel.getByLabel('필드').selectOption({ label: 'Status' })
    await panel.getByRole('group', { name: '값' }).getByRole('checkbox').nth(1).check()
    await page.keyboard.press('Escape')
    const n = Number(await page.getByRole('grid').getAttribute('aria-rowcount')) - 1
    const exportCsv = async (scope: string) => {
      await page.getByRole('button', { name: '데이터베이스 메뉴' }).click()
      await page.getByRole('menuitem', { name: 'CSV 내보내기' }).click()
      const dl = page.waitForEvent('download')
      await page.getByRole('menuitem', { name: scope }).click()
      const d = await dl
      expect(d.suggestedFilename()).toBe('QA database 50.csv')
      const fs = await import('node:fs/promises')
      return (await fs.readFile((await d.path())!, 'utf8')).replace(/^\uFEFF/, '')
    }
    const view = (await exportCsv('현재 보기 (필터·정렬·보이는 속성)')).trim().split(/\r\n/)
    expect(view).toHaveLength(n + 1)
    expect(view[0]!.split(',').slice(0, 4)).toEqual(['Name', 'Amount', 'Done', 'Status'])
    expect(view.slice(1).every((l) => l.split(',')[3] === 'Doing')).toBe(true)
    const all = (await exportCsv('전체 데이터베이스')).trim().split(/\r\n/)
    expect(all).toHaveLength(51)
    noErrors()
  })
})
