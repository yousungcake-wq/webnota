import { expect, test } from '@playwright/test'
import { failOnConsoleErrors } from './helpers'

// WS-03 / spec/10 §2: a 300-page tree renders only the rows on screen.
test('large tree is virtualized and scrolls to the last page', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('wn-test-init')) {
      sessionStorage.setItem('wn-test-init', '1')
      localStorage.setItem('webnota:debug', 'seed-many')
    }
  })
  await page.goto('/')
  const tree = page.locator('.sidebar .tree')
  await expect(tree.locator('.tree-title').first()).toBeVisible()
  const rendered = await tree.locator('[data-row]').count()
  expect(rendered).toBeGreaterThan(10)
  expect(rendered).toBeLessThan(100)

  await page.locator('.sidebar-scroll').evaluate((el) => (el.scrollTop = el.scrollHeight))
  await expect(tree.locator('.tree-title', { hasText: 'Page 280' })).toBeVisible()
  await page.locator('.tree-link', { hasText: 'Page 280' }).click()
  await expect(page.locator('.page-title')).toHaveValue('Page 280')

  // expanding a node inserts its children in place
  await page.locator('.sidebar-scroll').evaluate((el) => (el.scrollTop = 0))
  await page.locator('.tree-row', { hasText: 'Group 000' }).locator('.tree-toggle').click()
  await expect(tree.locator('.tree-title', { hasText: 'Child 001' })).toBeVisible()
  check()
})
