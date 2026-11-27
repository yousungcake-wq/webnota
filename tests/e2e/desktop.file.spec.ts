import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp, waitForNewPage } from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await page.click('.sidebar-bottom >> text=새 페이지')
  await waitForNewPage(page)
  await page.locator('.wn-editor').click()
})

const pdf = Buffer.from('%PDF-1.4\n% test file\n'.repeat(200))

test('file block: /file → upload, name/size/"waiting to upload", download, survives reload (ED-B14)', async ({
  page,
}) => {
  const check = failOnConsoleErrors(page)
  await page.keyboard.type('/파일')
  await expect(page.locator('.slash-item.is-selected')).toContainText('파일')
  await page.keyboard.press('Enter')
  const chooser = page.waitForEvent('filechooser')
  await page.locator('.file-row.is-empty').getByRole('button', { name: '파일 올리기' }).click()
  await (await chooser).setFiles({ name: 'Q3 report.pdf', mimeType: 'application/pdf', buffer: pdf })

  const row = page.locator('.wn-editor .file-row').first()
  await expect(row.locator('.file-name')).toHaveText('Q3 report.pdf')
  await expect(row.locator('.file-meta')).toContainText('4.1 KB')
  await expect(row.locator('.file-pending')).toContainText('업로드 대기')

  const download = page.waitForEvent('download')
  await row.getByRole('button', { name: '내려받기' }).click()
  const d = await download
  expect(d.suggestedFilename()).toBe('Q3 report.pdf')

  await page.reload()
  await expect(page.locator('.wn-editor .file-name')).toHaveText('Q3 report.pdf')
  check()
})

test('dropping a non-image file makes a file block (ED-F06)', async ({ page }) => {
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['a,b\n1,2\n'], 'data.csv', { type: 'text/csv' }))
    const p = document.querySelector('.wn-editor p') ?? document.querySelector('.wn-editor')!
    const r = p.getBoundingClientRect()
    p.dispatchEvent(
      new DragEvent('drop', {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true,
        clientX: r.left + 2,
        clientY: r.top + 2,
      }),
    )
  })
  await expect(page.locator('.wn-editor .file-name')).toHaveText('data.csv')
  await expect(page.locator('.wn-editor .file-meta')).toContainText('8 B')
})
