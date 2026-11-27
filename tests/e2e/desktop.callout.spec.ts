import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, reload, waitForNewPage } from './helpers'

test('callout: slash menu, change icon and color, persists (ED-B09)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
  await page.keyboard.type('/콜아웃')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Important note')
  const callout = page.locator('.wn-editor .callout')
  await expect(callout).toContainText('Important note')
  await expect(callout.locator('.callout-icon')).toHaveText('💡')

  await callout.locator('.callout-icon').click()
  await page.getByRole('radio', { name: '파랑' }).click()
  await expect(callout).toHaveAttribute('data-color', 'blue')
  // no search or random pick in the callout picker (feedback 2-6)
  await callout.locator('.callout-icon').click()
  const picker = page.getByRole('dialog', { name: '콜아웃' })
  await expect(picker.getByRole('searchbox')).toHaveCount(0)
  await expect(picker.getByRole('button', { name: '무작위' })).toHaveCount(0)
  await picker.getByRole('button', { name: '🚀', exact: true }).first().click()
  await expect(callout.locator('.callout-icon')).toHaveText('🚀')

  await page.waitForTimeout(300)
  await reload(page)
  await expect(page.locator('.wn-editor .callout')).toHaveAttribute('data-color', 'blue')
  await expect(page.locator('.wn-editor .callout-icon')).toHaveText('🚀')
  check()
})

test('callout picker: keep open, named icons, clear; the page still scrolls (feedback 2-6)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await page.click('.sidebar [data-new-page] >> nth=0')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
  for (let i = 0; i < 40; i++) await page.keyboard.press('Enter') // a long page
  await page.keyboard.type('/콜아웃')
  await page.keyboard.press('Enter')
  await page.keyboard.type('note')
  const callout = page.locator('.wn-editor .callout')
  const icon = callout.locator('.callout-icon')

  // default: a pick closes the picker
  await icon.click()
  const picker = page.getByRole('dialog', { name: '콜아웃' })
  await picker.getByRole('radio', { name: '초록' }).click()
  await expect(picker).toHaveCount(0)

  // keep open: several picks, it stays
  await icon.click()
  await picker.getByRole('button', { name: '열어 두기' }).click()
  await expect(picker.getByRole('button', { name: '열어 두기' })).toHaveAttribute('aria-pressed', 'true')
  await picker.getByRole('radio', { name: '파랑' }).click()
  await expect(picker.getByRole('radio', { name: '파랑' })).toHaveAttribute('aria-checked', 'true')
  await picker.getByRole('button', { name: '🎉', exact: true }).first().click()
  await expect(icon).toHaveText('🎉')
  await expect(picker).toBeVisible()
  // the wheel over the page scrolls it while the picker is open
  const before = (await callout.boundingBox())!.y
  const pickerBefore = (await picker.boundingBox())!.y
  await page.mouse.move(1150, 400)
  await page.mouse.wheel(0, -300)
  await expect.poll(async () => (await callout.boundingBox())!.y).toBeGreaterThan(before + 100)
  // the picker follows its icon
  await expect.poll(async () => (await picker.boundingBox())!.y).toBeGreaterThan(pickerBefore)
  await icon.scrollIntoViewIfNeeded()

  // a named icon is set (not ignored)
  await picker.getByRole('radio', { name: '아이콘' }).click()
  await picker.getByRole('button', { name: 'rocket' }).click()
  await expect(icon.locator('svg')).toHaveCount(1)
  // clear: no icon
  await picker.getByRole('button', { name: '비우기' }).click()
  await expect(icon).toHaveClass(/is-empty/)
  await expect(icon.locator('svg')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await reload(page)
  await expect(page.locator('.wn-editor .callout-icon')).toHaveClass(/is-empty/)
  await expect(page.locator('.wn-editor .callout')).toHaveAttribute('data-color', 'blue')
  check()
})
