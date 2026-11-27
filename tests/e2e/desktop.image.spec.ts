import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'
import { imageAttrs, makeImage, pasteOrDropImage } from './media'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
})

test('image block: /image → upload, shows from the local cache after reload (ED-B12, SY-04)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  const ed = page.locator('.wn-editor')
  await page.keyboard.type('/이미지')
  await expect(page.locator('.slash-item.is-selected')).toContainText('이미지')
  await page.keyboard.press('Enter')
  const empty = ed.locator('.image-empty')
  await expect(empty.getByRole('button', { name: '업로드' })).toBeVisible()
  const chooser = page.waitForEvent('filechooser')
  await empty.getByRole('button', { name: '업로드' }).click()
  await (await chooser).setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: await makeImage(page, 200, 100) })

  const img = ed.locator('.image-frame img')
  await expect(img).toHaveAttribute('src', /^blob:/)
  await expect.poll(async () => (await imageAttrs(page))[0]).toMatchObject({ naturalWidth: 200, naturalHeight: 100 })
  const [attrs] = await imageAttrs(page)
  expect(attrs!.src).toMatch(/^[0-9a-f]{64}\.png$/) // small image: uploaded as is
  // queued for upload (not connected) and marked dirty
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('webnota:dirty') || '{}').files)).toBeGreaterThan(0)

  await page.reload()
  await expect(page.locator('.wn-editor .image-frame img')).toHaveAttribute('src', /^blob:/)
  check()
})

test('large photos are scaled to 2560px and stored as WebP (M3-03)', async ({ page }) => {
  await page.keyboard.type('/이미지')
  await page.keyboard.press('Enter')
  const chooser = page.waitForEvent('filechooser')
  await page.locator('.image-empty').getByRole('button', { name: '업로드' }).click()
  await (
    await chooser
  ).setFiles({
    name: 'big.jpg',
    mimeType: 'image/jpeg',
    buffer: await makeImage(page, 3200, 1600, 'image/jpeg'),
  })
  await expect(page.locator('.wn-editor .image-frame img')).toHaveAttribute('src', /^blob:/)
  const [attrs] = await imageAttrs(page)
  expect(attrs).toMatchObject({ naturalWidth: 2560, naturalHeight: 1280 })
  expect(attrs!.src).toMatch(/\.webp$/)
  const natural = await page
    .locator('.wn-editor .image-frame img')
    .evaluate((i: HTMLImageElement) => [i.naturalWidth, i.naturalHeight])
  expect(natural).toEqual([2560, 1280])
})

test('paste and drop an image file insert image blocks (ED-F06)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await page.keyboard.type('첫 줄')
  await pasteOrDropImage(page, 'paste')
  await expect(page.locator('.wn-editor .image-frame img')).toHaveCount(1)
  await pasteOrDropImage(page, 'drop', 80, 40)
  await expect(page.locator('.wn-editor .image-frame img')).toHaveCount(2)
  await expect(page.locator('.upload-placeholder')).toHaveCount(0)
  expect((await imageAttrs(page)).map((a) => a.naturalWidth).sort()).toEqual([64, 80])
  check()
})

test('toolbar: align, size, caption persist; link images work; delete (ED-B12)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await pasteOrDropImage(page, 'paste', 400, 200)
  const block = page.locator('.wn-editor .image-block')
  await expect(block.locator('img')).toBeVisible()
  await block.locator('img').click()
  const bar = page.getByRole('toolbar', { name: '이미지 도구' })
  await bar.getByRole('button', { name: '오른쪽 정렬' }).click()
  await expect(block).toHaveAttribute('data-align', 'right')
  await bar.getByRole('button', { name: '크기' }).click()
  await page.getByRole('menuitemcheckbox', { name: '50%' }).click()
  await expect(block.locator('.image-frame')).toHaveAttribute('style', /width: 50%/)
  await bar.getByRole('button', { name: '캡션' }).click()
  await page.getByRole('textbox', { name: '캡션' }).fill('바다 사진')
  await page.keyboard.press('Enter')
  await expect
    .poll(async () => (await imageAttrs(page))[0])
    .toMatchObject({ align: 'right', width: 50, caption: '바다 사진' })

  await page.reload()
  const again = page.locator('.wn-editor .image-block')
  await expect(again).toHaveAttribute('data-align', 'right')
  await expect(again.locator('.image-caption input')).toHaveValue('바다 사진')

  // drag the left handle (right-aligned image grows to the left)
  await again.locator('img').hover()
  const handle = again.locator('.image-handle.is-left')
  const hb = (await handle.boundingBox())!
  await page.mouse.move(hb.x + 3, hb.y + 10)
  await page.mouse.down()
  await page.mouse.move(hb.x - 120, hb.y + 10, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await imageAttrs(page))[0]!.width as number).toBeGreaterThan(55)

  // an external image by link
  await page.locator('.wn-editor').press('End')
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.type('/이미지')
  await page.keyboard.press('Enter')
  await page.locator('.image-empty').getByRole('button', { name: '링크로 넣기' }).click()
  await page.getByRole('textbox').last().fill('http://localhost:4173/icons/icon-192.png')
  await page.getByRole('button', { name: '확인' }).click()
  await expect(page.locator('.wn-editor img[src$="icon-192.png"]')).toBeVisible()
  await expect.poll(async () => (await imageAttrs(page))[1]).toMatchObject({ naturalWidth: 192 })

  // delete from the toolbar
  await page.locator('.wn-editor img[src$="icon-192.png"]').click()
  await page.getByRole('toolbar', { name: '이미지 도구' }).getByRole('button', { name: '이미지 삭제' }).click()
  await expect(page.locator('.wn-editor .image-block')).toHaveCount(1)
  check()
})
