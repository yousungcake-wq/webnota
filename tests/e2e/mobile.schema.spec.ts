import { expect, test } from '@playwright/test'
import { openApp, reload } from './helpers'

test('phone: read-only banner on the page editor and tab screens', async ({ page }) => {
  await openApp(page) // first run opens the seeded welcome page
  await page.evaluate(() => localStorage.setItem('webnota:debug', 'schema-newer'))
  await reload(page)

  const banner = page.getByRole('alert').filter({ hasText: '더 새로운 버전' })
  await expect(banner).toBeVisible()
  await expect(page.locator('.wn-editor')).toHaveAttribute('contenteditable', 'false')
  const button = banner.getByRole('button', { name: '앱 업데이트' })
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  await page.getByRole('button', { name: '뒤로' }).click()
  await expect(page.locator('.tabbar')).toBeVisible()
  await expect(banner).toBeVisible()
})
