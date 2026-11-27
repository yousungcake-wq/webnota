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

/**
 * Reloads after the app's IndexedDB writes are committed. y-indexeddb starts a write per
 * update; a reload a few ms later can abort it (seen on slow CI machines). A read-only
 * transaction on the same store starts only after earlier read-write ones finish.
 */
export async function reload(page: Page) {
  await page.evaluate(async () => {
    const dbs = ((await indexedDB.databases?.()) ?? []).filter((d) => d.name?.startsWith('wn:'))
    await Promise.all(
      dbs.map(
        (d) =>
          new Promise<void>((resolve) => {
            const req = indexedDB.open(d.name!)
            req.onerror = () => resolve()
            req.onsuccess = () => {
              const db = req.result
              const done = () => {
                db.close()
                resolve()
              }
              if (!db.objectStoreNames.contains('updates')) return done()
              const tx = db.transaction('updates', 'readonly')
              tx.objectStore('updates').count()
              tx.oncomplete = done
              tx.onerror = done
              tx.onabort = done
            }
          }),
      ),
    )
  })
  await page.reload()
}

/** Turns on the `database` feature flag (M4–M5) before the app boots. */
export async function enableDatabase(page: Page) {
  await page.addInitScript(() => localStorage.setItem('webnota:flags', JSON.stringify({ database: true })))
}
