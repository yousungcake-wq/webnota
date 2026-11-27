import { expect, test, type Page } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

async function newPage(page: Page, title: string) {
  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  await page.fill('.page-title', title)
}
const treeRow = (page: Page, title: string) => page.locator('.sidebar .tree-row', { hasText: title })

test.describe('rename and page menu (WS-03)', () => {
  test('rename inline: double-click and F2; Esc cancels; Enter saves', async ({ page }) => {
    const check = failOnConsoleErrors(page)
    await openApp(page)
    await newPage(page, 'Xray')
    await treeRow(page, 'Xray').locator('.tree-title').dblclick()
    const input = page.locator('.tree-rename')
    await expect(input).toBeFocused()
    await input.fill('Xray 2')
    await input.press('Enter')
    await expect(treeRow(page, 'Xray 2')).toHaveCount(1)
    await expect(page.locator('.page-title')).toHaveValue('Xray 2')

    await page.locator('.tree-link', { hasText: 'Xray 2' }).focus()
    await page.keyboard.press('F2')
    await page.locator('.tree-rename').fill('nope')
    await page.locator('.tree-rename').press('Escape')
    await expect(treeRow(page, 'Xray 2')).toHaveCount(1)
    check()
  })

  test('menu: copy link, lock/unlock, info, rename from the header', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openApp(page)
    await newPage(page, 'Yank')
    await page.locator('.wn-editor').click()
    await page.keyboard.type('hello')

    const more = () => page.locator('.topbar').getByRole('button', { name: '더보기' }).click()
    await more()
    await page.getByRole('menuitem', { name: '링크 복사' }).click()
    await expect(page.getByText('링크를 복사했습니다')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/#\/w\/[\w-]+\/v\/[\w-]+$/)

    await more()
    await page.getByRole('menuitem', { name: '잠그기' }).click()
    await expect(page.locator('.wn-editor')).toHaveAttribute('contenteditable', 'false')
    await expect(page.locator('.page-title')).toHaveAttribute('readonly', '')
    await page.locator('.topbar').getByRole('button', { name: '잠금 해제' }).click()
    await expect(page.locator('.wn-editor')).toHaveAttribute('contenteditable', 'true')

    await more()
    await page.getByRole('menuitem', { name: '정보' }).click()
    const dialog = page.getByRole('dialog', { name: '정보' })
    await expect(dialog).toContainText('글자 수')
    await expect(dialog.locator('dd').last()).toHaveText('5')
    await dialog.getByRole('button', { name: '닫기' }).click()

    await more()
    await page.getByRole('menuitem', { name: '이름 바꾸기' }).click()
    await expect(page.locator('.page-title')).toBeFocused()
  })
})
