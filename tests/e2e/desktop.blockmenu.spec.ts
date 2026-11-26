import { expect, test, type Page } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

async function openBlockMenu(page: Page, block: ReturnType<Page['locator']>) {
  await block.hover()
  await page.locator('.block-actions .grip').click()
  return page.getByRole('menu', { name: '블록 메뉴' })
}

test('block menu: color, turn into, duplicate, delete, columns (ED-F02, ED-F03)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  const ed = page.locator('.wn-editor')
  await ed.click()
  await page.keyboard.type('첫 블록')
  await page.keyboard.press('Enter')
  await page.keyboard.type('둘째 블록')

  await openBlockMenu(page, ed.locator('p', { hasText: '첫 블록' }))
  await page.getByRole('menuitem', { name: '배경색' }).click()
  await page.getByRole('menuitemcheckbox', { name: '빨강' }).click()
  await expect(ed.locator('p[data-bg-color="red"]')).toHaveText('첫 블록')

  await openBlockMenu(page, ed.locator('p', { hasText: '둘째 블록' }))
  await page.getByRole('menuitem', { name: '블록 바꾸기' }).click()
  await page.getByRole('menuitem', { name: '제목 1', exact: true }).click()
  await expect(ed.locator('h1')).toHaveText('둘째 블록')

  await openBlockMenu(page, ed.locator('h1'))
  await page.getByRole('menuitem', { name: '복제' }).click()
  await expect(ed.locator('h1')).toHaveCount(2)

  await openBlockMenu(page, ed.locator('h1').nth(1))
  await page.getByRole('menuitem', { name: '삭제' }).click()
  await expect(ed.locator('h1')).toHaveCount(1)

  // columns: add one from the block menu, then merge it back
  await ed.locator('h1').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/2단')
  await page.keyboard.press('Enter')
  await expect(ed.locator('.column')).toHaveCount(2)
  await openBlockMenu(page, ed.locator('.columns'))
  await page.getByRole('menuitem', { name: '단 추가' }).click()
  await expect(ed.locator('.column')).toHaveCount(3)
  await openBlockMenu(page, ed.locator('.columns'))
  await page.getByRole('menuitem', { name: '마지막 단 합치기' }).click()
  await expect(ed.locator('.column')).toHaveCount(2)
  check()
})

test('block link: copy, open from elsewhere, the block is scrolled to and flashed (ED-F15)', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openApp(page)
  const ed = page.locator('.wn-editor')
  const target = ed.locator('h2').first()
  await openBlockMenu(page, target)
  await page.getByRole('menuitem', { name: '블록 링크 복사' }).click()
  await expect(page.getByText('블록 링크를 복사했습니다')).toBeVisible()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toMatch(/#\/w\/[^/]+\/v\/[^/]+\/b\/[^/]+$/)

  // paste it into another page as a link and follow it
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await ed.click()
  await page.evaluate((href) => {
    const dt = new DataTransfer()
    dt.setData('text/html', `<a href="${href}">go to block</a>`)
    document
      .querySelector('.wn-editor')!
      .dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
  }, link)
  await ed.locator('a', { hasText: 'go to block' }).click({ modifiers: ['ControlOrMeta'] })
  await expect(page.locator('.page-title')).toHaveValue('WebNota 시작하기')
  await expect(ed.locator('.block-flash')).toHaveCount(1)
  await expect(ed.locator('.block-flash')).toHaveText((await target.textContent()) ?? '')
})
