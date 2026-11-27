import { expect, test } from '@playwright/test'
import { openApp } from './helpers'
import { blurBlock } from './media'

test('phone: video from the block panel, 44px toolbar (ED-B13)', async ({ page }) => {
  await page.route(/youtube-nocookie\.com/, (r) => r.fulfill({ contentType: 'text/html', body: '<html></html>' }))
  await openApp(page)
  await page.locator('.wn-editor p').first().tap()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '블록 추가' }).tap()
  await page.locator('.kb-panel').getByRole('button', { name: '동영상', exact: true }).tap()
  await page.locator('.media-empty').getByRole('button', { name: '동영상 링크' }).tap()
  await page.getByRole('dialog').getByRole('textbox').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).tap()
  await expect(page.locator('.wn-editor .video-block iframe')).toBeVisible()
  await blurBlock(page)
  await page.locator('.wn-editor .video-block .media-shield').tap()
  const del = page.getByRole('toolbar', { name: '미디어 도구' }).getByRole('button', { name: '블록 삭제' })
  expect((await del.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await del.tap()
  await expect(page.locator('.wn-editor .video-block')).toHaveCount(0)
})
