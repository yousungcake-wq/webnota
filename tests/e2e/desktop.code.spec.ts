import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

test('code block: language → highlighting (lazy), wrap, copy (ED-B10)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
  await page.keyboard.type('```')
  await page.keyboard.press('Enter')
  await page.keyboard.type('const answer = 42')
  const block = page.locator('.wn-editor .code-block')
  await expect(block).toHaveCount(1)
  await block.getByLabel('코드 언어').selectOption('javascript')
  await expect(block.locator('.hljs-keyword').first()).toHaveText('const')
  await expect(block.locator('.hljs-number')).toHaveText('42')

  await block.hover()
  await block.getByRole('button', { name: '줄 바꿈' }).click()
  await expect(block).toHaveClass(/is-wrapped/)
  await block.getByRole('button', { name: '복사' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('const answer = 42')

  await page.waitForTimeout(300)
  await page.reload()
  await expect(page.locator('.wn-editor .code-block .hljs-keyword').first()).toHaveText('const')
  check()
})
