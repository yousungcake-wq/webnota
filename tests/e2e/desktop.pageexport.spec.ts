import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'
import { failOnConsoleErrors, newPageFromSidebar, openApp, waitForNewPage } from './helpers'
import { pasteOrDropImage } from './media'

/** Headless Chromium saves Korean download names as "download": record the name the app asked for. */
async function recordDownloadNames(page: Page) {
  await page.addInitScript(() => {
    const names: string[] = ((window as unknown as { __dl: string[] }).__dl = [])
    const click = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      if (this.download) names.push(this.download)
      click.call(this)
    }
  })
}

async function exportAs(page: Page, kind: 'Markdown' | 'HTML 파일') {
  await page.locator('.topbar').getByRole('button', { name: '더보기' }).click()
  await page.getByRole('menuitem', { name: '내보내기' }).click()
  const dl = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: kind, exact: true }).click()
  const d = await dl
  const name = await page.evaluate(() => (window as unknown as { __dl: string[] }).__dl.at(-1) ?? '')
  return { name, bytes: readFileSync((await d.path())!) }
}

test.describe('page export (M8-05, M8-06)', () => {
  test('Markdown: one .md for a plain page, a zip once it has a sub-page', async ({ page }) => {
    const check = failOnConsoleErrors(page)
    await recordDownloadNames(page)
    await openApp(page)
    await newPageFromSidebar(page)
    await waitForNewPage(page)
    await page.fill('.page-title', '내보낼 글')
    await page.locator('.wn-editor').click()
    await page.keyboard.type('## 소제목')
    await page.keyboard.press('Enter')
    await page.keyboard.type('본문 문장')
    const md = await exportAs(page, 'Markdown')
    expect(md.name).toBe('내보낼 글.md')
    const text = md.bytes.toString('utf8')
    expect(text).toContain('# 내보낼 글')
    expect(text).toContain('## 소제목')
    expect(text).toContain('본문 문장')

    await page.locator('.topbar').getByRole('button', { name: '더보기' }).click()
    await page.getByRole('menuitem', { name: '하위 페이지 추가' }).click()
    await waitForNewPage(page)
    await page.fill('.page-title', '하위')
    await page.goBack()
    await expect(page.locator('.page-title')).toHaveValue('내보낼 글')
    const zip = await exportAs(page, 'Markdown')
    expect(zip.name).toBe('내보낼 글.zip')
    const files = Object.keys(unzipSync(new Uint8Array(zip.bytes)))
    expect(files.some((f) => /^내보낼 글 [^/]+\.md$/.test(f))).toBe(true)
    expect(files.some((f) => /\/하위 [^/]+\.md$/.test(f))).toBe(true)
    expect(files).toContain('webnota.json')
    check()
  })

  test('HTML: one file with the image inside, math as MathML, nothing active', async ({ page }) => {
    const check = failOnConsoleErrors(page)
    await recordDownloadNames(page)
    await openApp(page)
    await newPageFromSidebar(page)
    await waitForNewPage(page)
    await page.fill('.page-title', 'HTML 글')
    await page.locator('.wn-editor').click()
    await page.keyboard.type('수식 $x^2$ 끝 ')
    await expect(page.locator('.wn-editor .inline-math')).toHaveCount(1)
    await page.keyboard.press('Enter')
    await pasteOrDropImage(page, 'paste', 40, 20)
    await expect(page.locator('.wn-editor .image-frame img')).toHaveAttribute('src', /^blob:/)
    const html = await exportAs(page, 'HTML 파일')
    expect(html.name).toBe('HTML 글.html')
    const s = html.bytes.toString('utf8')
    expect(s).toContain('<title>HTML 글</title>')
    expect(s).toMatch(/<img src="data:image\/png;base64,/)
    expect(s).toContain('<math')
    expect(s).not.toContain('<script')
    // it opens on its own
    await page.setContent(s)
    await expect(page.locator('h1.page-title')).toHaveText('HTML 글')
    await expect(page.locator('img')).toHaveJSProperty('complete', true)
    check()
  })
})

test('print / PDF: the menu prints the page; print styles show only the page (M8-07)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await page.addInitScript(() => {
    window.print = () => {
      ;(window as unknown as { __printed: number }).__printed = 1
    }
  })
  await openApp(page)
  await page.locator('.topbar').getByRole('button', { name: '더보기' }).click()
  await page.getByRole('menuitem', { name: '내보내기' }).click()
  await page.getByRole('menuitem', { name: '인쇄 / PDF로 저장' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed?: number }).__printed)).toBe(1)

  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.topbar')).toBeHidden()
  await expect(page.locator('.sidebar')).toBeHidden()
  await expect(page.locator('.wn-editor')).toBeVisible()
  expect(await page.locator('.page-scroll').evaluate((el) => getComputedStyle(el).overflow)).toBe('visible')
  // the dark theme turns light while printing
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    window.dispatchEvent(new Event('beforeprint'))
  })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  check()
})
