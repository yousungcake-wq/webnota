import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, reload, waitForNewPage } from './helpers'
import { imageAttrs, makeImage, pasteOrDropImage } from './media'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar [data-new-page] >> nth=0')
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

  await reload(page)
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

test('toolbar at the top-right: align, caption → caption align, download, duplicate, clear, delete (ED-B12, feedback 2-4)', async ({
  page,
}) => {
  const check = failOnConsoleErrors(page)
  await pasteOrDropImage(page, 'paste', 400, 200)
  const block = page.locator('.wn-editor .image-block')
  await expect(block.locator('img')).toBeVisible()
  await block.locator('img').click()
  const bar = block.getByRole('toolbar', { name: '미디어 도구' })
  await expect(bar).toBeVisible()
  // the toolbar sits on the image's top-right corner, not under it
  const ib = (await block.locator('.image-frame').boundingBox())!
  const tb = (await bar.boundingBox())!
  expect(ib.x + ib.width - (tb.x + tb.width)).toBeLessThan(16)
  expect(tb.y - ib.y).toBeLessThan(16)
  // download works on desktop (a file of the workspace)
  const download = page.waitForEvent('download')
  await bar.getByRole('button', { name: '다운로드' }).click()
  expect((await download).suggestedFilename()).toMatch(/\.png$/)
  await bar.getByRole('button', { name: '이미지 정렬' }).click()
  await page.getByRole('menuitemcheckbox', { name: '오른쪽' }).click()
  await expect(block).toHaveAttribute('data-align', 'right')
  // no size presets in the align menu: the size is set by dragging the side handles
  await bar.getByRole('button', { name: '이미지 정렬' }).click()
  await expect(page.getByRole('menuitemcheckbox')).toHaveCount(3)
  await page.keyboard.press('Escape')
  // a new caption takes the caret; Backspace in an empty caption removes it
  await bar.getByRole('button', { name: '캡션', exact: true }).click()
  const captionBox = page.getByRole('textbox', { name: '캡션' })
  await expect(captionBox).toBeFocused()
  await page.keyboard.press('Backspace')
  await expect(captionBox).toHaveCount(0)
  await expect(bar.getByRole('button', { name: '캡션', exact: true })).toBeVisible()
  await bar.getByRole('button', { name: '캡션', exact: true }).click()
  // while there is a caption, the caption button is "caption alignment"
  await expect(bar.getByRole('button', { name: '캡션 정렬' })).toBeVisible()
  await expect(bar.getByRole('button', { name: '캡션', exact: true })).toHaveCount(0)
  await expect(captionBox).toBeFocused()
  await page.keyboard.type('바다 사진')
  await page.keyboard.press('Enter')
  // the caption keeps its own alignment (left) while the image is on the right
  await expect(block.locator('.media-caption')).toHaveCSS('text-align', 'left')
  await block.locator('img').click()
  await bar.getByRole('button', { name: '캡션 정렬' }).click()
  await page.getByRole('menuitemcheckbox', { name: '가운데' }).click()
  await expect(block.locator('.media-caption')).toHaveCSS('text-align', 'center')
  await expect
    .poll(async () => (await imageAttrs(page))[0])
    .toMatchObject({ align: 'right', caption: '바다 사진', captionAlign: 'center' })

  await reload(page)
  const again = page.locator('.wn-editor .image-block')
  await expect(again).toHaveAttribute('data-align', 'right')
  await expect(again.locator('.media-caption input')).toHaveValue('바다 사진')

  // drag the left handle inwards (a right-aligned image shrinks from the left); the size
  // shows at the bottom-left while dragging
  await again.locator('img').hover()
  const handle = again.locator('.media-handle.is-left')
  const hb = (await handle.boundingBox())!
  await page.mouse.move(hb.x + 3, hb.y + 10)
  await page.mouse.down()
  await page.mouse.move(hb.x + 80, hb.y + 10, { steps: 5 })
  const badge = again.locator('.media-size-badge')
  await expect(badge).toBeVisible()
  const bb = (await badge.boundingBox())!
  const fb = (await again.locator('.media-box').boundingBox())!
  expect(bb.x - fb.x).toBeLessThan(16)
  expect(fb.y + fb.height - (bb.y + bb.height)).toBeLessThan(16)
  await page.mouse.up()
  await expect.poll(async () => (await imageAttrs(page))[0]!.width as number).toBeLessThan(95)

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

  // duplicate, clear (the block stays, empty), delete
  const link = page.locator('.wn-editor .image-block', { has: page.locator('img[src$="icon-192.png"]') })
  await link.locator('img').click()
  await link.getByRole('button', { name: '복제' }).click()
  await expect(page.locator('.wn-editor img[src$="icon-192.png"]')).toHaveCount(2)
  await link.first().locator('img').click()
  await link.first().getByRole('button', { name: '비우기' }).click()
  await expect(page.locator('.wn-editor .image-block')).toHaveCount(3)
  await expect(page.locator('.wn-editor .image-empty')).toHaveCount(1)
  await page.locator('.wn-editor img[src$="icon-192.png"]').click()
  await page
    .locator('.wn-editor .image-block', { has: page.locator('img[src$="icon-192.png"]') })
    .getByRole('button', { name: '삭제', exact: true })
    .click()
  await expect(page.locator('.wn-editor .image-block')).toHaveCount(2)
  check()
})
