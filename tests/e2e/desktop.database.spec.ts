import { expect, test } from '@playwright/test'
import { makeImage } from './media'
import { enableDatabase, failOnConsoleErrors, gridCell, openApp, openQaDatabase, reload } from './helpers'

test.describe('database (M4)', () => {
  test('without the flag, "+" creates a document directly', async ({ page }) => {
    await openApp(page)
    await page.click('.sidebar-bottom >> text=새 페이지')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(page.locator('.wn-editor')).toBeVisible()
  })

  test('with the flag, the new view menu offers Grid and opens a database view', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await enableDatabase(page)
    await openApp(page)
    await page.click('.sidebar-bottom >> text=새 페이지')
    await expect(page.getByRole('menuitem', { name: '보드' })).toBeDisabled()
    await page.getByRole('menuitem', { name: '표 (Grid)' }).click()
    // a new database starts with three empty rows (DB-F05)
    await expect(page.locator('.db-view[data-layout="grid"]')).toHaveAttribute('data-rows', '3')
    await expect(page.locator('.wn-editor')).toHaveCount(0)
    noErrors()
  })

  test('grid shows typed cells and edits text, number, time, url and checkbox (M4-05)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    const name = await gridCell(page, 0, 'Name')
    await expect(name).toHaveText('Item 1')
    await expect(page.locator('.dbg-hcell')).toHaveCount(12)

    // text: double click edits, Enter saves and moves down
    await name.click()
    await name.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('첫 행')
    await page.keyboard.press('Enter')
    await expect(name).toHaveText('첫 행')
    await expect(await gridCell(page, 1, 'Name')).toHaveAttribute('aria-selected', 'true')

    // number: typing on the active cell replaces it, currency format
    const amount = await gridCell(page, 0, 'Amount')
    await amount.click()
    await page.keyboard.type('15000')
    await expect(page.locator('.dbc-editor')).toHaveAttribute('inputmode', 'decimal')
    await page.keyboard.press('Enter')
    await expect(amount).toHaveText('₩15,000')
    // not a number: the old value stays
    await amount.click()
    await page.keyboard.type('abc')
    await page.keyboard.press('Enter')
    await expect(amount).toHaveText('₩15,000')

    const estimate = await gridCell(page, 0, 'Estimate')
    await estimate.click()
    await page.keyboard.type('1h 30m')
    await page.keyboard.press('Tab')
    await expect(estimate).toHaveText('1h 30m')

    const link = await gridCell(page, 0, 'Link')
    await link.click()
    await page.keyboard.type('example.org')
    await page.keyboard.press('Escape') // cancel
    await expect(link).toContainText('https://example.com/0')
    await page.keyboard.press('Backspace') // still the active cell: clears it
    await expect(link).toHaveText('')
    await page.keyboard.type('example.org')
    await page.keyboard.press('Enter')
    await expect(link.locator('a')).toHaveAttribute('href', 'https://example.org')

    const done = (await gridCell(page, 0, 'Done')).getByRole('checkbox')
    const was = await done.getAttribute('aria-checked')
    await done.click()
    await expect(done).toHaveAttribute('aria-checked', was === 'true' ? 'false' : 'true')

    // read-only automatic times
    const created = await gridCell(page, 0, 'Created')
    await created.click()
    await page.keyboard.type('x')
    await expect(page.locator('.dbc-editor')).toHaveCount(0)

    await reload(page)
    await expect(await gridCell(page, 0, 'Name')).toHaveText('첫 행')
    await expect(await gridCell(page, 0, 'Amount')).toHaveText('₩15,000')
    noErrors()
  })

  test('select, multi-select, date and checklist editors (M4-06)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    // single select: choose, create a new option, edit an option's colour and name
    const status = await gridCell(page, 0, 'Status')
    await status.click()
    await page.keyboard.press('Enter')
    const pop = page.getByRole('dialog', { name: 'Status' })
    await pop.getByRole('option', { name: 'Doing' }).click()
    await expect(pop).toHaveCount(0) // single select closes
    await expect(status).toHaveText('Doing')
    await status.click() // active cell: opens again
    await page.getByRole('dialog', { name: 'Status' }).getByLabel('옵션 검색 또는 만들기').fill('검토')
    await page.keyboard.press('Enter')
    await expect(status).toHaveText('검토')
    await status.click()
    const pop2 = page.getByRole('dialog', { name: 'Status' })
    await pop2.getByRole('option', { name: '검토' }).locator('..').getByRole('button', { name: '옵션 편집' }).click()
    await pop2.getByRole('radio', { name: '초록' }).click()
    await pop2.getByLabel('옵션 이름').fill('리뷰')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await expect(status).toHaveText('리뷰')
    await expect(status.locator('.db-chip')).toHaveAttribute('style', /--sel-green/)

    // multi select: add and remove
    const tags = await gridCell(page, 1, 'Tags')
    await tags.click()
    await page.keyboard.press('Enter')
    const tp = page.getByRole('dialog', { name: 'Tags' })
    const before = (await tags.textContent()) ?? ''
    const todo = tp.getByRole('option', { name: 'Todo' })
    const wasOn = (await todo.getAttribute('aria-selected')) === 'true'
    await todo.click()
    await expect(todo).toHaveAttribute('aria-selected', wasOn ? 'false' : 'true')
    await page.keyboard.press('Escape')
    await expect(tags).not.toHaveText(before)

    // date: pick a day, then a range
    const due = await gridCell(page, 0, 'Due')
    await due.click()
    await page.keyboard.press('Enter')
    const dp = page.getByRole('dialog', { name: 'Due' })
    await dp.getByRole('button', { name: /^(다음 달)$/ }).click()
    await dp.locator('.db-cal-day:not(.is-other)', { hasText: /^15$/ }).click()
    await dp.getByRole('switch', { name: '종료일' }).click()
    await dp.locator('.db-cal-day:not(.is-other)', { hasText: /^18$/ }).click()
    await dp.getByLabel('날짜 형식').selectOption('iso')
    await page.keyboard.press('Escape')
    await expect(due).toHaveText(/^\d{4}-\d{2}-15 → \d{4}-\d{2}-18$/)

    // checklist: add, check
    const tasks = await gridCell(page, 2, 'Tasks')
    await tasks.click()
    await page.keyboard.press('Enter')
    const cp = page.getByRole('dialog', { name: 'Tasks' })
    await cp.getByLabel('항목 추가').first().fill('새 항목')
    await page.keyboard.press('Enter')
    await cp.getByRole('checkbox', { name: '새 항목' }).check()
    await page.keyboard.press('Escape')
    await expect(tasks).toContainText(/\d+\/4/)

    await reload(page)
    await expect(await gridCell(page, 0, 'Status')).toHaveText('리뷰')
    await expect(await gridCell(page, 0, 'Due')).toHaveText(/15 → .*18$/)
    noErrors()
  })

  test('media cells upload, show and remove files (M4-07)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    const files = await gridCell(page, 0, 'Files')
    await files.click()
    await page.keyboard.press('Enter')
    const pop = page.getByRole('dialog', { name: 'Files' })
    await pop
      .getByLabel('파일 추가')
      .first()
      .setInputFiles([
        { name: 'photo.png', mimeType: 'image/png', buffer: await makeImage(page, 40, 30) },
        { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
      ])
    await expect(pop.locator('.db-media-name')).toHaveText(['photo.png', 'notes.txt'])
    await page.keyboard.press('Escape')
    await expect(files.locator('img.db-thumb')).toHaveCount(1)
    await expect(files).toContainText('notes.txt')
    await files.click()
    await page.getByRole('dialog', { name: 'Files' }).getByRole('button', { name: 'notes.txt 삭제' }).click()
    await page.getByRole('dialog', { name: 'Files' }).getByRole('switch', { name: '파일 이름 숨기기' }).click()
    await page.keyboard.press('Escape')
    await expect(files).not.toContainText('photo.png')
    await expect(files.locator('img.db-thumb')).toHaveCount(1)
    noErrors()
  })
})
