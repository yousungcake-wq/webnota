import { expect, test } from '@playwright/test'
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
})
