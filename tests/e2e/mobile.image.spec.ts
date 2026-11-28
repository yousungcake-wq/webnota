import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'
import { imageAttrs, makeImage } from './media'

test('phone: image from the block panel, photo picker, drag to resize, caption (ED-B12, MB, feedback 2-4)', async ({
  page,
}) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await page.locator('.wn-editor p').first().tap()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '블록 추가' }).tap()
  await page.locator('.kb-panel').getByRole('button', { name: '이미지', exact: true }).tap()

  const upload = page.locator('.image-empty').getByRole('button', { name: '업로드' })
  await expect(upload).toBeVisible()
  expect((await upload.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  const chooser = page.waitForEvent('filechooser')
  await upload.tap()
  const fc = await chooser
  expect(await fc.element().getAttribute('accept')).toBe('image/*') // phones offer camera + gallery
  await fc.setFiles({ name: 'IMG_0001.png', mimeType: 'image/png', buffer: await makeImage(page, 300, 300) })

  const img = page.locator('.wn-editor .image-frame img')
  await expect(img).toHaveAttribute('src', /^blob:/)
  // phones resize by dragging the side handles too (feedback 2-4); the toolbar has 44px targets
  await img.tap()
  const bar = page.getByRole('toolbar', { name: '미디어 도구' })
  await expect(bar).toBeVisible()
  const handle = page.locator('.wn-editor .media-handle.is-right')
  await expect(handle).toBeVisible()
  const hb = (await handle.boundingBox())!
  // a finger drag (touch pointer events)
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y: hb.y + hb.height / 2 }],
    })
  // a busy CI can drop the first touches before the handle listens: drag again until it takes
  await expect(async () => {
    await touch('touchStart', hb.x + hb.width / 2)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))))
    for (let i = 1; i <= 6; i++) await touch('touchMove', hb.x + hb.width / 2 - i * 15)
    await touch('touchEnd', 0)
    await expect.poll(async () => (await imageAttrs(page))[0]?.width as number, { timeout: 2000 }).toBeLessThan(95)
  }).toPass({ timeout: 15000 })
  // a small image is mostly toolbar: tap its bottom-left corner
  const corner = async () => {
    const b = (await img.boundingBox())!
    await img.tap({ position: { x: 12, y: b.height - 12 } })
  }
  await corner()
  const alignBtn = bar.getByRole('button', { name: '이미지 정렬' })
  expect((await alignBtn.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await alignBtn.tap()
  await expect(page.locator('.sheet')).toBeVisible()
  await page.getByRole('menuitemcheckbox', { name: '오른쪽' }).tap()
  await expect.poll(async () => (await imageAttrs(page))[0]?.align).toBe('right')

  await corner()
  await page.getByRole('toolbar', { name: '미디어 도구' }).getByRole('button', { name: '캡션', exact: true }).tap()
  await page.getByRole('textbox', { name: '캡션' }).fill('폰 사진')
  await page.getByRole('textbox', { name: '캡션' }).press('Enter')
  await expect.poll(async () => (await imageAttrs(page))[0]?.caption).toBe('폰 사진')
  check()
})
