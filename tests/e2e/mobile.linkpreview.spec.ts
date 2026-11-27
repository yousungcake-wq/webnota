import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('phone: pasted URL offers a preview card in a bottom sheet (ED-B21, ED-F06)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('webnota:worker-url', 'https://worker.test'))
  await page.route('https://worker.test/unfurl**', (r) =>
    r.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ title: '폰 미리보기', description: '', image: null, siteName: 'Example' }),
    }),
  )
  await openApp(page)
  await page.locator('.wn-editor p').first().tap()
  await page.evaluate(() =>
    (
      document.querySelector('.wn-editor') as unknown as { editor: { commands: { focus: (p: string) => void } } }
    ).editor.commands.focus('end'),
  )
  await page.keyboard.press('Enter')
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.setData('text/plain', 'https://example.com/m')
    document
      .querySelector('.wn-editor')!
      .dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
  })
  await expect(page.locator('.sheet')).toBeVisible()
  await page.getByRole('menuitem', { name: '미리보기 카드' }).tap()
  await expect(page.locator('.wn-editor .link-card-title')).toHaveText('폰 미리보기')
})
