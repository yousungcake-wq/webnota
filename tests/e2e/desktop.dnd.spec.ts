import { expect, test, type Page } from '@playwright/test'
import { failOnConsoleErrors, newPageFromSidebar, openApp, reload, waitForNewPage } from './helpers'

async function newPage(page: Page, title: string) {
  await newPageFromSidebar(page)
  await waitForNewPage(page)
  await page.fill('.page-title', title)
}

const titles = (page: Page) => page.locator('.sidebar .tree .tree-title')
const row = (page: Page, title: string) => page.locator('.sidebar .tree-row', { hasText: title })

async function drag(page: Page, from: string, to: string, where: 'before' | 'inside' | 'after') {
  const a = (await row(page, from).boundingBox())!
  const b = (await row(page, to).boundingBox())!
  const y = where === 'before' ? b.y + 3 : where === 'after' ? b.y + b.height - 3 : b.y + b.height / 2
  await page.mouse.move(a.x + 60, a.y + a.height / 2)
  await page.waitForTimeout(200) // hovering preloads the drag module
  await page.mouse.down()
  await page.mouse.move(a.x + 60, a.y + a.height / 2 + 10, { steps: 3 })
  await page.mouse.move(b.x + 60, y, { steps: 8 })
  await page.mouse.up()
}

test.describe('tree drag & drop (WS-03)', () => {
  test('reorder, nest and un-nest with the mouse; Esc cancels', async ({ page }) => {
    const check = failOnConsoleErrors(page)
    await openApp(page)
    for (const t of ['Xray', 'Yank', 'Zulu']) await newPage(page, t)
    await expect(titles(page)).toHaveText(['WebNota 시작하기', 'Xray', 'Yank', 'Zulu'])

    await drag(page, 'Zulu', 'Xray', 'before')
    await expect(titles(page)).toHaveText(['WebNota 시작하기', 'Zulu', 'Xray', 'Yank'])
    await expect(page.locator('.page-title')).toHaveValue('Zulu') // drag did not navigate

    await drag(page, 'Yank', 'Xray', 'inside')
    await expect(page.locator('.sidebar .tree [aria-level="2"] .tree-title')).toHaveText(['Yank'])

    await drag(page, 'Yank', 'Zulu', 'before')
    await expect(titles(page)).toHaveText(['WebNota 시작하기', 'Yank', 'Zulu', 'Xray'])

    // Escape cancels a drag in progress
    const a = (await row(page, 'Xray').boundingBox())!
    await page.mouse.move(a.x + 60, a.y + 10)
    await page.mouse.down()
    await page.mouse.move(a.x + 60, a.y - 80, { steps: 5 })
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect(titles(page)).toHaveText(['WebNota 시작하기', 'Yank', 'Zulu', 'Xray'])

    await reload(page)
    await expect(titles(page)).toHaveText(['WebNota 시작하기', 'Yank', 'Zulu', 'Xray'])
    check()
  })

  test('keyboard: Alt+Shift+arrows move the focused row', async ({ page }) => {
    await openApp(page)
    for (const t of ['Xray', 'Yank']) await newPage(page, t)
    await page.locator('.tree-link', { hasText: 'Yank' }).focus()
    await page.keyboard.press('Alt+Shift+ArrowUp')
    await expect(titles(page)).toHaveText(['WebNota 시작하기', 'Yank', 'Xray'])
    await page.keyboard.press('Alt+Shift+ArrowRight') // into the welcome page
    await expect(page.locator('.sidebar .tree [aria-level="2"] .tree-title')).toHaveText(['Yank'])
    await page.keyboard.press('Alt+Shift+ArrowLeft')
    await expect(titles(page)).toHaveText(['WebNota 시작하기', 'Yank', 'Xray'])
  })
})
