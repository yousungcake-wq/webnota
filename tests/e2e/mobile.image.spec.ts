import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'
import { imageAttrs, makeImage } from './media'

test('phone: image from the block panel, photo picker, size sheet, caption (ED-B12, MB)', async ({ page }) => {
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
  // no resize handles on phones; the toolbar has 44px targets and a size sheet
  await img.tap()
  const bar = page.getByRole('toolbar', { name: '미디어 도구' })
  await expect(bar).toBeVisible()
  await expect(page.locator('.image-handle')).toHaveCount(0)
  const alignBtn = bar.getByRole('button', { name: '이미지 정렬' })
  expect((await alignBtn.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await alignBtn.tap()
  await expect(page.locator('.sheet')).toBeVisible()
  await page.getByRole('menuitemcheckbox', { name: '크기 75%' }).tap()
  await expect.poll(async () => (await imageAttrs(page))[0]?.width).toBe(75)

  await img.tap()
  await page.getByRole('toolbar', { name: '미디어 도구' }).getByRole('button', { name: '캡션', exact: true }).tap()
  await page.getByRole('textbox', { name: '캡션' }).fill('폰 사진')
  await page.getByRole('textbox', { name: '캡션' }).press('Enter')
  await expect.poll(async () => (await imageAttrs(page))[0]?.caption).toBe('폰 사진')
  check()
})
