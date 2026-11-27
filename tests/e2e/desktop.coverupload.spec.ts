import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'
import { makeImage } from './media'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.fill('.page-title', '업로드 페이지')
})

test('cover: upload an image, it shows from the local cache after reload (ED-F11, M3-09)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await page.getByRole('button', { name: '커버 추가' }).click()
  await page.getByRole('button', { name: '커버 변경' }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '이미지 올리기' }).click()
  await (await chooser).setFiles({ name: 'cover.png', mimeType: 'image/png', buffer: await makeImage(page, 1200, 400) })
  const img = page.locator('.page-cover img')
  await expect(img).toHaveAttribute('src', /^blob:/)
  await page.reload()
  await expect(page.locator('.page-cover img')).toHaveAttribute('src', /^blob:/)
  // reposition still works on uploaded covers
  await expect(page.getByRole('button', { name: '위치 조정' })).toBeAttached()
  check()
})

test('page icon: upload an image, scaled to 256px, shown in the page and the sidebar (ED-F12, M3-09)', async ({
  page,
}) => {
  const check = failOnConsoleErrors(page)
  await page.getByRole('button', { name: '아이콘 추가' }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '이미지 올리기' }).click()
  await (await chooser).setFiles({ name: 'logo.png', mimeType: 'image/png', buffer: await makeImage(page, 800, 800) })
  const head = page.locator('.page-icon img.view-icon-file')
  await expect(head).toHaveAttribute('src', /^blob:/)
  expect(await head.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(256)
  await expect(page.locator('.tree-row', { hasText: '업로드 페이지' }).locator('img.view-icon-file')).toBeVisible()
  await page.reload()
  await expect(page.locator('.page-icon img.view-icon-file')).toHaveAttribute('src', /^blob:/)
  check()
})
