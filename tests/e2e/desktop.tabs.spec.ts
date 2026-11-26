import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'

// SY-02e: tabs of one browser share edits live; exactly one tab is the sync leader.
test('two tabs: edits appear in the other tab live, and one tab holds the sync lock', async ({ context }) => {
  const a = await context.newPage()
  const checkA = failOnConsoleErrors(a)
  await openApp(a)
  const url = a.url()
  const b = await context.newPage()
  const checkB = failOnConsoleErrors(b)
  await b.goto(url)
  await expect(b.locator('.wn-editor')).toBeVisible()

  await b.locator('.wn-editor p').first().click()
  await b.keyboard.press('Home')
  await b.keyboard.type('탭 B에서 ')
  await expect(a.locator('.wn-editor')).toContainText('탭 B에서 ')

  await a.fill('.page-title', '제목도 공유')
  await expect(b.locator('.page-title')).toHaveValue('제목도 공유')

  const locks = await a.evaluate(async () => {
    const q = await navigator.locks.query()
    const leader = (l: { name?: string }) => l.name?.startsWith('webnota:sync-leader:')
    return { held: q.held?.filter(leader).length, pending: q.pending?.filter(leader).length }
  })
  expect(locks).toEqual({ held: 1, pending: 1 })

  // closing the leader hands the lock over
  await a.close()
  await expect
    .poll(() =>
      b.evaluate(
        async () =>
          (await navigator.locks.query()).held?.filter((l) => l.name?.startsWith('webnota:sync-leader:')).length,
      ),
    )
    .toBe(1)
  checkA()
  checkB()
})
