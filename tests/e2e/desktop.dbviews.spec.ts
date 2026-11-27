import { expect, test, type Locator } from '@playwright/test'
import { dbLive, failOnConsoleErrors, openQaDatabase, reload } from './helpers'

test.describe('database views (M5)', () => {
  test('tab bar: add, switch, independent settings, rename, duplicate, reorder, delete (M5-01)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    const tabs = page.getByRole('tablist', { name: '데이터베이스 보기' })
    const tabNames = () => tabs.getByRole('tab').allInnerTexts()
    await expect(tabs.getByRole('tab')).toHaveCount(1)
    const host = (await tabNames())[0]!
    const rowCount = async () => Number(await page.getByRole('grid').getAttribute('aria-rowcount')) - 1

    // add a board and a second grid
    await page.getByRole('button', { name: '보기 추가' }).click()
    await page.getByRole('menuitem', { name: '보드' }).click()
    await expect(tabs.getByRole('tab', { selected: true })).toHaveText('보드')
    await expect(page.locator('.db-view')).toHaveAttribute('data-layout', 'board')
    await page.getByRole('button', { name: '보기 추가' }).click()
    await page.getByRole('menuitem', { name: '표 (Grid)' }).click()
    await expect(tabs.getByRole('tab', { selected: true })).toHaveText('표 (Grid)')
    expect(await tabNames()).toEqual([host, '보드', '표 (Grid)'])
    // the new views sit under the database in the sidebar
    await expect(page.locator('.sidebar .tree-link', { hasText: '보드' })).toBeVisible()

    // a filter in the second grid does not touch the first
    await expect.poll(rowCount).toBe(50)
    await page.getByRole('button', { name: '필터', exact: true }).click()
    const panel = page.getByRole('dialog', { name: '필터' })
    await panel.getByRole('button', { name: '필터 추가' }).click()
    await panel.getByLabel('값').fill('zzz-nothing')
    await expect.poll(rowCount).toBe(0)
    await page.keyboard.press('Escape')
    await tabs.getByRole('tab', { name: host }).click()
    await expect(tabs.getByRole('tab', { selected: true })).toHaveText(host)
    await expect.poll(rowCount).toBe(50)

    // rename (menu of the selected tab)
    await tabs.getByRole('tab', { name: '표 (Grid)' }).click()
    await tabs.getByRole('tab', { name: '표 (Grid)' }).click()
    await page.getByRole('menuitem', { name: '보기 이름 바꾸기' }).click()
    const dialog = page.getByRole('dialog', { name: '보기 이름 바꾸기' })
    await dialog.getByLabel('이름').fill('Empty')
    await dialog.getByRole('button', { name: '확인' }).click()
    await expect(tabs.getByRole('tab', { selected: true })).toHaveText('Empty')

    // duplicate keeps the settings (the filter)
    await tabs.getByRole('tab', { name: 'Empty' }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: '보기 복제' }).click()
    await expect(tabs.getByRole('tab', { selected: true })).toHaveText('Empty (사본)')
    expect(await tabNames()).toEqual([host, '보드', 'Empty', 'Empty (사본)'])
    await expect.poll(rowCount).toBe(0)

    // drag "Empty (사본)" before "보드"
    const from = await tabs.getByRole('tab', { name: 'Empty (사본)' }).boundingBox()
    const to = await tabs.getByRole('tab', { name: '보드' }).boundingBox()
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++)
      await page.mouse.move(
        from!.x + from!.width / 2 + ((to!.x + 4 - from!.x - from!.width / 2) * i) / 10,
        from!.y + 10,
      )
    await page.mouse.up()
    await expect.poll(tabNames).toEqual([host, 'Empty (사본)', '보드', 'Empty'])

    // delete the selected tab → back to the database page; the first tab has no delete
    await tabs.getByRole('tab', { name: 'Empty (사본)' }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: '보기 삭제' }).click()
    await expect(tabs.getByRole('tab', { selected: true })).toHaveText(host)
    expect(await tabNames()).toEqual([host, '보드', 'Empty'])
    await tabs.getByRole('tab', { name: host }).click()
    await expect(page.getByRole('menuitem', { name: '보기 이름 바꾸기' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: '보기 삭제' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await reload(page)
    await dbLive(page)
    expect(await tabNames()).toEqual([host, '보드', 'Empty'])
    await tabs.getByRole('tab', { name: 'Empty' }).click()
    await expect.poll(rowCount).toBe(0)
    noErrors()
  })

  test('board: columns by Status, cards, open, inline title, add to a column, group by (M5-03)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.getByRole('button', { name: '보기 추가' }).click()
    await page.getByRole('menuitem', { name: '보드' }).click()
    const col = (name: string) => page.locator('.dbk-col', { has: page.locator('.dbk-head', { hasText: name }) })
    await expect(page.locator('.dbk-col')).toHaveCount(5) // no value, Todo, Doing, Done, Blocked
    await expect(page.locator('.dbk-col').first().locator('.dbk-head')).toContainText('Status 없음')
    const counts = await page.locator('.dbk-count').allInnerTexts()
    expect(counts.map(Number).reduce((a, b) => a + b, 0)).toBe(50)

    // open a card → its properties
    const doing = col('Doing')
    const first = doing.locator('.dbk-card').first()
    const name = (await first.locator('.db-card-title').innerText()).trim()
    await first.locator('.dbk-card-body').click()
    await expect(page.getByRole('dialog', { name })).toBeVisible()
    await page.keyboard.press('Escape')

    // inline title
    await first.hover()
    await first.getByRole('button', { name: '제목 편집' }).click()
    await first.getByLabel('카드 제목').fill('보드에서 바꿈')
    await first.getByLabel('카드 제목').press('Enter')
    await expect(doing.locator('.db-card-title', { hasText: '보드에서 바꿈' })).toBeVisible()

    // add a card to "Done": it gets Done and a title
    const done = col('Done')
    const before = Number(await done.locator('.dbk-count').innerText())
    await done.getByRole('button', { name: '새로 만들기' }).click()
    await page.getByLabel('카드 제목').fill('새 카드')
    await page.getByLabel('카드 제목').press('Enter')
    await expect(done.locator('.dbk-count')).toHaveText(String(before + 1))
    await expect(done.locator('.db-card-title', { hasText: '새 카드' })).toBeVisible()

    // show Amount on cards (properties), then group by the Done checkbox
    await page.getByRole('button', { name: /^속성/ }).click()
    await page.getByRole('switch', { name: 'Amount' }).click()
    await page.keyboard.press('Escape')
    await expect(page.locator('.dbk-card .db-card-prop[data-type="number"]').first()).toBeVisible()
    await page.getByRole('button', { name: '보드', exact: true }).click()
    await page.getByRole('dialog', { name: '보드' }).getByLabel('그룹 기준').selectOption({ label: 'Done' })
    await page.keyboard.press('Escape')
    await expect(page.locator('.dbk-col')).toHaveCount(2)
    await expect(page.locator('.dbk-head').nth(0)).toContainText('체크 안 됨')
    await expect(page.locator('.dbk-head').nth(1)).toContainText('체크됨')

    await reload(page)
    await dbLive(page)
    await expect(page.locator('.dbk-col')).toHaveCount(2)
    noErrors()
  })

  test('board drag: within a column, to another column (value changes), columns reorder (M5-04)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.getByRole('button', { name: '보기 추가' }).click()
    await page.getByRole('menuitem', { name: '보드' }).click()
    const col = (name: string) => page.locator(`.dbk-col[aria-label="${name}"]`)
    const titles = (name: string) => col(name).locator('.db-card-title').allInnerTexts()
    await expect(col('Doing').locator('.dbk-card')).not.toHaveCount(0)
    const drag = async (from: Locator, to: { x: number; y: number }) => {
      const b = (await from.boundingBox())!
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
      await page.mouse.down()
      for (let i = 1; i <= 12; i++)
        await page.mouse.move(
          b.x + b.width / 2 + ((to.x - b.x - b.width / 2) * i) / 12,
          b.y + b.height / 2 + ((to.y - b.y - b.height / 2) * i) / 12,
        )
      await expect(page.locator('.dbk-ghost')).toBeVisible()
      await page.mouse.up()
    }

    // last Doing card → top of Doing
    const doing = await titles('Doing')
    const lastCard = col('Doing')
      .locator('.dbk-card')
      .nth(doing.length - 1)
    const firstBox = (await col('Doing').locator('.dbk-card').first().boundingBox())!
    await drag(lastCard, { x: firstBox.x + 40, y: firstBox.y + 8 })
    await expect.poll(() => titles('Doing')).toEqual([doing.at(-1)!, ...doing.slice(0, -1)])

    // first Doing card → Done (top): its Status becomes Done
    const moved = doing.at(-1)!
    const doneCount = Number(await col('Done').locator('.dbk-count').innerText())
    const doneFirst = (await col('Done').locator('.dbk-card').first().boundingBox())!
    await drag(col('Doing').locator('.dbk-card').first(), { x: doneFirst.x + 40, y: doneFirst.y + 8 })
    await expect.poll(async () => (await titles('Done'))[0]).toBe(moved)
    await expect(col('Done').locator('.dbk-count')).toHaveText(String(doneCount + 1))
    await expect(col('Doing').locator('.db-card-title', { hasText: new RegExp(`^${moved}$`) })).toHaveCount(0)

    // drag the "Blocked" column header before "Todo" (all columns on screen)
    await page.setViewportSize({ width: 1900, height: 900 })
    const heads = () => page.locator('.dbk-col').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
    const before = await heads()
    const todoHead = (await col('Todo').locator('.dbk-handle').boundingBox())!
    const blocked = col('Blocked').locator('.dbk-handle')
    const bb = (await blocked.boundingBox())!
    await page.mouse.move(bb.x + 10, bb.y + bb.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++)
      await page.mouse.move(bb.x + 10 + ((todoHead.x - 20 - bb.x) * i) / 12, bb.y + bb.height / 2)
    await page.mouse.up()
    const expected = before.filter((h) => h !== 'Blocked')
    expected.splice(expected.indexOf('Todo'), 0, 'Blocked')
    await expect.poll(heads).toEqual(expected)

    // the grid shows the new Status
    await page.getByRole('tab', { name: /QA database/ }).click()
    await reload(page)
    await dbLive(page)
    await page.getByRole('tab', { name: '보드' }).click()
    await expect.poll(heads).toEqual(expected)
    await expect.poll(async () => (await titles('Done'))[0]).toBe(moved)
    noErrors()
  })

  test('board columns: rename, colour, hide + hidden panel, new group, delete option, sort inside columns (M5-05)', async ({
    page,
  }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.setViewportSize({ width: 1900, height: 900 })
    await page.getByRole('button', { name: '보기 추가' }).click()
    await page.getByRole('menuitem', { name: '보드' }).click()
    const heads = () => page.locator('.dbk-col').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
    const col = (name: string) => page.locator(`.dbk-col[aria-label="${name}"]`)
    await expect(page.locator('.dbk-col')).toHaveCount(5)

    // rename Todo → 할 일 (the option itself)
    await col('Todo').locator('.dbk-handle').click()
    await page.getByRole('menuitem', { name: '열 이름 바꾸기' }).click()
    const dialog = page.getByRole('dialog', { name: '열 이름 바꾸기' })
    await dialog.getByLabel('옵션 이름').fill('할 일')
    await dialog.getByRole('button', { name: '확인' }).click()
    await expect(col('할 일')).toBeVisible()

    // colour
    await col('할 일').locator('.dbk-handle').click()
    await page.getByRole('menuitem', { name: '색' }).click()
    await page.getByRole('menuitemcheckbox', { name: '초록' }).click()
    await expect(col('할 일').locator('.db-chip')).toHaveAttribute('style', /--sel-green/)

    // hide Blocked and the empty column → hidden panel → show again
    await col('Blocked').locator('.dbk-handle').click()
    await page.getByRole('menuitem', { name: '열 숨기기' }).click()
    await col('Status 없음').locator('.dbk-handle').click()
    await page.getByRole('menuitem', { name: '열 숨기기' }).click()
    await expect(page.locator('.dbk-col')).toHaveCount(3)
    const side = page.getByRole('complementary', { name: '숨긴 그룹' })
    await expect(side.locator('.dbk-hidden')).toHaveCount(2)
    await side.locator('.dbk-hidden', { hasText: 'Blocked' }).getByRole('button', { name: '보이기' }).click()
    await expect(page.locator('.dbk-col')).toHaveCount(4)

    // new group
    await side.getByRole('button', { name: '새 그룹' }).click()
    const add = page.getByRole('dialog', { name: '새 그룹' })
    await add.getByLabel('옵션 이름').fill('검토')
    await add.getByRole('button', { name: '확인' }).click()
    await expect(col('검토')).toBeVisible()
    await expect(col('검토').locator('.dbk-count')).toHaveText('0')

    // delete an option: its cards go to the (hidden) empty column
    const blocked = Number(await col('Blocked').locator('.dbk-count').innerText())
    const emptyBefore = Number(
      await side.locator('.dbk-hidden', { hasText: 'Status 없음' }).locator('.dbk-count').innerText(),
    )
    await col('Blocked').locator('.dbk-handle').click()
    await page.getByRole('menuitem', { name: '옵션 삭제' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '옵션 삭제' }).click()
    await expect(col('Blocked')).toHaveCount(0)
    await expect(side.locator('.dbk-hidden', { hasText: 'Status 없음' }).locator('.dbk-count')).toHaveText(
      String(emptyBefore + blocked),
    )

    // sort applies inside columns
    await page.getByRole('button', { name: '정렬', exact: true }).click()
    const sort = page.getByRole('dialog', { name: '정렬' })
    await sort.getByRole('button', { name: '정렬 추가' }).click()
    await sort.getByLabel('필드').first().selectOption({ label: 'Name' })
    await sort.getByLabel('정렬 방향').first().selectOption('desc')
    await page.keyboard.press('Escape')
    const names = await col('Doing').locator('.db-card-title').allInnerTexts()
    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a, 'ko', { numeric: true })))
    expect(await heads()).toEqual(['할 일', 'Doing', 'Done', '검토'])
    noErrors()
  })

  test('calendar: month of Due, navigation, double-click adds a row, settings (M5-06)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.getByRole('button', { name: '보기 추가' }).click()
    await page.getByRole('menuitem', { name: '캘린더' }).click()
    const month = page.locator('.dbc-month')
    const now = new Date()
    const label = (d: Date) => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(d)
    await expect(month).toHaveText(label(now))
    // the seed puts Due dates in the 60 days from today: events this month
    await expect(page.locator('.dbc-event').first()).toBeVisible()
    await page.getByRole('button', { name: '다음 달' }).click()
    await expect(month).toHaveText(label(new Date(now.getFullYear(), now.getMonth() + 1, 1)))
    await page.getByRole('button', { name: '오늘' }).click()
    await expect(month).toHaveText(label(now))
    await page.getByLabel('월 선택').fill('2025-03')
    await expect(month).toHaveText(label(new Date(2025, 2, 1)))
    await expect(page.locator('.dbc-event')).toHaveCount(0)

    // double-click a day → a new row dated that day (its properties open)
    const day = page.locator('.dbc-day:not(.is-other)', { has: page.locator('.dbc-date', { hasText: /^12$/ }) })
    await day.dblclick()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.dbc-event')).toHaveCount(1)
    await expect(day.locator('xpath=..').locator('.dbc-event')).toHaveCount(1)

    // settings: Monday first, no weekends, week numbers
    await page.getByRole('button', { name: '캘린더', exact: true }).click()
    const panel = page.getByRole('dialog', { name: '캘린더' })
    await panel.getByRole('radio', { name: '월요일' }).click()
    await panel.getByRole('switch', { name: '주말 표시' }).click()
    await panel.getByRole('switch', { name: '주 번호 표시' }).click()
    await page.keyboard.press('Escape')
    await expect(page.locator('.dbc-weekday')).toHaveCount(5)
    await expect(page.locator('.dbc-weekday').first()).toHaveText('월')
    await expect(page.locator('.dbc-week .dbc-wn').first()).toHaveText('9') // 2025-02-24 is ISO week 9
    noErrors()
  })

  test('calendar drag: move an event to another day; place an undated row from the panel (M5-07)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.getByRole('button', { name: '보기 추가' }).click()
    await page.getByRole('menuitem', { name: '캘린더' }).click()
    await page.getByLabel('월 선택').fill('2025-03')
    const day = (n: number) =>
      page.locator('.dbc-day:not(.is-other)', { has: page.locator('.dbc-date', { hasText: new RegExp(`^${n}$`) }) })
    const dragTo = async (from: Locator, to: Locator) => {
      const a = (await from.boundingBox())!
      const b = (await to.boundingBox())!
      await page.mouse.move(a.x + 10, a.y + a.height / 2)
      await page.mouse.down()
      for (let i = 1; i <= 10; i++)
        await page.mouse.move(
          a.x + 10 + ((b.x + b.width / 2 - a.x - 10) * i) / 10,
          a.y + a.height / 2 + ((b.y + b.height / 2 - a.y - a.height / 2) * i) / 10,
        )
      await expect(to).toHaveClass(/is-drop/)
      await page.mouse.up()
    }
    // an event on the 12th (double-click), named
    await day(12).dblclick()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.dbc-event')).toHaveCount(1)
    const bar = page.locator('.dbc-event').first()
    const barDay = async () => {
      const b = (await bar.boundingBox())!
      return page.evaluate(
        ([x, y]) =>
          [...document.elementsFromPoint(x!, y!)]
            .map((e) => (e as HTMLElement).closest?.('[data-day]'))
            .find(Boolean)
            ?.querySelector('.dbc-date')?.textContent,
        [b.x + 4, b.y + b.height / 2],
      )
    }
    expect(await barDay()).toBe('12')
    await dragTo(bar, day(20))
    await expect.poll(barDay).toBe('20')

    // undated rows: the panel lists them; drag one onto the 5th
    await page.getByRole('button', { name: /^일정 없음/ }).click()
    const panel = page.getByRole('complementary', { name: '일정 없음' })
    const items = panel.locator('.dbc-nodate-item')
    const n = await items.count()
    expect(n).toBeGreaterThan(0)
    const name = (await items.first().innerText()).trim()
    await dragTo(items.first().locator('.dbc-event'), day(5))
    await expect(items).toHaveCount(n - 1)
    await expect(day(5).locator('xpath=..').locator('.dbc-event', { hasText: name })).toBeVisible()
    noErrors()
  })

  test('row page: title, icon, cover, properties (hidden folded, add), body saved in its own doc (M5-08)', async ({
    page,
  }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    const open = async () => {
      await page.locator('.dbg-row').first().hover()
      await page.locator('.dbg-row').first().locator('.dbg-open').click()
      await expect(page.locator('.db-rowpage')).toBeVisible()
    }
    await open()
    const rp = page.locator('.db-rowpage')
    // title = primary field
    const title = rp.locator('.db-rowpage-title')
    await title.fill('행 페이지 제목')
    // icon
    await rp.getByRole('button', { name: '아이콘 추가' }).click()
    await page.getByPlaceholder('이모지 검색 (한/영)').fill('rocket')
    await page.getByRole('button', { name: '🚀', exact: true }).click()
    await expect(rp.locator('.db-rowpage-icon')).toHaveText('🚀')
    // cover (a gradient)
    await rp.getByRole('button', { name: '커버 추가' }).click()
    await page.locator('.cover-swatch').first().click()
    await expect(rp.locator('.db-rowpage-cover')).toBeVisible()
    // add a property
    await rp.getByRole('button', { name: '속성 추가' }).click()
    await page.getByRole('menuitem', { name: '숫자' }).click()
    await expect(rp.locator('.db-prop-name', { hasText: '숫자' })).toBeVisible()
    // body
    await rp.locator('.wn-editor').click()
    await page.keyboard.type('행 본문입니다')
    await expect(rp.locator('.wn-editor')).toContainText('행 본문입니다')
    await page.mouse.click(1250, 450) // the backdrop
    await expect(rp).toHaveCount(0)
    await expect(page.locator('.dbg-row').first().locator('[aria-colindex="1"]')).toHaveText(/행 페이지 제목/)

    await reload(page)
    await dbLive(page)
    await open()
    await expect(rp.locator('.db-rowpage-title')).toHaveValue('행 페이지 제목')
    await expect(rp.locator('.db-rowpage-icon')).toHaveText('🚀')
    await expect(rp.locator('.wn-editor')).toContainText('행 본문입니다')
    noErrors()
  })

  test('row page folds hidden properties (M5-08)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.getByRole('button', { name: '보기 추가' }).click()
    await page.getByRole('menuitem', { name: '보드' }).click() // a board shows only titles: the rest is hidden
    await page.locator('.dbk-card-body').first().click()
    const rp = page.locator('.db-rowpage')
    await expect(rp.locator('.db-rowpage-prop')).toHaveCount(0)
    const toggle = rp.getByRole('button', { name: /숨긴 속성 \d+개/ })
    await toggle.click()
    await expect(rp.locator('.db-rowpage-prop.is-hidden').first()).toBeVisible()
    noErrors()
  })
})
