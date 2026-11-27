import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

test('sub-page block: /page creates a child, title follows, deleting the block trashes it (ED-B19)', async ({
  page,
}) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  await page.fill('.page-title', '부모')
  const ed = page.locator('.wn-editor')
  await ed.click()
  await page.keyboard.type('/페이지')
  await expect(page.locator('.slash-item.is-selected')).toContainText('페이지')
  await page.keyboard.press('Enter')

  // opens the new child page
  await expect(page.locator('.page-title')).toHaveValue('')
  await page.fill('.page-title', '자식')
  await expect(page.locator('.tree-row', { hasText: '자식' })).toHaveCount(1)
  await page.locator('.tree-row', { hasText: '부모' }).click()
  await expect(page.locator('.page-title')).toHaveValue('부모')
  const block = ed.locator('.sub-page')
  await expect(block).toContainText('자식')

  // click opens it
  await block.getByRole('button', { name: /자식/ }).click()
  await expect(page.locator('.page-title')).toHaveValue('자식')
  await page.goBack()
  await expect(page.locator('.page-title')).toHaveValue('부모')

  // delete the block: the page goes to the trash
  await block.click()
  await page.keyboard.press('Backspace')
  await expect(ed.locator('.sub-page')).toHaveCount(0)
  await expect(page.locator('.tree-row', { hasText: '자식' })).toHaveCount(0)

  // undo brings the block back with a restore button
  await page.keyboard.press('ControlOrMeta+z')
  await expect(ed.locator('.sub-page.is-deleted')).toHaveCount(1)
  await ed.getByRole('button', { name: '휴지통에서 복원' }).click()
  await expect(ed.locator('.sub-page.is-deleted')).toHaveCount(0)
  await expect(page.locator('.tree-row', { hasText: '자식' })).toHaveCount(1)
  check()
})
