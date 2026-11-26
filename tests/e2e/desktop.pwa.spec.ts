import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test.describe('PWA (MB-42, MB-44)', () => {
  test('manifest has PNG icons (any + maskable) and shortcuts; apple-touch-icon is a 180 PNG', async ({
    page,
    request,
  }) => {
    await page.goto('/')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    const manifest = await (await request.get(href!)).json()
    const pngs = manifest.icons.filter((i: { type: string }) => i.type === 'image/png')
    expect(pngs.map((i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`)).toEqual([
      '192x192 any',
      '512x512 any',
      '192x192 maskable',
      '512x512 maskable',
    ])
    for (const icon of [...manifest.icons, ...manifest.shortcuts.flatMap((s: { icons: unknown[] }) => s.icons)]) {
      const res = await request.get(icon.src)
      expect(res.status(), icon.src).toBe(200)
    }
    expect(manifest.shortcuts.map((s: { url: string }) => s.url)).toEqual(['/?action=new-page', '/#/search'])
    const apple = page.locator('link[rel="apple-touch-icon"]')
    await expect(apple).toHaveAttribute('sizes', '180x180')
    expect((await request.get((await apple.getAttribute('href'))!)).headers()['content-type']).toContain('image/png')
  })

  test('the "new page" shortcut opens a new empty page and cleans the URL', async ({ page }) => {
    await openApp(page)
    const before = await page.locator('.tree-title').count()
    await page.goto('/?action=new-page')
    await page.waitForURL(/#\/page\//)
    await expect(page.locator('.page-title')).toHaveValue('')
    await expect(page.locator('.tree-title')).toHaveCount(before + 1)
    expect(new URL(page.url()).search).toBe('')
  })
})
