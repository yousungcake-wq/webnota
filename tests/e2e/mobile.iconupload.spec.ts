import { expect, test } from '@playwright/test'
import { openApp } from './helpers'
import { makeImage } from './media'

test('phone: page icon image from the icon sheet (ED-F12, M3-09)', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '아이콘 변경' }).tap()
  await expect(page.locator('.sheet')).toBeVisible()
  const btn = page.locator('.sheet').getByRole('button', { name: '이미지 올리기' })
  expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  const chooser = page.waitForEvent('filechooser')
  await btn.tap()
  await (await chooser).setFiles({ name: 'me.png', mimeType: 'image/png', buffer: await makeImage(page, 300, 300) })
  await expect(page.locator('.page-icon img.view-icon-file')).toHaveAttribute('src', /^blob:/)
})
