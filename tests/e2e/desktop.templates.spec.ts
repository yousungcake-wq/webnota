import { expect, test } from '@playwright/test'
import { dbLive, failOnConsoleErrors, newPageFromSidebar, openApp, waitForNewPage } from './helpers'

test.describe('templates (M8-09, IO-07)', () => {
  test('new view menu → templates: a meeting page, a project board, a schedule calendar', async ({ page }) => {
    const check = failOnConsoleErrors(page)
    await openApp(page)
    const fromTemplate = async (name: string) => {
      await page.click('.sidebar [data-new-page] >> nth=0')
      await page.getByRole('menuitem', { name: '템플릿' }).click()
      await page.getByRole('menuitem', { name }).click()
    }
    await fromTemplate('📝  회의록')
    await expect(page.locator('.page-title')).toHaveValue('회의록')
    await expect(page.locator('.wn-editor h2').first()).toHaveText('안건')
    await expect(page.locator('.wn-editor li[data-checked="false"]')).toHaveCount(1)

    await fromTemplate('📋  프로젝트 칸반')
    await dbLive(page)
    await expect(page.locator('.dbk-col[data-group]')).toHaveCount(4) // + "no status"
    await expect(page.locator('.dbk-card')).toHaveCount(3)

    await fromTemplate('📅  일정')
    await dbLive(page)
    await expect(page.locator('.dbc')).toBeVisible()
    await expect(page.locator('.dbc').getByText('팀 회의').first()).toBeVisible()
    check()
  })

  test('an empty page offers templates; one fills it, then the strip goes', async ({ page }) => {
    const check = failOnConsoleErrors(page)
    await openApp(page)
    await newPageFromSidebar(page)
    await waitForNewPage(page)
    const strip = page.getByRole('group', { name: '템플릿으로 시작' })
    await expect(strip).toBeVisible()
    await strip.getByRole('button', { name: /일기/ }).click()
    await expect(page.locator('.page-title')).toHaveValue('일기')
    await expect(page.locator('.wn-editor h2').first()).toHaveText('오늘 있었던 일')
    await expect(strip).toHaveCount(0)
    // typing into another empty page hides the strip too
    await newPageFromSidebar(page)
    await waitForNewPage(page)
    await expect(strip).toBeVisible()
    await page.locator('.wn-editor').click()
    await page.keyboard.type('직접 쓰기')
    await expect(strip).toHaveCount(0)
    check()
  })
})
