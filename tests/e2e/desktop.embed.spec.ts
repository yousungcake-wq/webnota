import { expect, test, type Page } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'
import { blurBlock, editorJson } from './media'

test.beforeEach(async ({ page }) => {
  // players are external: answer them locally so tests stay offline
  await page.route(/youtube-nocookie\.com|player\.vimeo\.com|codepen\.io/, (r) =>
    r.fulfill({ contentType: 'text/html', body: '<html><body>player</body></html>' }),
  )
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
})

async function insert(page: Page, query: string, url: string) {
  await page.keyboard.type('위 문단')
  await page.keyboard.press('Enter')
  await page.keyboard.type(`/${query}`)
  await page.keyboard.press('Enter')
  await page.locator('.media-empty').getByRole('button').first().click()
  await page.getByRole('dialog').getByRole('textbox').fill(url)
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click()
}

const attrsOf = async (page: Page, type: string) =>
  (await editorJson(page)).content.filter((n) => n.type === type).map((n) => n.attrs!)

test('video block: YouTube link → privacy-enhanced player, width menu (ED-B13)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await insert(page, '동영상', 'https://youtu.be/dQw4w9WgXcQ?t=42')
  const frame = page.locator('.wn-editor .video-block iframe')
  await expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42')
  await expect(frame).toHaveAttribute('sandbox', /allow-scripts/)
  expect((await attrsOf(page, 'video'))[0]!.src).toBe('https://youtu.be/dQw4w9WgXcQ?t=42')

  // the shield turns the first click into a block selection
  await blurBlock(page)
  await page.locator('.wn-editor .video-block .media-shield').click()
  const bar = page.getByRole('toolbar', { name: '미디어 도구' })
  await expect(bar).toBeVisible()
  await expect(page.locator('.wn-editor .video-block .media-shield')).toHaveCount(0)
  await bar.getByRole('button', { name: '크기' }).click()
  await page.getByRole('menuitemcheckbox', { name: '50%' }).click()
  await expect.poll(async () => (await attrsOf(page, 'video'))[0]!.width).toBe(50)
  check()
})

test('video block: an uploaded file plays from the local cache (ED-B13, SY-04)', async ({ page }) => {
  await page.keyboard.type('/동영상')
  await page.keyboard.press('Enter')
  const chooser = page.waitForEvent('filechooser')
  await page.locator('.media-empty').getByRole('button', { name: '파일 올리기' }).click()
  await (await chooser).setFiles({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(2048, 1) })
  await expect(page.locator('.wn-editor video.media-video')).toHaveAttribute('src', /^blob:/)
  expect((await attrsOf(page, 'video'))[0]!.src).toMatch(/^[0-9a-f]{64}\.mp4$/)
})

test('embed block: allowlisted services only, height menu (ED-B22)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await insert(page, '임베드', 'https://evil.example/page')
  await expect(page.getByText('넣을 수 없는 주소입니다')).toBeVisible()
  await expect(page.locator('.wn-editor .embed-block iframe')).toHaveCount(0)

  await page.locator('.media-empty').getByRole('button', { name: '링크 넣기' }).click()
  await page.getByRole('dialog').getByRole('textbox').fill('https://codepen.io/someone/pen/abcDEF')
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click()
  const frame = page.locator('.wn-editor .embed-block iframe')
  await expect(frame).toHaveAttribute('src', 'https://codepen.io/someone/embed/abcDEF?default-tab=result')
  await blurBlock(page)
  await page.locator('.wn-editor .embed-block .media-shield').click()
  await page.getByRole('toolbar', { name: '미디어 도구' }).getByRole('button', { name: '크기' }).click()
  await page.getByRole('menuitemcheckbox', { name: '크게' }).click()
  await expect(page.locator('.wn-editor .embed-block .media-frame')).toHaveAttribute('style', /height: 640px/)
  await page.reload()
  await expect(page.locator('.wn-editor .embed-block .media-frame')).toHaveAttribute('style', /height: 640px/)
  check()
})
