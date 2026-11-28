import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, newPageFromSidebar, openApp, reload, waitForNewPage } from './helpers'

test('text and background color from the format bubble, kept after reload (ED-I03)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await newPageFromSidebar(page)
  await waitForNewPage(page)
  const ed = page.locator('.wn-editor')
  await ed.click()
  await page.keyboard.type('paint me')
  await page.keyboard.press('Shift+Home')
  await page.locator('.bubble').getByRole('button', { name: '색상' }).click()
  await page.getByRole('radiogroup', { name: '글자 색' }).getByRole('radio', { name: '빨강' }).click()
  await expect(ed.locator('span[data-text-color="red"]')).toHaveText('paint me')

  await page.keyboard.press('Shift+Home')
  await page.locator('.bubble').getByRole('button', { name: '색상' }).click()
  const bg = page.getByRole('radiogroup', { name: '배경색' })
  await expect(page.getByRole('radiogroup', { name: '글자 색' }).getByRole('radio', { name: '빨강' })).toBeChecked()
  await bg.getByRole('radio', { name: '파랑' }).click()
  await expect(ed.locator('mark[data-bg-color="blue"]')).toHaveText('paint me')

  await page.waitForTimeout(300)
  await reload(page)
  await expect(ed.locator('span[data-text-color="red"]')).toHaveText('paint me')
  await expect(ed.locator('mark[data-bg-color="blue"]')).toHaveText('paint me')

  // default removes the color
  await ed.locator('p').first().click()
  await page.keyboard.press('End')
  await page.keyboard.press('Shift+Home')
  await page.locator('.bubble').getByRole('button', { name: '색상' }).click()
  await page.getByRole('radiogroup', { name: '글자 색' }).getByRole('radio', { name: '기본 색' }).click()
  await expect(ed.locator('span[data-text-color]')).toHaveCount(0)
  check()
})

test('pasted HTML keeps real colors but drops black/gray inline colors', async ({ page }) => {
  await openApp(page)
  await newPageFromSidebar(page)
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.setData(
      'text/html',
      '<p><span style="color: rgb(0,0,0)">plain</span> <span style="color: rgb(220,30,30)">red</span> <span style="background-color:#fbecdd">bg</span></p>',
    )
    document
      .querySelector('.wn-editor')!
      .dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
  })
  const ed = page.locator('.wn-editor')
  await expect(ed.locator('span[style*="color"]')).toHaveText('red')
  await expect(ed.locator('mark')).toHaveText('bg')
  await expect(ed).toContainText('plain')
  await expect(ed.locator('span', { hasText: 'plain' })).toHaveCount(0)
})
