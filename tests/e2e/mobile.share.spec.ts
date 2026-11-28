import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'

test.describe('share target (MB-43, M7-11)', () => {
  test('text with a link shared from another app becomes a new page', async ({ page }) => {
    const noErrors = failOnConsoleErrors(page)
    await openApp(page)
    const q = new URLSearchParams({
      'share-title': '읽을 글',
      'share-text': '나중에 읽기\n좋은 글 https://example.com/post?id=1',
    })
    await page.goto(`/?${q}`)
    await expect(page.locator('.page-title')).toHaveValue('읽을 글')
    const editor = page.locator('.wn-editor')
    await expect(editor.locator('p').nth(0)).toHaveText('나중에 읽기')
    await expect(editor.locator('p').nth(1)).toHaveText('좋은 글')
    await expect(editor.locator('a[href="https://example.com/post?id=1"]')).toHaveText('https://example.com/post?id=1')
    expect(page.url()).not.toContain('share-')
    noErrors()
  })

  test('only a link: the site is the title', async ({ page }) => {
    await openApp(page)
    await page.goto(`/?${new URLSearchParams({ 'share-url': 'https://example.org/a' })}`)
    await expect(page.locator('.page-title')).toHaveValue('example.org')
    await expect(page.locator('.wn-editor a[href="https://example.org/a"]')).toBeVisible()
  })

  test('the manifest declares the share target', async ({ page }) => {
    const res = await page.request.get('/manifest.webmanifest')
    const m = (await res.json()) as { share_target?: { params: Record<string, string> } }
    expect(m.share_target?.params).toEqual({ title: 'share-title', text: 'share-text', url: 'share-url' })
  })
})
