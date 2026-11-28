import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

test('phone: a new page offers templates as 44px chips; the tree "+" sheet has templates (M8-09)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await page.getByLabel('뒤로').tap()
  await page.locator('.fab').tap()
  await waitForNewPage(page)
  const chip = page.getByRole('group', { name: '템플릿으로 시작' }).getByRole('button', { name: /할 일/ })
  await expect(chip).toBeVisible()
  expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await chip.tap()
  await expect(page.locator('.page-title')).toHaveValue('할 일')
  await page.getByLabel('뒤로').tap()
  await page.locator('.section-head').getByRole('button', { name: '새 페이지' }).tap()
  await page.locator('.sheet').getByRole('menuitem', { name: '템플릿' }).tap()
  await page
    .locator('.sheet')
    .getByRole('menuitem', { name: /독서 목록/ })
    .tap()
  await expect(page.locator('.db-view')).toBeVisible()
  check()
})
