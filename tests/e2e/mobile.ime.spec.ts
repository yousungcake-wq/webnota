import { expect, test, type Page } from '@playwright/test'
import { composeKorean, openApp, waitForNewPage } from './helpers'

// M2-21 (MB-26): Korean composition on phones in the blocks most used there.
const CASES: { name: string; setup: (page: Page) => Promise<void>; where: string }[] = [
  { name: 'heading', setup: (p) => p.keyboard.type('## '), where: 'h2' },
  { name: 'to-do', setup: (p) => p.keyboard.type('[] '), where: 'ul[data-type="taskList"] li' },
  {
    name: 'toggle content',
    setup: async (p) => {
      await p.keyboard.type('> 접기')
      await p.keyboard.press('Enter')
    },
    where: '.toggle-body',
  },
  {
    name: 'table cell (block panel)',
    setup: async (p) => {
      await p.getByRole('button', { name: '블록 추가' }).tap()
      await p.locator('.kb-panel').getByRole('button', { name: '표', exact: true }).tap()
    },
    where: 'table th',
  },
]

for (const c of CASES) {
  test(`phone IME: ${c.name}`, async ({ page }) => {
    await openApp(page)
    await page.getByLabel('뒤로').tap()
    await page.click('.fab')
    await waitForNewPage(page)
    await page.locator('.page-title').tap()
    await page.keyboard.press('Enter')
    await c.setup(page)
    await composeKorean(page, ['ㅎ', '하', '한', '한ㄱ', '한그'], '한글')
    await page.keyboard.type(' 입력')
    await expect(page.locator('.wn-editor').locator(c.where).first()).toContainText('한글 입력')
    await expect(page.locator('.wn-editor')).not.toContainText('ㅎ')
  })
}
