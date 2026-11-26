import { expect, type Page } from '@playwright/test'

/** Opens the app fresh and waits for the seeded welcome page's editor. */
export async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.locator('.wn-editor')).toBeVisible()
}

/** After creating a page, wait until the UI shows the new (empty-titled) page — avoids typing into the old one. */
export async function waitForNewPage(page: Page) {
  await page.waitForURL(/#\/w\/[^/]+\/v\//)
  await page.waitForFunction(() => (document.querySelector('.page-title') as HTMLTextAreaElement | null)?.value === '')
}

/** Types Korean via real IME composition events (CDP), the way mobile keyboards deliver it. */
export async function composeKorean(page: Page, steps: string[], commit: string) {
  const cdp = await page.context().newCDPSession(page)
  for (const s of steps) {
    await cdp.send('Input.imeSetComposition', { text: s, selectionStart: s.length, selectionEnd: s.length })
  }
  await cdp.send('Input.insertText', { text: commit })
}

/** Fails the test on uncaught page errors / console errors. */
export function failOnConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  return () => expect(errors, 'console errors').toEqual([])
}
