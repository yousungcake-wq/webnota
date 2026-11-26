import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: create a space from the home screen and switch back', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '뒤로' }).click()
  const switcher = page.getByRole('button', { name: '스페이스 전환', exact: true })
  await switcher.tap()
  await page.getByRole('menuitem', { name: '새 스페이스' }).tap()
  const dialog = page.getByRole('dialog', { name: '새 스페이스' })
  await dialog.getByLabel('이름').fill('폰 스페이스')
  await dialog.getByRole('button', { name: '만들기' }).tap()
  await expect(switcher).toContainText('폰 스페이스')
  await expect(page.locator('.tabbar')).toBeVisible()
  await switcher.tap()
  await page.getByRole('menuitemcheckbox', { name: '일반' }).tap()
  await expect(page.locator('.tree-title')).toHaveText(['WebNota 시작하기'])
})
