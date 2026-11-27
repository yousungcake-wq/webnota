import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: math block from the block panel edits in a bottom sheet (ED-B15)', async ({ page }) => {
  await openApp(page)
  await page.locator('.wn-editor p').first().tap()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '블록 추가' }).tap()
  await page.locator('.kb-panel').getByRole('button', { name: '수식 블록', exact: true }).tap()
  await expect(page.locator('.sheet')).toBeVisible()
  await page.getByRole('textbox', { name: 'LaTeX 수식' }).fill('a^2+b^2=c^2')
  const done = page.getByRole('button', { name: '완료' })
  expect((await done.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await done.tap()
  await expect(page.locator('.wn-editor .math-block .katex')).toBeVisible()
})
