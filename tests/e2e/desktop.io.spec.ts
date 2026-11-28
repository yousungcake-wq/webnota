import { expect, test, type Page } from '@playwright/test'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { readFileSync } from 'node:fs'
import { enableDatabase, failOnConsoleErrors, gridCell, openApp, openQaDatabase } from './helpers'

// a 1×1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const H1 = '1f0a2b3c4d5e6f708192a3b4c5d6e7f8'
const H2 = '2a0a2b3c4d5e6f708192a3b4c5d6e7f8'
const H3 = '3b0a2b3c4d5e6f708192a3b4c5d6e7f8'

async function importZip(page: Page, zip: Uint8Array) {
  await page.goto('/#/settings')
  const chooser = page.waitForEvent('filechooser')
  await page.locator('[data-io-import]').click()
  await (await chooser).setFiles({ name: 'export.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) })
}

test('imports a Notion "Markdown & CSV" export: pages, links, images, callouts, databases (feedback 11)', async ({
  page,
}) => {
  await enableDatabase(page)
  await openApp(page)
  const check = failOnConsoleErrors(page)
  const inner = zipSync({
    [`Home ${H1}.md`]: strToU8(
      `# Home\n\nSee [Child](Home%20${H1}/Child%20${H2}.md) here.\n\n![a dot](Home%20${H1}/dot.png)\n\n<aside>\n💡 Remember\n</aside>\n\n- [x] done task\n`,
    ),
    [`Home ${H1}/Child ${H2}.md`]: strToU8('# Child\n\nChild body\n'),
    [`Home ${H1}/dot.png`]: PNG,
    [`Home ${H1}/Tasks ${H3}.csv`]: strToU8('Name,Status\nA,Done\n'),
    [`Home ${H1}/Tasks ${H3}_all.csv`]: strToU8('﻿Name,Status,Count\nA,Done,1\nB,Todo,2\nC,Done,3\n'),
  })
  // Notion wraps the export in an outer zip
  await importZip(page, zipSync({ 'ExportBlock-Part-1.zip': inner }))

  await expect(page.locator('.page-title')).toHaveValue('Home')
  const editor = page.locator('.wn-editor')
  await expect(editor.locator('.mention-title')).toHaveText('Child')
  await expect(editor.locator('.image-figure img')).toBeVisible()
  await expect(editor.locator('.callout')).toContainText('Remember')
  await expect(editor.locator('li[data-checked="true"]')).toContainText('done task')
  await expect(page.locator('.sidebar')).toContainText(/Notion \d{4}-\d\d-\d\d/)

  await editor.locator('.mention-title').click()
  await expect(page.locator('.page-title')).toHaveValue('Child')
  await expect(editor).toContainText('Child body')

  const home = page.locator('.sidebar .tree-row', { hasText: 'Home' }).first()
  if (!(await home.locator('.tree-toggle.is-open').count())) await home.locator('.tree-toggle').click()
  await page.locator('.sidebar .tree-row', { hasText: 'Tasks' }).first().locator('.tree-link').click()
  await expect(page.locator('.dbg-row')).toHaveCount(3)
  await expect(page.locator('.dbg')).toContainText('Todo')
  check()
})

test('export writes Notion Markdown plus webnota.json, and importing it back restores the page (feedback 11)', async ({
  page,
}) => {
  await openApp(page)
  const check = failOnConsoleErrors(page)
  const original = await page.locator('.wn-editor').innerText()
  const title = await page.locator('.page-title').inputValue()

  await page.goto('/#/settings')
  const download = page.waitForEvent('download')
  await page.locator('[data-io-export]').click()
  const file = await (await download).path()
  const zip = new Uint8Array(readFileSync(file))
  const entries = unzipSync(zip)
  const md = Object.keys(entries).find((p) => p.startsWith(title) && p.endsWith('.md'))
  expect(md).toBeTruthy()
  expect(strFromU8(entries[md!]!)).toMatch(new RegExp(`^# ${title}\n`))
  const data = JSON.parse(strFromU8(entries['webnota.json']!)) as { format: string; views: unknown[] }
  expect(data.format).toBe('webnota-export')
  expect(data.views.length).toBeGreaterThan(0)

  await importZip(page, zip)
  await expect(page.locator('.page-title')).toHaveValue(title)
  await expect.poll(() => page.locator('.wn-editor').innerText()).toBe(original)
  check()
})

test('a database survives export → import exactly: fields, rows, view settings (feedback 11)', async ({ page }) => {
  await openQaDatabase(page)
  const check = failOnConsoleErrors(page)
  const headers = await page.locator('.dbg-hname').allInnerTexts()
  const first = await (await gridCell(page, 0, headers[0]!)).innerText()
  const title = await page
    .locator('.page-title, .db-title')
    .first()
    .evaluate((el) => (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : el.textContent))

  await page.goto('/#/settings')
  const download = page.waitForEvent('download')
  await page.locator('[data-io-export]').click()
  const zip = new Uint8Array(readFileSync(await (await download).path()))
  const entries = unzipSync(zip)
  const csv = Object.keys(entries).find((p) => p.endsWith('.csv'))
  expect(csv).toBeTruthy()
  expect(strFromU8(entries[csv!]!).split('\r\n').length).toBeGreaterThan(50)

  await importZip(page, zip)
  const imported = page.locator('.sidebar .tree-row', { hasText: title ?? '' })
  await expect(imported).toHaveCount(2)
  await imported.last().locator('.tree-link').click()
  await expect(page.locator('.dbg-hname').first()).toHaveText(headers[0]!)
  expect(await page.locator('.dbg-hname').allInnerTexts()).toEqual(headers)
  await expect(await gridCell(page, 0, headers[0]!)).toHaveText(first)
  check()
})

test('Notion: relation columns become relations, row bodies become row pages, date ranges (M8-04)', async ({
  page,
}) => {
  await openApp(page)
  const check = failOnConsoleErrors(page)
  const P = '4c0a2b3c4d5e6f708192a3b4c5d6e7f8'
  const R = '5d0a2b3c4d5e6f708192a3b4c5d6e7f8'
  const zip = zipSync({
    [`Home ${H1}.md`]: strToU8(
      `# Home\n\n[Tasks](Home%20${H1}/Tasks%20${H3}.csv)\n\n[People](Home%20${H1}/People%20${P}.csv)\n`,
    ),
    [`Home ${H1}/Tasks ${H3}_all.csv`]: strToU8(
      `Name,Owner,When\nWrite,Kim (People%20${P}/Kim%20${R}.md),"June 1, 2024 → June 3, 2024"\nReview,"Kim (People%20${P}/Kim%20${R}.md), Lee (https://www.notion.so/Lee-1)","June 5, 2024"\n`,
    ),
    [`Home ${H1}/Tasks ${H3}/Write ${R}.md`]: strToU8('# Write\n\nOwner: Kim\n\nRow page body here\n'),
    [`Home ${H1}/Tasks ${H3}/Review ${R}.md`]: strToU8('# Review\n\nOwner: Kim, Lee\n'),
    [`Home ${H1}/People ${P}_all.csv`]: strToU8('Name\nKim\nLee\n'),
  })
  await importZip(page, zip)
  await expect(page.locator('.page-title')).toHaveValue('Home')
  // the row with a body is not a child page any more
  await expect(page.locator('.sidebar .tree-row', { hasText: 'Write' })).toHaveCount(0)
  const home = page.locator('.sidebar .tree-row', { hasText: 'Home' }).first()
  if (!(await home.locator('.tree-toggle.is-open').count())) await home.locator('.tree-toggle').click()
  await page.locator('.sidebar .tree-row', { hasText: 'Tasks' }).first().locator('.tree-link').click()
  await expect(page.locator('.dbg-row')).toHaveCount(2)
  await expect(await gridCell(page, 0, 'Owner')).toContainText('Kim')
  await expect((await gridCell(page, 1, 'Owner')).locator('.db-rel-chip')).toHaveText(['Kim', 'Lee'])
  await expect(await gridCell(page, 0, 'When')).toContainText('→')
  // the row page holds the body
  await page.locator('.dbg-row').first().hover()
  await page.locator('.dbg-row').first().locator('.dbg-open').click()
  const rowPage = page.getByRole('dialog', { name: '행 페이지' })
  await expect(rowPage.locator('.db-rowpage-title')).toHaveValue('Write')
  await expect(rowPage).toContainText('Row page body here')
  await expect(rowPage).not.toContainText('Owner: Kim')
  check()
})
