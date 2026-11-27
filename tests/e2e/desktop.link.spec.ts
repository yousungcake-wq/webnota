import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

test('links: add from the bubble, popover on the link to edit / remove (ED-I02)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  const ed = page.locator('.wn-editor')
  await ed.click()
  await page.keyboard.type('visit site now')
  await ed
    .locator('p')
    .first()
    .dblclick({ position: { x: 45, y: 10 } }) // select "site"
  await page.locator('.bubble').getByRole('button', { name: '링크' }).click()
  const dialog = page.getByRole('dialog', { name: '링크' })
  await dialog.getByLabel('링크 주소').fill('example.com')
  await dialog.getByRole('button', { name: '확인' }).click()
  await expect(ed.locator('a')).toHaveAttribute('href', 'https://example.com')

  await page.keyboard.press('End')
  await page.waitForTimeout(500) // not a triple click
  await ed.locator('a').click()
  const bubble = page.locator('.link-bubble')
  await expect(bubble.locator('.link-href')).toHaveText('https://example.com')
  await bubble.getByRole('button', { name: '링크 수정' }).click()
  await bubble.getByLabel('링크 주소').fill('https://example.org')
  await bubble.getByLabel('링크 주소').press('Enter')
  await expect(ed.locator('a')).toHaveAttribute('href', 'https://example.org')

  await page.waitForTimeout(500) // not a double click
  await ed.locator('a').click()
  await bubble.getByRole('button', { name: '링크 제거' }).click()
  await expect(ed.locator('a')).toHaveCount(0)
  check()
})

test('after adding a link to a selection, typing continues after the link (not replacing it)', async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  const ed = page.locator('.wn-editor')
  await ed.click()
  await page.keyboard.type('visit site now')
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft')
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowLeft') // "site"
  await page.locator('.bubble').getByRole('button', { name: '링크' }).click()
  const dialog = page.getByRole('dialog', { name: '링크' })
  await dialog.getByLabel('링크 주소').fill('example.com')
  await dialog.getByRole('button', { name: '확인' }).click()
  await expect(ed.locator('a')).toHaveText('site')
  await page.keyboard.type('!')
  await expect(ed.locator('p')).toHaveText('visit site! now')
  await expect(ed.locator('a')).toHaveText('site') // "!" is not part of the link
})
