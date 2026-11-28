import { expect, test } from '@playwright/test'
import { dbLive, failOnConsoleErrors, gridCell, openQaDatabase, reload } from './helpers'

test.describe('database on phones (M4-13)', () => {
  test('44px rows, tap edits in a sheet, popovers are sheets, card list', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    const row = page.locator('.dbg-row').first()
    expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44)

    // a tap on a text cell opens the edit sheet
    const name = await gridCell(page, 0, 'Name')
    await name.tap()
    const sheet = page.locator('.sheet')
    await expect(sheet).toBeVisible()
    const editor = sheet.getByLabel('셀 편집')
    await expect(editor).toBeFocused() // mounted and settled (fill raced it on a busy CI)
    await editor.fill('폰에서 고침')
    await expect(editor).toHaveValue('폰에서 고침')
    await editor.press('Enter')
    await expect(sheet).toHaveCount(0)
    await expect(name).toHaveText('폰에서 고침')

    // number: decimal keypad
    const amount = await gridCell(page, 0, 'Amount')
    await amount.tap()
    await expect(page.locator('.sheet').getByLabel('셀 편집')).toHaveAttribute('inputmode', 'decimal')
    await page.locator('.sheet').getByLabel('셀 편집').press('Escape')
    await expect(page.locator('.sheet')).toHaveCount(0)

    // select opens as a bottom sheet
    const status = await gridCell(page, 0, 'Status')
    await status.tap()
    await expect(page.locator('.sheet .db-select')).toBeVisible()
    await page.locator('.sheet').getByRole('option', { name: 'Blocked' }).tap()
    await expect(status).toHaveText('Blocked')

    // checkbox toggles on tap
    const done = (await gridCell(page, 0, 'Done')).getByRole('checkbox')
    const was = await done.getAttribute('aria-checked')
    await done.tap()
    await expect(done).toHaveAttribute('aria-checked', was === 'true' ? 'false' : 'true')

    // filter panel is a tall sheet
    await page.getByRole('button', { name: '필터', exact: true }).tap()
    const panel = page.locator('.sheet')
    await expect(panel.locator('.db-panel')).toBeVisible()
    expect((await panel.boundingBox())!.height).toBeGreaterThan(page.viewportSize()!.height * 0.8)
    await page.goBack() // back closes the sheet (MB-14)
    await expect(page.locator('.sheet')).toHaveCount(0)

    // row handle → row menu sheet
    await row.locator('.dbg-gbtn.is-grip').tap()
    await expect(page.getByRole('menuitem', { name: '복제' })).toBeVisible()
    await page.goBack()

    // card list
    await page.getByRole('button', { name: '카드 목록 보기' }).tap()
    const card = page.locator('.db-card').first()
    await expect(card).toContainText('폰에서 고침')
    await card.tap()
    await expect(page.getByRole('dialog', { name: '행 페이지' })).toBeVisible() // M5-09
    await page.goBack()
    await expect(page.getByRole('dialog', { name: '행 페이지' })).toHaveCount(0)
    await reload(page)
    await dbLive(page) // not the cached first screen
    await expect(page.locator('.db-card').first()).toBeVisible() // remembered per device
    await page.getByRole('button', { name: '표 보기' }).tap()
    await expect(page.getByRole('grid')).toBeVisible()
    noErrors()
  })

  test('view tabs: 44px tabs, add from a sheet, switch, tab menu as a sheet (M5-01)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    const tabs = page.getByRole('tablist', { name: '데이터베이스 보기' })
    const first = tabs.getByRole('tab').first()
    expect((await first.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await page.getByRole('button', { name: '보기 추가' }).tap()
    await expect(page.locator('.sheet')).toBeVisible()
    await page.getByRole('menuitem', { name: '캘린더' }).tap()
    await expect(tabs.getByRole('tab', { selected: true })).toHaveText('캘린더')
    await expect(page.locator('.db-view')).toHaveAttribute('data-layout', 'calendar')
    await first.tap()
    await expect(page.locator('.db-view')).toHaveAttribute('data-layout', 'grid')
    await first.tap()
    await expect(page.locator('.sheet').getByRole('menuitem', { name: '보기 복제' })).toBeVisible()
    noErrors()
  })

  test('board on phones: columns snap, tap a card for its sheet, 44px add (M5-03)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.getByRole('button', { name: '보기 추가' }).tap()
    await page.getByRole('menuitem', { name: '보드' }).tap()
    await expect(page.locator('.dbk-col')).toHaveCount(5)
    const col = page.locator('.dbk-col').first()
    expect((await col.boundingBox())!.width).toBeLessThan(page.viewportSize()!.width)
    expect((await col.locator('.dbk-new').boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await col.locator('.dbk-card-body').first().tap()
    const rowPage = page.getByRole('dialog', { name: '행 페이지' }) // M5-09
    await expect(rowPage).toBeVisible()
    await rowPage.getByRole('button', { name: '닫기' }).tap()
    await expect(rowPage).toHaveCount(0)
    // column menu is a bottom sheet (M5-05)
    expect((await col.locator('.dbk-handle').boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await col.locator('.dbk-handle').tap()
    await page.locator('.sheet').getByRole('menuitem', { name: '열 숨기기' }).tap()
    await expect(page.locator('.dbk-col')).toHaveCount(4)
    noErrors()
  })

  test('board touch drag: long press then move reorders; a quick swipe does not drag (M5-04, MB-32)', async ({
    page,
  }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.getByRole('button', { name: '보기 추가' }).tap()
    await page.getByRole('menuitem', { name: '보드' }).tap()
    const col = page.locator('.dbk-col').first() // on screen (columns are 82vw)
    await expect(col.locator('.dbk-card').nth(2)).toBeVisible()
    const titles = () => col.locator('.db-card-title').allInnerTexts()
    const before = await titles()
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
      })
    const third = (await col.locator('.dbk-card').nth(2).boundingBox())!
    const first = (await col.locator('.dbk-card').first().boundingBox())!
    const x = third.x + third.width / 2
    // quick swipe: no drag
    await touch('touchStart', x, third.y + 20)
    await touch('touchMove', x, third.y + 60)
    await touch('touchEnd', x, third.y + 60)
    await expect(page.locator('.dbk-ghost')).toHaveCount(0)
    // long press, then move to the top
    await touch('touchStart', x, third.y + 20)
    await page.waitForTimeout(500)
    for (let i = 1; i <= 8; i++) await touch('touchMove', x, third.y + 20 + ((first.y + 6 - third.y - 20) * i) / 8)
    await expect(page.locator('.dbk-ghost')).toBeVisible()
    await touch('touchEnd', x, first.y + 6)
    await expect.poll(titles).toEqual([before[2]!, before[0]!, before[1]!, ...before.slice(3)])
    noErrors()
  })

  test('calendar on phones: month with dots, the selected day listed, add, place undated (M5-07, MB-33)', async ({
    page,
  }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.getByRole('button', { name: '보기 추가' }).tap()
    await page.getByRole('menuitem', { name: '캘린더' }).tap()
    await expect(page.locator('.dbc.is-phone')).toBeVisible()
    await expect(page.locator('.dbc-event')).toHaveCount(0) // no bars on phones
    // the seed's dates start today: today has dots or a later day does
    const dotted = page.locator('.dbc-day:not(.is-other):has(.dbc-dot)').first()
    await dotted.tap()
    const agenda = page.locator('.dbc-agenda')
    await expect(agenda.locator('.dbc-agenda-item').first()).toBeVisible()
    const n = await agenda.locator('.dbc-agenda-item').count()
    await agenda.getByRole('button', { name: '새로 만들기' }).tap()
    const rowPage = page.getByRole('dialog', { name: '행 페이지' }) // M5-09
    await expect(rowPage).toBeVisible()
    await page.goBack()
    await expect(rowPage).toHaveCount(0)
    await expect(agenda.locator('.dbc-agenda-item')).toHaveCount(n + 1)
    // undated rows: a sheet with "place on <day>"
    await page.getByRole('button', { name: /^일정 없음/ }).tap()
    const sheet = page.locator('.sheet')
    const before = await sheet.locator('.dbc-nodate-item').count()
    await sheet
      .locator('.dbc-nodate-item')
      .first()
      .getByRole('button', { name: /에 놓기$/ })
      .tap()
    await expect(sheet.locator('.dbc-nodate-item')).toHaveCount(before - 1)
    await page.goBack()
    await expect(agenda.locator('.dbc-agenda-item')).toHaveCount(n + 2)
    noErrors()
  })

  test('row page on phones: full screen from the card list, back closes it (M5-09, MB-31)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.getByRole('button', { name: '카드 목록 보기' }).tap()
    await page.locator('.db-card').first().tap()
    const modal = page.getByRole('dialog', { name: '행 페이지' })
    await expect(modal).toBeVisible()
    await expect(page.locator('.db-row-backdrop')).toHaveClass(/is-full/)
    const box = (await modal.boundingBox())!
    expect(box.width).toBe(page.viewportSize()!.width)
    expect((await modal.getByRole('button', { name: '다음 행' }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await modal.getByRole('button', { name: '다음 행' }).tap()
    await expect(modal.locator('.db-row-pos')).toHaveText('2 / 50')
    await page.goBack()
    await expect(modal).toHaveCount(0)
    await expect(page.locator('.db-card').first()).toBeVisible()
    noErrors()
  })

  test('inline database on phones: fits the page, scrolls inside, opens rows full screen (M5-10)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.goto('/#/')
    await page.locator('.home .tree-link, .home a', { hasText: 'WebNota' }).first().tap()
    const ed = page.locator('.wn-editor')
    await ed.locator('> p').last().tap()
    await page.keyboard.type('/데이터베이스')
    await page.locator('.slash-item', { hasText: '표 데이터베이스' }).tap()
    const inline = page.locator('.db-inline')
    await expect(inline.locator('.dbg-row')).toHaveCount(3)
    const box = (await inline.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
    await inline.locator('.dbg-row').first().locator('.dbg-gbtn.is-grip').tap()
    await page.getByRole('menuitem', { name: '열기' }).tap()
    await expect(page.locator('.db-row-backdrop')).toHaveClass(/is-full/)
    await page.goBack()
    await expect(page.locator('.db-row-backdrop')).toHaveCount(0)
    await expect(inline).toBeVisible()
    noErrors()
  })

  test('relation on phones: pick linked rows in a sheet from the row page (M6-02)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.getByRole('button', { name: '필드 추가' }).tap()
    await page.locator('.sheet').getByRole('option', { name: '관계' }).tap()
    await expect(page.locator('.sheet').getByLabel('연결할 데이터베이스')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.sheet')).toHaveCount(0)
    await page.getByRole('button', { name: '카드 목록 보기' }).tap()
    await page.locator('.db-card').first().tap()
    const modal = page.getByRole('dialog', { name: '행 페이지' })
    const relBtn = modal.getByRole('button', { name: '관계', exact: true })
    await relBtn.tap()
    await page.getByLabel('행 검색').fill('Item 2')
    await page.getByRole('option', { name: 'Item 2', exact: true }).tap()
    await expect(modal.locator('.db-rel-chip', { hasText: 'Item 2' }).first()).toBeVisible()
    noErrors()
  })

  test('CSV import on phones: database menu sheet, preview sheet (M6-06)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.getByRole('button', { name: '데이터베이스 메뉴' }).tap()
    const chooser = page.waitForEvent('filechooser')
    await page.locator('.sheet').getByRole('menuitem', { name: 'CSV 가져오기' }).tap()
    await (
      await chooser
    ).setFiles({ name: 'm.csv', mimeType: 'text/csv', buffer: Buffer.from('Name,Note\nP1,hi\nP2,yo\n') })
    const sheet = page.locator('.sheet')
    await expect(sheet.getByText('2행 · 2열')).toBeVisible()
    await sheet.getByRole('button', { name: '2행 가져오기' }).tap()
    await expect(page.getByRole('grid')).toHaveAttribute('aria-rowcount', '53')
    noErrors()
  })
})
