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

/** Opens the app with the `database` flag and the QA database (`seed-db`: 50 rows, every M4 field type). */
export async function openQaDatabase(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('webnota:flags', JSON.stringify({ database: true }))
    localStorage.setItem('webnota:debug', 'seed-db')
  })
  await page.goto('/')
  await expect(page.locator('.dbg-row').first()).toBeVisible()
  await dbLive(page)
}

/** Waits until a database view shows live data, not its read-only first-screen cache (M5-00). */
export async function dbLive(page: Page) {
  await expect(page.locator('.db-view').first()).not.toHaveAttribute('data-preview', /.*/)
}

/** A grid cell by row index (0-based, in view order) and column header name. */
export async function gridCell(page: Page, row: number, column: string) {
  await expect(page.locator('.dbg-hcell').first()).toBeVisible()
  // columns are virtualized: scroll until the header is rendered
  const header = page.locator('.dbg-hcell', { has: page.locator('.dbg-hname', { hasText: new RegExp(`^${column}$`) }) })
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  if (!(await header.count())) {
    await page.locator('.dbg').evaluate((el) => (el.scrollLeft = 0))
    await frame()
  }
  for (let i = 0; i < 20 && !(await header.count()); i++) {
    await page.locator('.dbg').evaluate((el) => (el.scrollLeft += 300))
    await frame()
  }
  const col = await header.getAttribute('aria-colindex')
  // bring the column fully into view, right of the frozen columns
  await header.evaluate((h) => {
    if (h.classList.contains('is-frozen')) return
    const grid = h.closest('.dbg')!
    const frozen = [...grid.querySelectorAll<HTMLElement>('.dbg-hcell.is-frozen')].reduce(
      (n, e) => n + e.offsetWidth,
      0,
    )
    const left = (h as HTMLElement).offsetLeft
    if (left < grid.scrollLeft + frozen || left + (h as HTMLElement).offsetWidth > grid.scrollLeft + grid.clientWidth)
      grid.scrollLeft = left - frozen
  })
  await frame()
  // rows are virtualized too: scroll the row into the rendered window
  if (!(await page.locator(`.dbg-row[aria-rowindex="${row + 2}"]`).count())) {
    await page.locator('.dbg').evaluate((el, row) => {
      const h = el.querySelector<HTMLElement>('.dbg-row')?.offsetHeight ?? 36
      el.scrollTop = Math.max(0, row * h - 40)
    }, row)
    await frame()
  }
  const cell = page.locator(`.dbg-row[aria-rowindex="${row + 2}"] [role="gridcell"][aria-colindex="${col}"]`)
  await cell.scrollIntoViewIfNeeded()
  return cell
}

/** The sidebar "+" (first space): since M5-11 it offers every layout — pick "문서". */
export async function newPageFromSidebar(page: Page) {
  await page.click('.sidebar [data-new-page] >> nth=0')
  await pickDocument(page)
}

/** After a "+" (new view menu, M5-11): choose a document. */
export async function pickDocument(page: Page) {
  await page.getByRole('menuitem', { name: /^(문서|Document)$/ }).click()
}
