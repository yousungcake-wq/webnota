import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
  for (const [i, text] of ['하나', '둘', '셋', '넷'].entries()) {
    if (i) await page.keyboard.press('Enter')
    await page.keyboard.type(text)
  }
})

test('Esc selects the block, Shift+↑ extends, Backspace deletes them (ED-F04)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  const ed = page.locator('.wn-editor')
  await page.keyboard.press('Escape')
  await expect(ed.locator('.block-selected')).toHaveText(['넷'])
  await page.keyboard.press('Shift+ArrowUp')
  await expect(ed.locator('.block-selected')).toHaveText(['셋', '넷'])
  await page.keyboard.press('Backspace')
  await expect(ed.locator('p')).toHaveText(['하나', '둘', ''])
  await expect(ed.locator('.block-selected')).toHaveCount(0)
  // Esc in the slash menu closes the menu instead of selecting
  await page.keyboard.type('/제목')
  await expect(page.locator('.slash-menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.slash-menu')).toHaveCount(0)
  await expect(ed.locator('.block-selected')).toHaveCount(0)
  check()
})

test('drag in the margin selects blocks; the block menu acts on all of them (ED-F04)', async ({ page }) => {
  const ed = page.locator('.wn-editor')
  const first = (await ed.locator('p').nth(0).boundingBox())!
  const third = (await ed.locator('p').nth(2).boundingBox())!
  const body = (await page.locator('.page-body').boundingBox())!
  const x = body.x - 8 // in the margin left of the block handles, outside the text
  await page.mouse.move(x, first.y + first.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, third.y + third.height / 2, { steps: 6 })
  await page.mouse.up()
  await expect(ed.locator('.block-selected')).toHaveText(['하나', '둘', '셋'])

  await ed.locator('p').nth(1).hover()
  await page.locator('.block-actions .grip').click()
  const menu = page.getByRole('menu', { name: '블록 3개' })
  await expect(menu).toBeVisible()
  await page.getByRole('menuitem', { name: '배경색' }).click()
  await page.getByRole('menuitem', { name: '노랑' }).click()
  await expect(ed.locator('p[data-bg-color="yellow"]')).toHaveText(['하나', '둘', '셋'])

  // the change ends block mode but keeps the text selection: Esc selects its blocks again, Esc leaves
  await expect(menu).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.wn-editor'))).toBe(true) // focus is back in the editor (the menu restores it after closing)
  await page.keyboard.press('Escape')
  await expect(ed.locator('.block-selected')).toHaveCount(3)
  await page.keyboard.press('Escape')
  await expect(ed.locator('.block-selected')).toHaveCount(0)
})
