import { expect, test, type Page } from '@playwright/test'
import { composeKorean, failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

// M2-21 (MB-26): Korean IME composition in every text-bearing block (CDP composition events).
const KO = ['ㅎ', '하', '한', '한ㄱ', '한그'] as const
const compose = (page: Page) => composeKorean(page, [...KO], '한글')

async function slash(page: Page, query: string) {
  await page.keyboard.type(`/${query}`)
  await expect(page.locator('.slash-item.is-selected')).toContainText(query)
  await page.keyboard.press('Enter')
}

const CASES: { name: string; setup: (page: Page) => Promise<void>; where: string }[] = [
  { name: 'paragraph', setup: async () => {}, where: 'p' },
  { name: 'heading', setup: (p) => p.keyboard.type('# '), where: 'h1' },
  { name: 'bullet list', setup: (p) => p.keyboard.type('- '), where: 'ul li' },
  { name: 'numbered list', setup: (p) => p.keyboard.type('1. '), where: 'ol li' },
  { name: 'to-do', setup: (p) => p.keyboard.type('[] '), where: 'ul[data-type="taskList"] li' },
  { name: 'quote', setup: (p) => p.keyboard.type('" '), where: 'blockquote' },
  { name: 'toggle summary', setup: (p) => p.keyboard.type('> '), where: '.toggle' },
  {
    name: 'toggle content',
    setup: async (p) => {
      await p.keyboard.type('> 접기')
      await p.keyboard.press('Enter')
    },
    where: '.toggle-body',
  },
  { name: 'code block', setup: (p) => p.keyboard.type('``` '), where: 'pre' },
  { name: 'callout', setup: (p) => slash(p, '콜아웃'), where: '.callout' },
  { name: 'table cell', setup: (p) => slash(p, '표'), where: 'table th' },
  { name: 'column', setup: (p) => slash(p, '2열'), where: '.column' },
  {
    name: 'after a mention',
    setup: async (p) => {
      await p.keyboard.type('@오늘')
      await p.keyboard.press('Enter')
    },
    where: 'p',
  },
  {
    name: 'inside bold',
    setup: (p) => p.keyboard.press('ControlOrMeta+b'),
    where: 'p strong',
  },
]

test.describe('Korean IME in every block (MB-26)', () => {
  for (const c of CASES) {
    test(c.name, async ({ page }) => {
      const check = failOnConsoleErrors(page)
      await openApp(page)
      await page.click('.sidebar [data-new-page] >> nth=0')
      await waitForNewPage(page)
      await page.locator('.wn-editor').click()
      await c.setup(page)
      await compose(page)
      await page.keyboard.type(' 입력')
      const target = page.locator('.wn-editor').locator(c.where).first()
      await expect(target).toContainText('한글 입력')
      // no stray jamo or duplicated syllables left behind
      await expect(page.locator('.wn-editor')).not.toContainText('ㅎ')
      await expect(page.locator('.wn-editor')).not.toContainText('한글한글')
      check()
    })
  }
})
