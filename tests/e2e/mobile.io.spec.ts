import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'

test('phone: import a Markdown file from settings; export the page from its menu sheet (M8-12)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await page.goto('/#/settings')
  const importBtn = page.locator('[data-io-import]')
  await expect(importBtn).toBeVisible()
  expect((await importBtn.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await expect(page.locator('[data-io-folder]')).toHaveCount(0) // no folder picking on phones
  const chooser = page.waitForEvent('filechooser')
  await importBtn.tap()
  await (
    await chooser
  ).setFiles({ name: '폰 메모.md', mimeType: 'text/markdown', buffer: Buffer.from('# 제목 줄\n\n- [ ] 할 일\n') })
  await expect(page.locator('.page-title')).toHaveValue('폰 메모')
  await expect(page.locator('.wn-editor li[data-checked="false"]')).toContainText('할 일')

  await page.getByLabel('더보기').tap()
  await page.locator('.sheet').getByRole('menuitem', { name: '내보내기' }).tap()
  const dl = page.waitForEvent('download')
  await page.locator('.sheet').getByRole('menuitem', { name: 'Markdown', exact: true }).tap()
  await dl
  check()
})
