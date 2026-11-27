import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

// Korean-aware search everywhere (es-hangul): 초성, and a syllable still being typed.
test('palette, search screen, @ mention, / menu and emoji understand 초성 and in-progress syllables', async ({
  page,
}) => {
  const check = failOnConsoleErrors(page)
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.fill('.page-title', '사과 메모')
  const ed = page.locator('.wn-editor')
  await ed.click()
  await page.keyboard.type('회의록 정리')
  await page.waitForTimeout(2500) // live re-index is debounced 2 s

  // palette: titles and body
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog', { name: '검색' })
  const input = palette.getByRole('combobox')
  await input.fill('삭')
  await expect(palette.getByRole('option').first()).toContainText('사과 메모')
  await input.fill('ㅅㄱ ㅁㅁ')
  await expect(palette.getByRole('option').first()).toContainText('사과 메모')
  await expect(palette.locator('mark').first()).toHaveText('사과')
  await input.fill('ㅎㅇㄹ')
  await expect(palette.getByRole('option', { name: /사과 메모/ })).toBeVisible() // body match
  await page.keyboard.press('Escape')

  // search screen
  await page.goto('/#/search')
  await page.getByPlaceholder('페이지 제목 검색').fill('회읠')
  await expect(page.getByRole('main').getByRole('link', { name: /사과 메모/ })).toBeVisible()

  // @ mention and / menu inside the editor
  await page.locator('.sidebar .tree-row', { hasText: '사과 메모' }).click()
  await ed.click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('@ㅅㄱ')
  await expect(page.getByRole('listbox', { name: '멘션' }).getByRole('option').first()).toContainText('사과 메모')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/ㅈㅁ')
  await expect(page.locator('.slash-item.is-selected')).toContainText('제목')
  await page.keyboard.press('Escape')
  check()
})
