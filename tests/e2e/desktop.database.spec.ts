import { expect, test } from '@playwright/test'
import { makeImage } from './media'
import { enableDatabase, failOnConsoleErrors, gridCell, openApp, openQaDatabase, reload } from './helpers'

test.describe('database (M4)', () => {
  test('without the flag, "+" creates a document directly', async ({ page }) => {
    await openApp(page)
    await page.click('.sidebar [data-new-page] >> nth=0')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(page.locator('.wn-editor')).toBeVisible()
  })

  test('with the flag, the new view menu offers Grid and opens a database view', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await enableDatabase(page)
    await openApp(page)
    await page.click('.sidebar [data-new-page] >> nth=0')
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
    await expect(page.getByRole('grid')).toHaveAttribute('aria-colcount', '12')

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

  test('rows and columns are virtualized; the first column stays frozen (M4-08)', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 })
    await openQaDatabase(page)
    const grid = page.getByRole('grid')
    await expect(page.locator('.dbg-row')).not.toHaveCount(50) // 50 rows, only the visible ones (+overscan)
    expect(await page.locator('.dbg-hcell').count()).toBeLessThan(12)
    await grid.evaluate((el) => (el.scrollLeft = el.scrollWidth))
    await expect(page.locator('.dbg-hcell .dbg-hname').last()).toHaveText('Updated')
    const name = page.locator('.dbg-hcell', { hasText: 'Name' })
    await expect(name).toBeVisible()
    const box = await name.boundingBox()
    const gridBox = await grid.boundingBox()
    expect(Math.abs(box!.x - gridBox!.x - 44)).toBeLessThan(2) // sticky right of the row gutter
    await grid.evaluate((el) => (el.scrollTop = el.scrollHeight))
    await expect(page.locator('.dbg-row', { hasText: 'Item 50' })).toBeVisible()
  })

  test('rows: new, insert below, menu (duplicate, delete + undo), multi-delete, drag, open (M4-09)', async ({
    page,
  }) => {
    const noErrors = failOnConsoleErrors(page)
    await enableDatabase(page)
    await openApp(page)
    await page.click('.sidebar [data-new-page] >> nth=0')
    await page.getByRole('menuitem', { name: '표 (Grid)' }).click()
    const rows = page.locator('.dbg-row')
    const names = () => page.locator('.dbg-row [data-type="text"] .dbc-text').allTextContents()
    await expect(rows).toHaveCount(3)
    // bottom "+ 새 행": the new row's first cell becomes active; type a name
    await page.getByRole('button', { name: '새 행' }).click()
    await expect(rows).toHaveCount(4)
    await page.keyboard.type('D')
    await page.keyboard.press('Enter')
    for (const [i, n] of ['A', 'B', 'C'].entries()) {
      const cell = await gridCell(page, i, '이름')
      await cell.click()
      await page.keyboard.type(n)
      await page.keyboard.press('Enter')
    }
    await expect.poll(names).toEqual(['A', 'B', 'C', 'D'])

    // hover "+" inserts below
    await rows.nth(0).hover()
    await rows.nth(0).getByRole('button', { name: '아래에 행 추가' }).click()
    await page.keyboard.type('A2')
    await page.keyboard.press('Enter')
    await expect.poll(names).toEqual(['A', 'A2', 'B', 'C', 'D'])

    // handle press → menu: duplicate, delete, undo
    await rows.nth(2).hover()
    await rows
      .nth(2)
      .getByRole('button', { name: /행 메뉴/ })
      .click()
    await page.getByRole('menuitem', { name: '복제' }).click()
    await expect.poll(names).toEqual(['A', 'A2', 'B', 'B', 'C', 'D'])
    await rows.nth(3).hover()
    await rows
      .nth(3)
      .getByRole('button', { name: /행 메뉴/ })
      .click()
    await page.getByRole('menuitem', { name: '삭제' }).click()
    await expect.poll(names).toEqual(['A', 'A2', 'B', 'C', 'D'])
    await page.getByRole('button', { name: '실행 취소' }).click()
    await expect.poll(names).toEqual(['A', 'A2', 'B', 'B', 'C', 'D'])

    // multi-select with Ctrl+click on handles, delete the selection
    await rows.nth(1).hover()
    await rows
      .nth(1)
      .getByRole('button', { name: /행 메뉴/ })
      .click({ modifiers: ['Control'] })
    await rows.nth(3).hover()
    await rows
      .nth(3)
      .getByRole('button', { name: /행 메뉴/ })
      .click({ modifiers: ['Control'] })
    await expect(page.getByText('2개 행 선택됨')).toBeVisible()
    await page.getByRole('toolbar').getByRole('button', { name: '삭제' }).click()
    await expect.poll(names).toEqual(['A', 'B', 'C', 'D'])

    // drag D above A by its handle
    const handle = rows.nth(3).getByRole('button', { name: /행 메뉴/ })
    await rows.nth(3).hover()
    const hb = (await handle.boundingBox())!
    const top = (await rows.nth(0).boundingBox())!
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
    await page.mouse.down()
    await page.mouse.move(hb.x + hb.width / 2, top.y + 20, { steps: 8 })
    await page.mouse.move(hb.x + hb.width / 2, top.y + 6, { steps: 4 })
    await expect(page.locator('.dbg-drop')).toBeVisible()
    await page.mouse.up()
    await expect.poll(names).toEqual(['D', 'A', 'B', 'C'])

    // open → properties dialog, edit the name there
    await rows.nth(1).hover()
    await rows.nth(1).getByRole('button', { name: '열기' }).click()
    const dialog = page.getByRole('dialog', { name: 'A' })
    await dialog.getByRole('button', { name: '이름' }).click()
    await page.keyboard.press('End')
    await page.keyboard.type('!')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'A!' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect.poll(names).toEqual(['D', 'A!', 'B', 'C'])
    await reload(page)
    await expect.poll(names).toEqual(['D', 'A!', 'B', 'C'])
    noErrors()
  })

  test('keyboard range selection, TSV copy / paste with new rows (M4-10)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    const grid = page.getByRole('grid')
    /** Fires a clipboard event on the grid; returns what a copy put on the clipboard. */
    const clip = (type: 'copy' | 'cut' | 'paste', text = '') =>
      grid.evaluate(
        (el, { type, text }) => {
          const dt = new DataTransfer()
          if (text) dt.setData('text/plain', text)
          el.dispatchEvent(new ClipboardEvent(type, { clipboardData: dt, bubbles: true, cancelable: true }))
          return dt.getData('text/plain')
        },
        { type, text },
      )

    // Name + Amount of rows 1–2: click, then Shift+→, Shift+↓
    await (await gridCell(page, 0, 'Name')).click()
    await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Shift+ArrowDown')
    await expect(page.locator('.dbg-cell.is-inrange')).toHaveCount(4)
    const copied = await clip('copy')
    expect(copied).toMatch(/^Item 1\t\d*\nItem 2\t\d*$/)

    // paste a 2×2 block with select/checkbox values at Status of row 1
    await page.keyboard.press('Escape')
    await (await gridCell(page, 0, 'Done')).click()
    await clip('paste', 'TRUE\tDoing\nfalse\t새 상태')
    await expect((await gridCell(page, 0, 'Done')).getByRole('checkbox')).toHaveAttribute('aria-checked', 'true')
    await expect((await gridCell(page, 1, 'Done')).getByRole('checkbox')).toHaveAttribute('aria-checked', 'false')
    await expect(await gridCell(page, 0, 'Status')).toHaveText('Doing')
    await expect(await gridCell(page, 1, 'Status')).toHaveText('새 상태')

    // one value fills a selected range
    await (await gridCell(page, 2, 'Name')).click()
    await page.keyboard.press('Shift+ArrowDown')
    await clip('paste', 'same')
    await expect(await gridCell(page, 2, 'Name')).toHaveText('same')
    await expect(await gridCell(page, 3, 'Name')).toHaveText('same')

    // Ctrl+↓ to the last row; pasting 3 rows there adds 2 rows
    await page.keyboard.press('Escape')
    await page.keyboard.press('ControlOrMeta+ArrowDown')
    await clip('paste', 'X\nY\nZ')
    await expect(grid).toHaveAttribute('aria-rowcount', '53')
    await grid.evaluate((el) => (el.scrollTop = el.scrollHeight))
    await expect(page.locator('.dbg-row', { hasText: 'Z' }).first()).toBeVisible()

    // cut clears the range
    await (await gridCell(page, 0, 'Name')).click()
    expect(await clip('cut')).toBe('Item 1')
    await expect(await gridCell(page, 0, 'Name')).toHaveText('')
    noErrors()
  })

  test('fields: add, rename, change type (confirm + undo), insert, hide, duplicate, delete, wrap, resize, move (M4-11)', async ({
    page,
  }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    const headers = () => page.locator('.dbg-hcell .dbg-hname').allTextContents()
    const grid = page.getByRole('grid')

    // primary field: no type change, no delete, no hide
    await page.getByRole('button', { name: '필드 메뉴: Name' }).click()
    let menu = page.getByRole('dialog', { name: '필드 메뉴: Name' })
    await expect(menu.getByRole('button', { name: /^유형/ })).toBeDisabled()
    await expect(menu.getByRole('button', { name: '필드 삭제' })).toHaveCount(0)
    await expect(menu.getByRole('button', { name: '숨기기' })).toHaveCount(0)
    // wrap the primary field: rows grow to fit (DB-G08)
    await menu.getByRole('switch', { name: '줄 바꿈' }).click()
    await page.keyboard.press('Escape')
    await expect(page.locator('.dbg-row.is-auto').first()).toBeVisible()
    const name0 = await gridCell(page, 0, 'Name')
    await name0.click()
    await page.keyboard.press('Enter')
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Enter')
    await page.keyboard.type('second line')
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await page.locator('.dbg-row').first().boundingBox())!.height).toBeGreaterThan(45)

    // add a text field from "+", it opens its menu: rename
    await page.getByRole('button', { name: '필드 추가' }).click()
    await page.getByRole('dialog', { name: '필드 추가' }).getByRole('option', { name: '텍스트' }).click()
    menu = page.getByRole('dialog', { name: '필드 메뉴: 텍스트' })
    await menu.getByLabel('필드 이름').fill('Code')
    await page.keyboard.press('Enter')
    await expect.poll(headers).toContain('Code')
    // values, then convert to number: one value is lost → confirm, then undo
    for (const [i, v] of ['12', 'abc'].entries()) {
      const c = await gridCell(page, i, 'Code')
      await c.click()
      await page.keyboard.type(v)
      await page.keyboard.press('Enter')
    }
    await page.getByRole('button', { name: '필드 메뉴: Code' }).click()
    menu = page.getByRole('dialog', { name: '필드 메뉴: Code' })
    await menu.getByRole('button', { name: /^유형/ }).click()
    await menu.getByRole('option', { name: '숫자' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('1개 셀의 값이 사라집니다')
    await page.getByRole('alertdialog').getByRole('button', { name: '바꾸기' }).click()
    await expect(await gridCell(page, 0, 'Code')).toHaveText('12')
    await expect(await gridCell(page, 1, 'Code')).toHaveText('')
    await page.getByRole('button', { name: '실행 취소' }).click()
    await expect(await gridCell(page, 1, 'Code')).toHaveText('abc')

    // insert left, duplicate, hide, delete
    await page.getByRole('button', { name: '필드 메뉴: Code' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '왼쪽에 삽입' }).click()
    await expect.poll(async () => (await headers()).slice(-2)).toEqual(['텍스트', 'Code'])
    await page.getByRole('button', { name: '필드 메뉴: Code' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '복제' }).click()
    await expect.poll(headers).toContain('Code 복사본')
    await expect(await gridCell(page, 1, 'Code 복사본')).toHaveText('abc')
    await page.getByRole('button', { name: '필드 메뉴: Code 복사본' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '숨기기' }).click()
    await expect.poll(headers).not.toContain('Code 복사본')
    await page.getByRole('button', { name: '필드 메뉴: 텍스트' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '필드 삭제' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '필드 삭제' }).click()
    await expect.poll(headers).not.toContain('텍스트')

    // resize Name by its edge
    await grid.evaluate((el) => (el.scrollLeft = 0))
    const nameHeader = page.locator('.dbg-hcell', { hasText: 'Name' })
    const before = (await nameHeader.boundingBox())!
    const edge = nameHeader.getByRole('separator')
    const eb = (await edge.boundingBox())!
    await page.mouse.move(eb.x + 3, eb.y + 10)
    await page.mouse.down()
    await page.mouse.move(eb.x + 80, eb.y + 10, { steps: 5 })
    await page.mouse.up()
    await expect.poll(async () => (await nameHeader.boundingBox())!.width).toBeGreaterThan(before.width + 60)

    // drag Done before Amount
    const amount = page.getByRole('button', { name: '필드 메뉴: Amount' })
    const done = page.getByRole('button', { name: '필드 메뉴: Done' })
    const ab = (await amount.boundingBox())!
    const db = (await done.boundingBox())!
    await page.mouse.move(db.x + db.width / 2, db.y + 10)
    await page.mouse.down()
    await page.mouse.move(ab.x + 20, ab.y + 10, { steps: 6 })
    await page.mouse.move(ab.x + 10, ab.y + 10, { steps: 2 })
    await page.mouse.up()
    await expect.poll(async () => (await headers()).slice(0, 3)).toEqual(['Name', 'Done', 'Amount'])

    await reload(page)
    await expect.poll(async () => (await headers()).slice(0, 3)).toEqual(['Name', 'Done', 'Amount'])
    noErrors()
  })

  test('settings bar: filter (AND/OR group), sort, properties, search, calculations (M4-12)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    const grid = page.getByRole('grid')
    const rowCount = async () => Number(await grid.getAttribute('aria-rowcount')) - 1
    expect(await rowCount()).toBe(50)

    // filter: Status is any of Doing
    await page.getByRole('button', { name: '필터', exact: true }).click()
    const panel = page.getByRole('dialog', { name: '필터' })
    await panel.getByRole('button', { name: '필터 추가' }).click()
    await panel.getByLabel('필드').selectOption({ label: 'Status' })
    await panel.getByRole('group', { name: '값' }).getByRole('checkbox').nth(1).check() // Doing
    await expect.poll(rowCount).toBeLessThan(50)
    const doing = await rowCount()
    for (let i = 0; i < Math.min(doing, 3); i++) await expect(await gridCell(page, i, 'Status')).toHaveText('Doing')
    // OR group: ... or (Done is checked and Amount > 50000)
    await panel.getByRole('button', { name: '필터 그룹 추가' }).click()
    await panel.getByLabel('그리고/또는').selectOption('or')
    const group = panel.getByRole('group', { name: '그룹' })
    await group.getByLabel('필드').selectOption({ label: 'Done' })
    await group.getByRole('button', { name: '필터 추가' }).click()
    await group.getByLabel('필드').nth(1).selectOption({ label: 'Amount' })
    await group.getByLabel('조건').nth(1).selectOption('gt')
    await group.getByLabel('값').fill('50000')
    await expect.poll(rowCount).toBeGreaterThan(doing)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '필터 3' })).toBeVisible()

    // a new row gets values that keep it visible? (OR filter: nothing pinned) → only with AND
    await page.getByRole('button', { name: '필터 3' }).click()
    await panel.getByRole('button', { name: '필터 삭제' }).last().click()
    await panel.getByRole('button', { name: '필터 삭제' }).last().click()
    await page.keyboard.press('Escape')
    const before = await rowCount()
    await page.getByRole('button', { name: '새 행' }).click()
    await expect.poll(rowCount).toBe(before + 1)
    await grid.evaluate((el) => (el.scrollTop = el.scrollHeight))
    await expect(page.locator('.dbg-row').last().locator('[data-type="select"]')).toHaveText('Doing')

    // clear the filter; sort by Amount descending
    await page.getByRole('button', { name: '필터 1' }).click()
    await panel.getByRole('button', { name: '필터 삭제' }).click()
    await page.keyboard.press('Escape')
    await expect.poll(rowCount).toBe(51)
    await page.getByRole('button', { name: '정렬', exact: true }).click()
    const sp = page.getByRole('dialog', { name: '정렬' })
    await sp.getByRole('button', { name: '정렬 추가' }).click()
    await sp.getByLabel('필드').selectOption({ label: 'Amount' })
    await sp.getByLabel('정렬 방향').selectOption('desc')
    await page.keyboard.press('Escape')
    await grid.evaluate((el) => (el.scrollTop = 0))
    const amounts = async () => {
      const out: number[] = []
      for (let i = 0; i < 4; i++)
        out.push(Number(((await (await gridCell(page, i, 'Amount')).textContent()) ?? '').replace(/[^0-9]/g, '')))
      return out
    }
    await expect
      .poll(async () => {
        const a = await amounts()
        return a.every((v, i) => i === 0 || v <= a[i - 1]!)
      })
      .toBe(true)
    // dragging a row while sorted explains why it cannot
    const row = page.locator('.dbg-row').first()
    await row.hover()
    const hb = (await row.getByRole('button', { name: /행 메뉴/ }).boundingBox())!
    await page.mouse.move(hb.x + 5, hb.y + 5)
    await page.mouse.down()
    await page.mouse.move(hb.x + 5, hb.y + 60, { steps: 5 })
    await page.mouse.up()
    await expect(page.getByText('정렬 중에는 행을 끌어서 옮길 수 없습니다', { exact: false })).toBeVisible()

    // properties: hide Amount
    await page.getByRole('button', { name: '속성', exact: true }).click()
    await page.getByRole('dialog', { name: '속성' }).getByRole('switch', { name: 'Amount' }).click()
    await expect(page.getByRole('dialog', { name: '속성' }).getByRole('switch', { name: 'Name' })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '속성 1' })).toBeVisible()
    await expect(page.locator('.dbg-hname', { hasText: /^Amount$/ })).toHaveCount(0)

    // search
    await page.locator('.db-bar').getByRole('button', { name: '검색' }).click()
    await page.locator('.db-bar').getByLabel('검색', { exact: true }).fill('Item 4')
    await expect.poll(rowCount).toBe(11) // Item 4, Item 40–49
    await page.keyboard.press('Escape')
    await expect.poll(rowCount).toBe(51)

    // calculation row: count on Name, checked % on Done
    await page.getByRole('button', { name: 'Name: 계산' }).click()
    await page.getByRole('menuitemcheckbox', { name: '개수' }).click()
    await expect(page.locator('.dbg-calc[data-field-id]').first()).toContainText('51')
    await reload(page)
    await expect(page.locator('.dbg-calc').first()).toContainText('51')
    await expect(page.getByRole('button', { name: '정렬 1' })).toBeVisible()
    noErrors()
  })
})
