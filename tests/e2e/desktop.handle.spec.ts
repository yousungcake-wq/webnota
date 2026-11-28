import { expect, test } from '@playwright/test'
import { newPageFromSidebar, openApp, waitForNewPage } from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await newPageFromSidebar(page)
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
  await page.keyboard.type('first')
  await page.keyboard.press('Enter')
  await page.keyboard.type('second')
})

test('hovering the empty area left of a block shows its handle (feedback 2)', async ({ page }) => {
  const second = page.locator('.wn-editor p').nth(1)
  const box = (await second.boundingBox())!
  await page.mouse.move(box.x + 200, box.y - 200) // away
  await page.mouse.move(box.x - 40, box.y + box.height / 2) // left of the text, where the handle sits
  const grip = page.locator('.block-actions .grip')
  await expect(grip).toBeVisible()
  const gb = (await grip.boundingBox())!
  expect(Math.abs(gb.y + gb.height / 2 - (box.y + box.height / 2))).toBeLessThan(14)
})

test('a pressed handle keeps the block highlighted until a click elsewhere (feedback 13)', async ({ page }) => {
  const first = page.locator('.wn-editor p').first()
  await first.hover()
  await page.locator('.block-actions .grip').click()
  await expect(first).toHaveClass(/block-selected/)
  await page.keyboard.press('Escape') // closes the menu; the block stays grabbed
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(first).toHaveClass(/block-selected/)
  await page.mouse.click(10, 400) // outside the editor (sidebar area)
  await expect(first).not.toHaveClass(/block-selected/)
  // clicking into the text also lets go
  await first.hover()
  await page.locator('.block-actions .grip').click()
  await page.keyboard.press('Escape')
  await page.locator('.wn-editor p').nth(1).click()
  await expect(first).not.toHaveClass(/block-selected/)
})

test('narrow window with a mouse: the handle shows beside the second line of a long block too (feedback 2-8)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 600, height: 800 })
  await page.locator('.wn-editor p').nth(1).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' long text that wraps'.repeat(8))
  const para = page.locator('.wn-editor p').nth(1)
  const box = (await para.boundingBox())!
  expect(box.height).toBeGreaterThan(40)
  const ed = (await page.locator('.wn-editor').boundingBox())!
  await page.mouse.move(box.x + 100, box.y - 100)
  await page.mouse.move(ed.x + 10, box.y + box.height - 10) // left of the last line
  await expect(page.locator('.block-actions .grip')).toBeVisible()
})
