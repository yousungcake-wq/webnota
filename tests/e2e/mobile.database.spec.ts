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
    await editor.fill('폰에서 고침')
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
    await expect(page.locator('.sheet .db-rowsheet')).toBeVisible()
    await page.goBack()
    await reload(page)
    await dbLive(page) // not the cached first screen
    await expect(page.locator('.db-card').first()).toBeVisible() // remembered per device
    await page.getByRole('button', { name: '표 보기' }).tap()
    await expect(page.getByRole('grid')).toBeVisible()
    noErrors()
  })
})
