import { expect, test, type Page } from '@playwright/test'
import { failOnConsoleErrors, openApp, reload, waitForNewPage } from './helpers'
import { editorJson } from './media'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
})

const mathNodes = async (page: Page) => {
  const out: { type: string; latex: string }[] = []
  const walk = (n: { type: string; attrs?: Record<string, unknown>; content?: unknown[] }) => {
    if (n.type === 'mathBlock' || n.type === 'inlineMath') out.push({ type: n.type, latex: n.attrs!.latex as string })
    for (const c of (n.content ?? []) as (typeof n)[]) walk(c)
  }
  walk((await editorJson(page)) as never)
  return out
}

test('math block: /math opens the LaTeX editor with a live preview, renders with KaTeX (ED-B15)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await page.keyboard.type('/수식')
  await expect(page.locator('.slash-item.is-selected')).toContainText('수식 블록')
  await page.keyboard.press('Enter')
  const input = page.getByRole('textbox', { name: 'LaTeX 수식' })
  await expect(input).toBeFocused()
  await input.fill('E = mc^2')
  await expect(page.locator('.math-preview .katex')).toBeVisible()
  await input.press('Enter') // a new line in a block formula
  await input.press('ControlOrMeta+Enter')
  await expect(page.locator('.wn-editor .math-block .katex-display')).toBeVisible()
  expect(await mathNodes(page)).toEqual([{ type: 'mathBlock', latex: 'E = mc^2' }])

  await reload(page)
  await expect(page.locator('.wn-editor .math-block .katex-display')).toBeVisible()

  // click to edit; clearing removes the block
  await page.locator('.wn-editor .math-block').click()
  await page.getByRole('textbox', { name: 'LaTeX 수식' }).fill('')
  await page.getByRole('button', { name: '완료' }).click()
  await expect(page.locator('.wn-editor .math-block')).toHaveCount(0)
  check()
})

test('$$ + space makes a math block; $…$ makes inline math, prices stay text (ED-I06)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await page.keyboard.type('$$ ')
  const input = page.getByRole('textbox', { name: 'LaTeX 수식' })
  await expect(input).toBeFocused()
  await input.fill('\\sum_{i=1}^n i')
  await input.press('ControlOrMeta+Enter')
  await expect(page.locator('.wn-editor .math-block .katex')).toBeVisible()

  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.type('원의 넓이는 $\\pi r^2$ 이고 값은 $5 와 $10 입니다')
  await expect(page.locator('.wn-editor .inline-math .katex')).toHaveCount(1)
  expect(await mathNodes(page)).toEqual([
    { type: 'mathBlock', latex: '\\sum_{i=1}^n i' },
    { type: 'inlineMath', latex: '\\pi r^2' },
  ])
  await expect(page.locator('.wn-editor')).toContainText('$5 와 $10 입니다')

  // edit inline math: Enter finishes
  await page.locator('.wn-editor .inline-math .katex-html').click()
  const inline = page.getByRole('textbox', { name: 'LaTeX 수식' })
  await inline.fill('2\\pi r')
  await inline.press('Enter')
  await expect.poll(async () => (await mathNodes(page))[1]?.latex).toBe('2\\pi r')
  check()
})
