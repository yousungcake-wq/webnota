import { expect, test } from '@playwright/test'
import { openApp, waitForNewPage } from './helpers'

test('phone: Aa panel turns blocks into headings, aligns, superscript; link button (MB-21)', async ({ page }) => {
  await openApp(page)
  await page.getByLabel('뒤로').tap()
  await page.click('.fab')
  await waitForNewPage(page)
  await page.locator('.page-title').tap()
  await page.keyboard.type('툴바')
  await page.keyboard.press('Enter')
  const ed = page.locator('.wn-editor')
  await page.keyboard.type('큰 제목')
  await page.getByRole('button', { name: '텍스트 스타일' }).tap()
  await page.getByRole('button', { name: '제목 2', exact: true }).tap()
  await expect(ed.locator('h2')).toHaveText('큰 제목')
  await page.getByRole('button', { name: '가운데', exact: true }).tap()
  await expect(ed.locator('h2')).toHaveAttribute('style', /text-align: center/)
  await page.keyboard.press('End')
  await page.getByRole('button', { name: '위 첨자' }).tap()
  await page.keyboard.type('2')
  await expect(ed.locator('h2 sup')).toHaveText('2')

  // link button asks for an address
  await page.getByRole('button', { name: '텍스트 스타일' }).tap() // close the panel
  await page.keyboard.press('Enter')
  await page.keyboard.type('링크')
  await page.keyboard.press('Shift+Home')
  await page.getByRole('button', { name: '링크', exact: true }).tap()
  const dialog = page.getByRole('dialog', { name: '링크' })
  await dialog.getByLabel('링크 주소').fill('example.com')
  await dialog.getByRole('button', { name: '확인' }).tap()
  await expect(ed.locator('a')).toHaveAttribute('href', 'https://example.com')
})
