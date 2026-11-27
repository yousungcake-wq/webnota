import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

test('table: insert, Tab between cells, menu rows / colors / headers, persists (ED-B16)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  const ed = page.locator('.wn-editor')
  await ed.click()
  await page.keyboard.type('/표')
  await expect(page.locator('.slash-item.is-selected')).toContainText('표')
  await page.keyboard.press('Enter')
  const table = ed.locator('table')
  await expect(table.locator('tr')).toHaveCount(3)
  await expect(table.locator('th')).toHaveCount(3)

  await table.locator('th').first().click()
  await page.keyboard.type('이름')
  await page.keyboard.press('Tab')
  await page.keyboard.type('값')
  await expect(table.locator('th').nth(1)).toHaveText('값')

  const menuButton = page.getByRole('button', { name: '표 메뉴' })
  await table.locator('td').first().click()
  await menuButton.click()
  await page.getByRole('menuitem', { name: '아래에 행 추가' }).click()
  await expect(table.locator('tr')).toHaveCount(4)

  await table.locator('td').first().click()
  await menuButton.click()
  await page.getByRole('menuitem', { name: '셀 배경색' }).click()
  await page.getByRole('menuitem', { name: '파랑' }).click()
  await expect(table.locator('td[data-bg-color="blue"]')).toHaveCount(1)

  await table.locator('td').first().click()
  await menuButton.click()
  await page
    .getByRole('menuitemcheckbox', { name: '머리글 열' })
    .or(page.getByRole('menuitem', { name: '머리글 열' }))
    .click()
  await expect(table.locator('tr').nth(1).locator('th')).toHaveCount(1)

  await page.waitForTimeout(300)
  await page.reload()
  await expect(table.locator('tr')).toHaveCount(4)
  await expect(table.locator('[data-bg-color="blue"]')).toHaveCount(1)
  await expect(table.locator('th').first()).toHaveText('이름')

  await table.locator('td').first().click()
  await menuButton.click()
  await page.getByRole('menuitem', { name: '표 삭제' }).click()
  await expect(table).toHaveCount(0)
  check()
})

test('table position: center, right, full width; persists', async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  const ed = page.locator('.wn-editor')
  await ed.click()
  await page.keyboard.type('/표')
  await page.keyboard.press('Enter')
  const wrapper = ed.locator('.tableWrapper')
  const table = ed.locator('table')
  const setPosition = async (name: string) => {
    await table.locator('td').first().click()
    await page.getByRole('button', { name: '표 메뉴' }).click()
    await page.getByRole('menuitem', { name: '표 위치' }).click()
    await page.getByRole('menuitemcheckbox', { name }).click()
  }
  const boxes = async () => ({ w: (await wrapper.boundingBox())!, t: (await table.boundingBox())! })

  await setPosition('가운데')
  await expect(wrapper).toHaveAttribute('data-layout', 'center')
  let { w, t } = await boxes()
  expect(Math.abs(t.x + t.width / 2 - (w.x + w.width / 2))).toBeLessThan(3)

  await setPosition('오른쪽')
  ;({ w, t } = await boxes())
  expect(Math.abs(t.x + t.width - (w.x + w.width))).toBeLessThan(3)

  await setPosition('전체 채우기')
  ;({ w, t } = await boxes())
  expect(Math.abs(t.width - w.width)).toBeLessThan(3)

  await page.waitForTimeout(300)
  await page.reload()
  await expect(wrapper).toHaveAttribute('data-layout', 'full')
  await setPosition('왼쪽')
  await expect(wrapper).not.toHaveAttribute('data-layout', /.+/)
  ;({ w, t } = await boxes())
  expect(Math.abs(t.x - w.x)).toBeLessThan(3)
})
