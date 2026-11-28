import { expect, test, type Page } from '@playwright/test'
import { failOnConsoleErrors, newPageFromSidebar, openApp, waitForNewPage } from './helpers'

async function paste(page: Page, data: Record<string, string>) {
  await page.evaluate((d) => {
    const dt = new DataTransfer()
    for (const [type, value] of Object.entries(d)) dt.setData(type, value)
    document
      .querySelector('.wn-editor')!
      .dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
  }, data)
}

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await newPageFromSidebar(page)
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
})

test('Markdown text becomes blocks (ED-F06)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  const ed = page.locator('.wn-editor')
  await paste(page, {
    'text/plain':
      '# 제목\n\n- [ ] 할 일\n- [x] 끝\n\n1. 하나\n2. 둘\n\n> 인용\n\n```js\nlet a = 1\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n**굵게** 와 [링크](https://example.com)',
  })
  await expect(ed.locator('h1')).toHaveText('제목')
  await expect(ed.locator('ul[data-type="taskList"] li')).toHaveCount(2)
  await expect(ed.getByRole('checkbox', { name: /끝/ })).toBeChecked()
  await expect(ed.locator('ol li')).toHaveCount(2)
  await expect(ed.locator('blockquote')).toHaveText('인용')
  await expect(ed.locator('pre code')).toContainText('let a = 1')
  await expect(ed.locator('table td')).toHaveText(['1', '2'])
  await expect(ed.locator('strong')).toHaveText('굵게')
  await expect(ed.locator('a')).toHaveAttribute('href', 'https://example.com')
  check()
})

test('code editor HTML pastes as plain text; plain text stays text', async ({ page }) => {
  const ed = page.locator('.wn-editor')
  await paste(page, {
    'text/plain': 'const x = 1\nconst y = 2',
    'text/html':
      '<div style="color: #d4d4d4;white-space: pre;"><div><span style="color: #569cd6;">const</span> x = 1</div><div>const y = 2</div></div>',
  })
  await expect(ed.locator('p')).toHaveText(['const x = 1', 'const y = 2'])
  await expect(ed.locator('span[style*="color"]')).toHaveCount(0)
})

test('URL paste: link on an empty selection, links the selected text otherwise', async ({ page }) => {
  const ed = page.locator('.wn-editor')
  await paste(page, { 'text/plain': 'https://example.com/x' })
  await expect(ed.locator('a')).toHaveAttribute('href', 'https://example.com/x')
  await page.keyboard.type(' and here')
  await expect(ed.locator('p')).toHaveText('https://example.com/x and here')
  await expect(ed.locator('a')).toHaveText('https://example.com/x')
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowLeft')
  // wait for the editor (not just the DOM) to have the selection: selectionchange is async
  await expect
    .poll(() =>
      page.evaluate(() => {
        const dom = document.querySelector('.wn-editor') as unknown as {
          editor: {
            state: { selection: { from: number; to: number }; doc: { textBetween: (a: number, b: number) => string } }
          }
        }
        const { from, to } = dom.editor.state.selection
        return dom.editor.state.doc.textBetween(from, to)
      }),
    )
    .toBe('here')
  await paste(page, { 'text/plain': 'https://example.org' })
  await expect(ed.locator('a[href="https://example.org"]')).toHaveText('here')
})
