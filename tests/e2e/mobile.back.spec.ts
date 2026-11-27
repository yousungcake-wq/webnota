import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: the back button walks back through the screens visited (feedback 10)', async ({ page }) => {
  await openApp(page)
  const back = page.getByRole('button', { name: '뒤로' })
  const title = page.locator('.page-title')
  await back.click() // welcome page → home
  await expect(page.locator('.tabbar')).toBeVisible()
  // page A (new), then page B opened from A's menu sheet ("add sub-page")
  await page.locator('.fab').tap()
  await expect(title).toHaveValue('')
  await title.fill('A')
  await page.getByRole('button', { name: '더보기' }).tap()
  await page.getByRole('menuitem', { name: '하위 페이지 추가' }).tap()
  await expect(title).toHaveValue('')
  await title.fill('B')
  await back.click()
  await expect(title).toHaveValue('A')
  await back.click()
  await expect(page.locator('.tabbar')).toBeVisible()
  await expect(title).toHaveCount(0)
})
