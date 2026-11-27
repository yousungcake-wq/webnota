import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, reload, waitForNewPage } from './helpers'

test('spaces: create, switch, edit, delete (WS-02)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  const switcher = page.locator('.sidebar').getByRole('button', { name: '스페이스 전환', exact: true })
  await expect(switcher).toContainText('일반')

  await switcher.click()
  await page.getByRole('menuitem', { name: '새 스페이스' }).click()
  const dialog = page.getByRole('dialog', { name: '새 스페이스' })
  await dialog.getByLabel('이름').fill('업무')
  await dialog.getByRole('button', { name: '🚀' }).click()
  await dialog.getByRole('button', { name: '만들기' }).click()
  await expect(switcher).toContainText('업무')
  await expect(page.locator('.sidebar .tree-empty')).toBeVisible()

  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  await page.fill('.page-title', '업무 페이지')
  await expect(page.locator('.sidebar .tree-title')).toHaveText(['업무 페이지'])

  await switcher.click()
  await page.getByRole('menuitemcheckbox', { name: '일반' }).click()
  await expect(page.locator('.sidebar .tree-title')).toHaveText(['WebNota 시작하기'])

  // the choice is remembered per device
  await reload(page)
  await expect(switcher).toContainText('일반')

  await switcher.click()
  await page.getByRole('menuitemcheckbox', { name: '업무' }).click()
  await switcher.click()
  await page.getByRole('menuitem', { name: '스페이스 설정' }).click()
  const edit = page.getByRole('dialog', { name: '스페이스 설정' })
  await edit.getByLabel('이름').fill('업무 2')
  await edit.getByRole('button', { name: '저장' }).click()
  await expect(switcher).toContainText('업무 2')

  await switcher.click()
  await page.getByRole('menuitem', { name: '스페이스 설정' }).click()
  await page.getByRole('dialog', { name: '스페이스 설정' }).getByRole('button', { name: '스페이스 삭제' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '스페이스 삭제' }).click()
  await expect(switcher).toContainText('일반')
  await page.goto('/#/trash')
  await expect(page.locator('.list-title', { hasText: '업무 페이지' })).toHaveCount(1)
  check()
})
