import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
})

test('⌘F finds, steps, matches case, replaces one and all; one undo restores (ED-F07)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  const ed = page.locator('.wn-editor')
  await page.keyboard.type('Cat cat')
  await page.keyboard.press('Enter')
  await page.keyboard.type('catalog CAT')
  await page.keyboard.press('ControlOrMeta+f')
  const bar = page.getByRole('search', { name: '찾기' })
  await expect(bar).toBeVisible()
  await bar.getByLabel('찾기').fill('cat')
  await expect(bar.locator('.find-count')).toHaveText('1/4')
  await expect(ed.locator('.find-match')).toHaveCount(4)
  await bar.getByLabel('찾기').press('Enter')
  await expect(bar.locator('.find-count')).toHaveText('2/4')
  await bar.getByRole('button', { name: '대소문자 구분' }).click()
  await expect(ed.locator('.find-match')).toHaveCount(2)

  await bar.getByRole('button', { name: '바꾸기', exact: true }).first().click()
  const replaceInput = bar.getByLabel('바꿀 내용')
  await replaceInput.fill('dog')
  await bar.getByRole('button', { name: '모두 바꾸기' }).click()
  await expect(ed.locator('p').first()).toHaveText('Cat dog')
  await expect(ed.locator('p').nth(1)).toHaveText('dogalog CAT')

  await bar.getByRole('button', { name: '닫기' }).click()
  await expect(bar).toHaveCount(0)
  await expect(ed.locator('.find-match')).toHaveCount(0)
  // closing the bar hands focus back to the editor; undo only after it arrived
  await page.waitForFunction(() => !!document.activeElement?.closest('.wn-editor'))
  await page.keyboard.press('ControlOrMeta+z')
  await expect(ed.locator('p').first()).toHaveText('Cat cat')
  await expect(ed.locator('p').nth(1)).toHaveText('catalog CAT')
  check()
})

test('undo goes back one paragraph at a time (ED-F08)', async ({ page }) => {
  const ed = page.locator('.wn-editor')
  await page.keyboard.type('하나')
  await page.keyboard.press('Enter')
  await page.keyboard.type('둘')
  await page.keyboard.press('Enter')
  await page.keyboard.type('셋')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(ed.locator('p')).toHaveText(['하나', '둘'])
  await page.keyboard.press('ControlOrMeta+z')
  await expect(ed.locator('p')).toHaveText(['하나'])
})
