import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, reload, waitForNewPage } from './helpers'

test('spaces: all listed, create, new page per space, fold, edit, reorder, delete (WS-02, feedback 7)', async ({
  page,
}) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  const sidebar = page.locator('.sidebar')
  const section = (name: string) =>
    sidebar.locator('.space-section', { has: page.locator('.space-name', { hasText: name }) })
  const names = () => sidebar.locator('.space-head .space-name').allTextContents()
  await expect.poll(names).toEqual(['일반'])

  // new space from a space's "⋯" menu
  await section('일반').hover()
  await section('일반').getByRole('button', { name: '스페이스 설정' }).click()
  await page.getByRole('menuitem', { name: '새 스페이스' }).click()
  const dialog = page.getByRole('dialog', { name: '새 스페이스' })
  await dialog.getByLabel('이름').fill('업무')
  await dialog.getByRole('button', { name: '🚀' }).click()
  await dialog.getByRole('button', { name: '만들기' }).click()
  await expect.poll(names).toEqual(['일반', '업무']) // both listed at once
  await expect(section('업무').locator('.tree-empty')).toBeVisible()

  // "+" of a space creates the page in that space
  await section('업무').hover()
  await section('업무').getByRole('button', { name: '새 페이지' }).click()
  await waitForNewPage(page)
  await page.fill('.page-title', '업무 페이지')
  await expect(section('업무').locator('.tree-title')).toHaveText(['업무 페이지'])
  await expect(section('일반').locator('.tree-title')).toHaveText(['WebNota 시작하기'])

  // fold a space; remembered per device
  await section('일반').locator('.space-head-name').click()
  await expect(section('일반').locator('.tree')).toHaveCount(0)
  await reload(page)
  await expect(section('일반').locator('.tree')).toHaveCount(0)
  await section('일반').getByRole('button', { name: '펼치기' }).click()
  await expect(section('일반').locator('.tree-title')).toHaveText(['WebNota 시작하기'])

  // drag 업무 above 일반 by its header
  const from = (await section('업무').locator('.space-head-name').boundingBox())!
  const to = (await section('일반').locator('.space-head').boundingBox())!
  await page.mouse.move(from.x + 30, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + 30, from.y - 10, { steps: 4 })
  await page.mouse.move(to.x + 30, to.y + 4, { steps: 6 })
  await expect(page.locator('.tree-drop-line')).toBeVisible()
  await page.mouse.up()
  await expect.poll(names).toEqual(['업무', '일반'])

  // edit, then delete
  await section('업무').hover()
  await section('업무').getByRole('button', { name: '스페이스 설정' }).click()
  await page.getByRole('menuitem', { name: '스페이스 설정' }).click()
  const edit = page.getByRole('dialog', { name: '스페이스 설정' })
  await edit.getByLabel('이름').fill('업무 2')
  await edit.getByRole('button', { name: '저장' }).click()
  await expect.poll(names).toEqual(['업무 2', '일반'])
  await section('업무 2').hover()
  await section('업무 2').getByRole('button', { name: '스페이스 설정' }).click()
  await page.getByRole('menuitem', { name: '스페이스 설정' }).click()
  await page.getByRole('dialog', { name: '스페이스 설정' }).getByRole('button', { name: '스페이스 삭제' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '스페이스 삭제' }).click()
  await expect.poll(names).toEqual(['일반'])
  await page.goto('/#/trash')
  await expect(page.locator('.list-title', { hasText: '업무 페이지' })).toHaveCount(1)
  check()
})

test('sidebar: WebNota brand on top, workspace switcher at the bottom (feedback 7)', async ({ page }) => {
  await openApp(page)
  await expect(page.locator('.sidebar-top .brand')).toHaveText('WebNota')
  await expect(page.locator('.sidebar-bottom').getByRole('button', { name: '워크스페이스 전환' })).toBeVisible()
  // settings sits above the trash; no second "new page" there (feedback 12)
  await expect(page.locator('.sidebar-bottom .side-link')).toHaveText(['설정', '휴지통'])
})

test('deep pages: indentation stops and dots show the extra levels; "+" stays reachable (feedback 7)', async ({
  page,
}) => {
  await openApp(page)
  // nest 14 levels by adding a child to the deepest page each time
  for (let i = 0; i < 14; i++) {
    const rows = page.locator('.sidebar .tree-row')
    const last = rows.last()
    await last.hover()
    await last.getByRole('button', { name: '하위 페이지 추가' }).click()
    await waitForNewPage(page)
  }
  const deepest = page.locator('.sidebar .tree-row').last()
  await deepest.hover()
  const plus = deepest.getByRole('button', { name: '하위 페이지 추가' })
  const sidebarBox = (await page.locator('.sidebar').boundingBox())!
  const pb = (await plus.boundingBox())!
  expect(pb.x + pb.width).toBeLessThanOrEqual(sidebarBox.x + sidebarBox.width)
  await expect(deepest.locator('.tree-depth')).toHaveText(/·+/)
})
