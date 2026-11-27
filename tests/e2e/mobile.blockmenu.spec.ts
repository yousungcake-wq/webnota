import { expect, test, type Page } from '@playwright/test'
import { openApp, reload } from './helpers'

async function selectFirstParagraph(page: Page) {
  await page.evaluate(() => {
    const p = document.querySelector('.wn-editor p')!
    const r = document.createRange()
    r.selectNodeContents(p)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(r)
  })
}

test('phone: selection bar above the keyboard toolbar (MB-22)', async ({ page }) => {
  await openApp(page)
  await page.locator('.wn-editor p').first().tap()
  const bar = page.getByRole('toolbar', { name: '선택한 텍스트' })
  await expect(bar).toHaveCount(0)
  await selectFirstParagraph(page)
  await expect(bar).toBeVisible()
  await expect(bar.getByRole('button', { name: '복사' })).toBeVisible()
  await bar.getByRole('button', { name: '굵게' }).tap()
  await expect(page.locator('.wn-editor p').first().locator('strong')).toHaveCount(1)
})

test('phone: block menu from the toolbar and from a long press (MB-23)', async ({ page }) => {
  await openApp(page)
  const ed = page.locator('.wn-editor')
  const count = await ed.locator(':scope > p').count()
  await ed.locator('p').first().tap()
  await page.getByRole('button', { name: '블록 메뉴' }).tap()
  await expect(page.getByRole('dialog', { name: '블록 메뉴' })).toBeVisible()
  await page.getByRole('menuitem', { name: '복제' }).tap()
  await expect(ed.locator(':scope > p')).toHaveCount(count + 1)

  // long press while not typing
  await reload(page)
  await expect(ed.locator('h2').first()).toBeVisible()
  const box = (await ed.locator('h2').first().boundingBox())!
  await page.evaluate(
    ({ x, y }) => {
      const target = document.elementFromPoint(x, y)!
      const opts = { pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true, pointerId: 7 }
      target.dispatchEvent(new PointerEvent('pointerdown', opts))
      return new Promise<void>((done) =>
        setTimeout(() => {
          target.dispatchEvent(new PointerEvent('pointerup', opts))
          done()
        }, 700),
      )
    },
    { x: box.x + 20, y: box.y + box.height / 2 },
  )
  await expect(page.getByRole('dialog', { name: '블록 메뉴' })).toBeVisible()
  await page.getByRole('menuitem', { name: '블록 바꾸기' }).tap()
  await page.getByRole('menuitem', { name: '제목 1', exact: true }).tap()
  await expect(ed.locator('h1')).toHaveCount(1)
})

test('phone: the caret stays above the keyboard toolbar while typing (MB-24)', async ({ page }) => {
  await openApp(page)
  const ed = page.locator('.wn-editor')
  await ed.locator('p').last().tap()
  await page.keyboard.press('End')
  for (let i = 0; i < 25; i++) await page.keyboard.press('Enter')
  await page.keyboard.type('마지막 줄')
  const toolbarTop = (await page.locator('.kb-toolbar').boundingBox())!.y
  await expect
    .poll(async () => (await ed.locator('p', { hasText: '마지막 줄' }).boundingBox())!.y + 20)
    .toBeLessThan(toolbarTop)
})

test('phone: a handle beside the block with the caret, inside the page (feedback 1)', async ({ page }) => {
  await openApp(page)
  const para = page.locator('.wn-editor p').first()
  await para.tap()
  const grip = page.locator('.phone-grip')
  await expect(grip).toBeVisible()
  await expect(grip).toHaveAccessibleName('드래그해서 이동')
  const gb = (await grip.boundingBox())!
  expect(gb.x).toBeGreaterThanOrEqual(0) // fully on screen
  expect(gb.width).toBeGreaterThanOrEqual(28)
  await grip.tap()
  await expect(page.getByRole('menuitem', { name: '복제' })).toBeVisible()
  await expect(page.locator('.wn-editor .block-selected')).toHaveCount(1)
})
