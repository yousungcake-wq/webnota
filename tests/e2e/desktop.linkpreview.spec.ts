import { expect, test, type Page } from '@playwright/test'
import { failOnConsoleErrors, openApp, reload, waitForNewPage } from './helpers'
import { editorJson } from './media'

const WORKER = 'https://worker.test'

async function fakeWorker(page: Page) {
  const calls: string[] = []
  await page.addInitScript((w) => localStorage.setItem('webnota:worker-url', w), WORKER)
  await page.route(`${WORKER}/unfurl**`, (r) => {
    const url = new URL(r.request().url()).searchParams.get('url')!
    calls.push(url)
    return r.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        url,
        title: '예제 글 제목',
        description: '이 글은 링크 미리보기 테스트용 설명입니다.',
        image: 'http://localhost:4173/icons/icon-192.png',
        siteName: 'Example Blog',
      }),
    })
  })
  await page.route(/youtube-nocookie\.com/, (r) => r.fulfill({ contentType: 'text/html', body: '<html></html>' }))
  return calls
}

async function pasteText(page: Page, text: string) {
  await page.evaluate((t) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', t)
    document
      .querySelector('.wn-editor')!
      .dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
  }, text)
}

const nodesOf = async (page: Page, type: string) =>
  (await editorJson(page)).content.filter((n) => n.type === type).map((n) => n.attrs!)

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
})

test('URL on its own line → "preview card": metadata from the worker, cached in the block (ED-B21)', async ({
  page,
}) => {
  const check = failOnConsoleErrors(page)
  const calls = await fakeWorker(page)
  await reload(page)
  await page.locator('.wn-editor').click()
  await pasteText(page, 'https://blog.example.com/post/1')
  const menu = page.getByRole('menu', { name: '붙여넣은 링크' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem')).toHaveText(['링크로 두기', '미리보기 카드'])
  await menu.getByRole('menuitem', { name: '미리보기 카드' }).click()

  const card = page.locator('.wn-editor .link-card')
  await expect(card.locator('.link-card-title')).toHaveText('예제 글 제목')
  await expect(card.locator('.link-card-desc')).toContainText('링크 미리보기 테스트용')
  await expect(card.locator('.link-card-site')).toHaveText('Example Blog')
  await expect(card).toHaveAttribute('href', 'https://blog.example.com/post/1')
  expect(calls).toEqual(['https://blog.example.com/post/1'])
  expect((await nodesOf(page, 'linkPreview'))[0]).toMatchObject({ title: '예제 글 제목', siteName: 'Example Blog' })

  await reload(page)
  await expect(page.locator('.wn-editor .link-card-title')).toHaveText('예제 글 제목')
  expect(calls).toHaveLength(1) // cached in the block: no second request

  // back to a plain link
  await page.evaluate(() => {
    const dom = document.querySelector('.wn-editor') as unknown as {
      editor: { commands: { setNodeSelection: (p: number) => void } }
    }
    dom.editor.commands.setNodeSelection(0)
  })
  await page.getByRole('toolbar', { name: '미디어 도구' }).getByRole('button', { name: '링크로 바꾸기' }).click()
  await expect(page.locator('.wn-editor a[href="https://blog.example.com/post/1"]')).toHaveText(
    'https://blog.example.com/post/1',
  )
  check()
})

test('URL paste offers video/embed/image where they fit; Esc keeps the link; mid-text has no menu', async ({
  page,
}) => {
  await fakeWorker(page)
  await pasteText(page, 'https://youtu.be/dQw4w9WgXcQ')
  const menu = page.getByRole('menu', { name: '붙여넣은 링크' })
  await expect(menu.getByRole('menuitem')).toHaveText(['링크로 두기', '미리보기 카드', '동영상'])
  await menu.getByRole('menuitem', { name: '동영상' }).click()
  await expect(page.locator('.wn-editor .video-block iframe')).toBeVisible()
  expect((await nodesOf(page, 'video'))[0]!.src).toBe('https://youtu.be/dQw4w9WgXcQ')

  await page.keyboard.type('글 ')
  await pasteText(page, 'https://example.org/a.png')
  await expect(menu).toHaveCount(0) // not on its own line
  await page.keyboard.press('Enter')
  await pasteText(page, 'https://example.org/b.png')
  await expect(menu.getByRole('menuitem')).toHaveText(['링크로 두기', '미리보기 카드', '이미지'])
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(page.locator('.wn-editor a[href="https://example.org/b.png"]')).toBeVisible()
})

test('/link preview asks for an address; without a worker the card shows the host (ED-B21)', async ({ page }) => {
  await page.keyboard.type('/미리보기')
  await page.keyboard.press('Enter')
  await page.locator('.link-card.is-empty').getByRole('button', { name: '링크 넣기' }).click()
  await page.getByRole('dialog').getByRole('textbox').fill('https://news.example.net/today')
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click()
  await expect(page.locator('.wn-editor .link-card-title')).toHaveText('news.example.net')
})
