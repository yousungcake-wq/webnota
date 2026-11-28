import { expect, test, type Page } from '@playwright/test'
import { failOnConsoleErrors, newPageFromSidebar, openApp, reload, waitForNewPage } from './helpers'
import { blurBlock, editorJson } from './media'

test.beforeEach(async ({ page }) => {
  // players are external: answer them locally so tests stay offline
  await page.route(/youtube-nocookie\.com|player\.vimeo\.com|codepen\.io/, (r) =>
    r.fulfill({ contentType: 'text/html', body: '<html><body>player</body></html>' }),
  )
  await openApp(page)
  await newPageFromSidebar(page)
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

test('video block: YouTube link → privacy-enhanced player, resize handles, image tools (ED-B13, feedback 2-5)', async ({
  page,
}) => {
  const check = failOnConsoleErrors(page)
  await insert(page, '동영상', 'https://youtu.be/dQw4w9WgXcQ?t=42')
  const frame = page.locator('.wn-editor .video-block iframe')
  await expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42')
  await expect(frame).toHaveAttribute('sandbox', /allow-scripts/)
  expect((await attrsOf(page, 'video'))[0]!.src).toBe('https://youtu.be/dQw4w9WgXcQ?t=42')

  // the shield turns the first click into a block selection
  await blurBlock(page)
  await page.locator('.wn-editor .video-block .media-shield').click()
  const bar = page.locator('.video-block').getByRole('toolbar', { name: '미디어 도구' })
  await expect(bar).toBeVisible()
  await expect(page.locator('.wn-editor .video-block .media-shield')).toHaveCount(0)
  // the toolbar is at the top-right; side handles resize like images (feedback 2-5)
  const box = page.locator('.wn-editor .video-block .media-box')
  const vb = (await box.boundingBox())!
  const tb = (await bar.boundingBox())!
  expect(vb.x + vb.width - (tb.x + tb.width)).toBeLessThan(16)
  await box.hover()
  const hb = (await page.locator('.video-block .media-handle.is-right').boundingBox())!
  await page.mouse.move(hb.x + 4, hb.y + 10)
  await page.mouse.down()
  await page.mouse.move(hb.x - 120, hb.y + 10, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await attrsOf(page, 'video'))[0]!.width as number).toBeLessThan(90)
  await bar.getByRole('button', { name: '동영상 정렬' }).click()
  await page.getByRole('menuitemcheckbox', { name: '오른쪽' }).click()
  await expect(page.locator('.wn-editor .video-block')).toHaveAttribute('data-align', 'right')
  await bar.getByRole('button', { name: '캡션', exact: true }).click()
  await page.getByRole('textbox', { name: '캡션' }).fill('뮤직비디오')
  await page.keyboard.press('Enter')
  await expect
    .poll(async () => (await attrsOf(page, 'video'))[0])
    .toMatchObject({ align: 'right', caption: '뮤직비디오' })
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

test('embed block: any page (with "open in a new tab"), known services rebuilt, height menu (ED-B22, feedback 2-2)', async ({
  page,
}) => {
  await page.route(/example\.org/, (r) =>
    r.fulfill({ contentType: 'text/html', body: '<html><body>page</body></html>' }),
  )
  const check = failOnConsoleErrors(page)
  await insert(page, '임베드', 'https://example.org/some/page')
  await expect(page.locator('.wn-editor .embed-block iframe')).toHaveAttribute('src', 'https://example.org/some/page')
  await expect(page.locator('.wn-editor .embed-block .media-open')).toHaveAttribute(
    'href',
    'https://example.org/some/page',
  )
  await expect(page.locator('.wn-editor .embed-block .media-open')).toContainText('example.org')
  // a text that is not an address is still refused
  await page.locator('.wn-editor').press('ControlOrMeta+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/임베드')
  await page.keyboard.press('Enter')
  await page.locator('.media-empty').getByRole('button').first().click()
  await page.getByRole('dialog').getByRole('textbox').fill('not a link')
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click()
  await expect(page.getByText('주소를 읽을 수 없습니다')).toBeVisible()

  await page.locator('.media-empty').getByRole('button', { name: '링크 넣기' }).click()
  await page.getByRole('dialog').getByRole('textbox').fill('https://codepen.io/someone/pen/abcDEF')
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click()
  const frame = page.locator('.wn-editor .embed-block iframe').last()
  await expect(frame).toHaveAttribute('src', 'https://codepen.io/someone/embed/abcDEF?default-tab=result')
  await blurBlock(page)
  await page.locator('.wn-editor .embed-block .media-shield').last().click()
  await page.getByRole('toolbar', { name: '미디어 도구' }).getByRole('button', { name: '크기' }).click()
  await page.getByRole('menuitemcheckbox', { name: '크게' }).click()
  await expect(page.locator('.wn-editor .embed-block .media-frame').last()).toHaveAttribute('style', /height: 640px/)
  await reload(page)
  await expect(page.locator('.wn-editor .embed-block .media-frame').last()).toHaveAttribute('style', /height: 640px/)
  check()
})
