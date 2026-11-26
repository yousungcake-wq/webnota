import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

// 1×1 PNG served for the cover image test
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

test.beforeEach(async ({ page }) => {
  await page.route('https://img.example.com/**', (route) => route.fulfill({ body: PNG, contentType: 'image/png' }))
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.fill('.page-title', '스타일')
})

test('cover: add, pick a color, image link, reposition, remove (ED-F11)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await page.locator('.page-head').hover()
  await page.getByRole('button', { name: '커버 추가' }).click()
  const cover = page.locator('.page-cover')
  await expect(cover).toHaveAttribute('style', /cover-g1/)

  await cover.hover()
  await page.getByRole('button', { name: '커버 변경' }).click()
  await page.getByRole('button', { name: '초록' }).click()
  await expect(cover).toHaveAttribute('style', /c-green-text/)

  await cover.hover()
  await page.getByRole('button', { name: '커버 변경' }).click()
  await page.getByLabel('이미지 링크 (https://…)').fill('https://img.example.com/cover.png')
  await page.getByRole('button', { name: '확인' }).click()
  await expect(cover.locator('img')).toHaveAttribute('src', 'https://img.example.com/cover.png')

  await cover.hover()
  await page.getByRole('button', { name: '위치 조정' }).click()
  const box = (await cover.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 60, { steps: 5 })
  await page.mouse.up()
  await page.getByRole('button', { name: '위치 저장' }).click()
  await expect(cover.locator('img')).not.toHaveAttribute('style', /50% 50%/)
  await page.waitForTimeout(300) // IndexedDB write
  await page.reload()
  await expect(cover.locator('img')).not.toHaveAttribute('style', /50% 50%/)

  await cover.hover()
  await page.getByRole('button', { name: '커버 제거' }).click()
  await expect(cover).toHaveCount(0)
  check()
})

test('page style: font, size, line spacing, full width persist (ED-F10)', async ({ page }) => {
  await page.locator('.topbar').getByRole('button', { name: '더보기' }).click()
  await page.getByRole('menuitem', { name: '페이지 스타일' }).click()
  const panel = page.getByRole('dialog', { name: '페이지 스타일' })
  await panel.getByRole('radio', { name: '세리프' }).click()
  await panel.getByRole('radio', { name: '크게' }).click()
  await panel.getByRole('radio', { name: '넓게' }).click()
  await panel.getByRole('switch', { name: '전체 폭' }).check()
  const body = page.locator('.page-body')
  await expect(body).toHaveAttribute('data-font', 'serif')
  await expect(body).toHaveAttribute('data-size', 'large')
  await expect(body).toHaveAttribute('data-line', 'relaxed')
  await expect(body).toHaveClass(/is-full/)
  await page.waitForTimeout(300)
  await page.reload()
  await expect(body).toHaveAttribute('data-font', 'serif')
  await expect(body).toHaveClass(/is-full/)
})

test('locked page: banner, read-only editor and title, unlock from the banner (ED-F17)', async ({ page }) => {
  await page.locator('.topbar').getByRole('button', { name: '더보기' }).click()
  await page.getByRole('menuitem', { name: '잠그기' }).click()
  const banner = page.locator('.lock-banner')
  await expect(banner).toBeVisible()
  await expect(page.locator('.wn-editor')).toHaveAttribute('contenteditable', 'false')
  await expect(page.locator('.page-title')).toHaveAttribute('readonly', '')
  await expect(page.getByRole('button', { name: '커버 추가' })).toHaveCount(0)
  await banner.getByRole('button', { name: '잠금 해제' }).click()
  await expect(banner).toHaveCount(0)
  await expect(page.locator('.wn-editor')).toHaveAttribute('contenteditable', 'true')
})
