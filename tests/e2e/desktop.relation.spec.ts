import { expect, test } from '@playwright/test'
import { dbLive, failOnConsoleErrors, gridCell, openQaDatabase, reload, waitForNewPage } from './helpers'

test.describe('relations (M6)', () => {
  test('relation field: link rows of this database, chips open the row page, another database as target (M6-02)', async ({
    page,
  }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    // a relation field (targets this database until changed)
    await page.getByRole('button', { name: '필드 추가' }).click()
    await page.getByRole('dialog', { name: '필드 추가' }).getByRole('option', { name: '관계' }).click()
    const menu = page.getByRole('dialog', { name: /필드 메뉴/ })
    await expect(menu.getByLabel('연결할 데이터베이스')).toHaveValue(/.+/)
    await page.keyboard.press('Escape')

    // link Item 2 and Item 3 to the first row
    const cell = await gridCell(page, 0, '관계')
    await cell.click()
    await cell.click()
    const pop = page.getByRole('dialog', { name: '관계' })
    await pop.getByLabel('행 검색').fill('Item 2')
    await pop.getByRole('option', { name: 'Item 2', exact: true }).click()
    await pop.getByLabel('행 검색').fill('Item 3')
    await pop.getByRole('option', { name: 'Item 3', exact: true }).click()
    await expect(pop.locator('.db-rel-linked .db-rel-chip')).toHaveCount(2)
    // the row itself is not offered
    await pop.getByLabel('행 검색').fill('Item 1')
    await expect(pop.getByRole('option', { name: 'Item 1', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(cell.locator('.db-rel-chip')).toHaveText(['Item 2', 'Item 3'])

    // a chip opens the linked row's page; back returns
    await cell.locator('.db-rel-chip', { hasText: 'Item 3' }).click()
    const modal = page.getByRole('dialog', { name: '행 페이지' })
    await expect(modal.locator('.db-rowpage-title')).toHaveValue('Item 3')
    await page.goBack()
    await expect(modal).toHaveCount(0)

    await reload(page)
    await dbLive(page)
    await expect((await gridCell(page, 0, '관계')).locator('.db-rel-chip')).toHaveText(['Item 2', 'Item 3'])

    // another database as the target: a new grid "People"
    await page.click('.sidebar [data-new-page] >> nth=0')
    await page.getByRole('menuitem', { name: '표 (Grid)' }).click()
    await waitForNewPage(page)
    await page.fill('.page-title', 'People')
    const first = await gridCell(page, 0, '이름')
    await first.click()
    await page.keyboard.type('Ann')
    await page.keyboard.press('Enter')
    await page.locator('.sidebar .tree-link', { hasText: 'QA database' }).click()
    await dbLive(page)
    await gridCell(page, 0, '관계') // scrolls the column into view
    await page.locator('.dbg-hcell', { hasText: '관계' }).click()
    await page
      .getByRole('dialog', { name: /필드 메뉴/ })
      .getByLabel('연결할 데이터베이스')
      .selectOption({ label: 'People' })
    await page.keyboard.press('Escape')
    const c2 = await gridCell(page, 1, '관계')
    await c2.click()
    await c2.click()
    const pop2 = page.getByRole('dialog', { name: '관계' })
    await pop2.getByRole('option', { name: 'Ann' }).click()
    await page.keyboard.press('Escape')
    await expect(c2.locator('.db-rel-chip')).toHaveText(['Ann'])
    // its chip opens Ann in the People database
    await c2.locator('.db-rel-chip').click()
    await expect(page.getByRole('dialog', { name: '행 페이지' }).locator('.db-rowpage-title')).toHaveValue('Ann')
    await expect(page.locator('.page-title')).toHaveValue('People')
    noErrors()
  })

  test('two-way relation: the paired field shows links back and edits on either side follow (M6-03)', async ({
    page,
  }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    // People database with Ann
    await page.click('.sidebar [data-new-page] >> nth=0')
    await page.getByRole('menuitem', { name: '표 (Grid)' }).click()
    await waitForNewPage(page)
    await page.fill('.page-title', 'People')
    const ann = await gridCell(page, 0, '이름')
    await ann.click()
    await page.keyboard.type('Ann')
    await page.keyboard.press('Enter')
    // back in QA: relation → People, two-way
    await page.locator('.sidebar .tree-link', { hasText: 'QA database' }).click()
    await dbLive(page)
    await page.getByRole('button', { name: '필드 추가' }).click()
    await page.getByRole('dialog', { name: '필드 추가' }).getByRole('option', { name: '관계' }).click()
    const menu = page.getByRole('dialog', { name: /필드 메뉴/ })
    await menu.getByLabel('연결할 데이터베이스').selectOption({ label: 'People' })
    await menu.getByRole('switch', { name: '양방향' }).click()
    await expect(menu.getByText('상대 필드: QA database 50')).toBeVisible()
    await page.keyboard.press('Escape')
    const cell = await gridCell(page, 0, '관계')
    await cell.click()
    await cell.click()
    await page.getByRole('dialog', { name: '관계' }).getByRole('option', { name: 'Ann' }).click()
    await page.keyboard.press('Escape')
    await expect(cell.locator('.db-rel-chip')).toHaveText(['Ann'])

    // People: the paired column lists Item 1; unlink it there
    await page.locator('.sidebar .tree-link', { hasText: 'People' }).click()
    await dbLive(page)
    const back = await gridCell(page, 0, 'QA database 50')
    await expect(back.locator('.db-rel-chip')).toHaveText(['Item 1'])
    await back.click()
    await back.click()
    await page.getByRole('dialog', { name: 'QA database 50' }).getByRole('button', { name: 'Item 1 연결 해제' }).click()
    await page.keyboard.press('Escape')
    await expect(back.locator('.db-rel-chip')).toHaveCount(0)
    await page.locator('.sidebar .tree-link', { hasText: 'QA database' }).click()
    await dbLive(page)
    await expect((await gridCell(page, 0, '관계')).locator('.db-rel-chip')).toHaveCount(0)
    noErrors()
  })

  test('rollup: values and calculations of linked rows, read-only, follows changes (M6-04)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    await page.getByRole('button', { name: '필드 추가' }).click()
    await page.getByRole('dialog', { name: '필드 추가' }).getByRole('option', { name: '관계' }).click()
    await expect(page.getByRole('dialog', { name: /필드 메뉴/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: /필드 메뉴/ })).toHaveCount(0)
    const rel = await gridCell(page, 0, '관계')
    await rel.click()
    await rel.click()
    const pop = page.getByRole('dialog', { name: '관계' })
    for (const n of ['Item 2', 'Item 3']) {
      await pop.getByLabel('행 검색').fill(n)
      await pop.getByRole('option', { name: n, exact: true }).click()
    }
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: '필드 추가' }).click()
    await page.getByRole('dialog', { name: '필드 추가' }).getByRole('option', { name: '롤업' }).click()
    const menu = page.getByRole('dialog', { name: /필드 메뉴/ })
    await menu.getByLabel('관계 필드').selectOption({ label: '관계' })
    await page.keyboard.press('Escape')
    const roll = await gridCell(page, 0, '롤업')
    await expect(roll).toHaveText('Item 2, Item 3') // titles by default
    // count instead
    await page.locator('.dbg-hcell', { hasText: '롤업' }).click()
    await menu.getByLabel('계산').selectOption({ label: '개수' })
    await page.keyboard.press('Escape')
    await expect(roll).toHaveText('2')
    // follows a change of the relation
    const rel2 = await gridCell(page, 0, '관계')
    const edge = { position: { x: 5, y: 5 } } // not on a chip (a chip opens the row)
    await rel2.click(edge)
    if (!(await page.getByRole('dialog', { name: '관계' }).isVisible())) await rel2.click(edge)
    await page.getByRole('dialog', { name: '관계' }).getByRole('button', { name: 'Item 2 연결 해제' }).click()
    await page.keyboard.press('Escape')
    const roll2 = await gridCell(page, 0, '롤업')
    await expect(roll2).toHaveText('1')
    // read-only: typing does not edit it
    await roll2.click()
    await page.keyboard.type('9')
    await expect(page.locator('.dbc-editor')).toHaveCount(0)
    noErrors()
  })

  test('filter and sort by a relation, search its titles, convert it to text (M6-05)', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openQaDatabase(page)
    const grid = page.getByRole('grid')
    const rowCount = async () => Number(await grid.getAttribute('aria-rowcount')) - 1
    await page.getByRole('button', { name: '필드 추가' }).click()
    await page.getByRole('dialog', { name: '필드 추가' }).getByRole('option', { name: '관계' }).click()
    await expect(page.getByRole('dialog', { name: /필드 메뉴/ })).toBeVisible()
    await page.keyboard.press('Escape')
    for (const [row, target] of [
      [0, 'Item 9'],
      [1, 'Item 7'],
    ] as const) {
      const c = await gridCell(page, row, '관계')
      await c.click({ position: { x: 5, y: 5 } })
      if (!(await page.getByRole('dialog', { name: '관계' }).isVisible())) await c.click({ position: { x: 5, y: 5 } })
      const pop = page.getByRole('dialog', { name: '관계' })
      await pop.getByLabel('행 검색').fill(target)
      await pop.getByRole('option', { name: target, exact: true }).click()
      await page.keyboard.press('Escape')
      await expect(pop).toHaveCount(0)
    }
    // filter: relation contains "Item 7"
    await page.getByRole('button', { name: '필터', exact: true }).click()
    const panel = page.getByRole('dialog', { name: '필터' })
    await panel.getByRole('button', { name: '필터 추가' }).click()
    await panel.getByLabel('필드').selectOption({ label: '관계' })
    await panel.getByLabel('값').fill('Item 7')
    await expect.poll(rowCount).toBe(1)
    await expect(await gridCell(page, 0, 'Name')).toHaveText(/Item 2/)
    await panel.getByLabel('조건').selectOption('isEmpty')
    await expect.poll(rowCount).toBe(48)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /^필터/ }).click()
    await page
      .getByRole('dialog', { name: '필터' })
      .getByRole('button', { name: /필터 삭제|삭제/ })
      .first()
      .click()
    await page.keyboard.press('Escape')
    await expect.poll(rowCount).toBe(50)
    // sort by relation titles: Item 7 (row 2) before Item 9 (row 1), empty last
    await page.getByRole('button', { name: '정렬', exact: true }).click()
    const sort = page.getByRole('dialog', { name: '정렬' })
    await sort.getByRole('button', { name: '정렬 추가' }).click()
    await sort.getByLabel('필드').first().selectOption({ label: '관계' })
    await page.keyboard.press('Escape')
    await expect(await gridCell(page, 0, 'Name')).toHaveText(/Item 2/)
    await expect(await gridCell(page, 1, 'Name')).toHaveText(/Item 1/)
    // search finds a row by its linked title
    await page.locator('.db-bar').getByRole('button', { name: '검색' }).click()
    await page.locator('.db-search-input').fill('Item 9')
    await expect.poll(rowCount).toBe(2) // Item 9 itself and the row linking it
    await page.keyboard.press('Escape')
    // convert to text: the titles stay
    await gridCell(page, 0, '관계')
    await page.locator('.dbg-hcell', { hasText: '관계' }).click()
    const menu = page.getByRole('dialog', { name: /필드 메뉴/ })
    await menu.getByRole('button', { name: /유형/ }).click()
    await menu.getByRole('option', { name: '텍스트' }).click()
    await expect(await gridCell(page, 0, '관계')).toHaveText('Item 7')
    noErrors()
  })
})
