import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'
import { connectFake, FakeGithub } from './fakeGithub'

/**
 * Offline (M7-12, spec/10): once the service worker has the app, it starts without a
 * network, edits are kept, and reconnecting syncs them.
 */
test('starts offline from the service worker, edits, and syncs when back online', async ({ page, context }) => {
  test.setTimeout(60000)
  const noErrors = failOnConsoleErrors(page, [/Failed to load resource|net::ERR_INTERNET_DISCONNECTED/])
  const gh = new FakeGithub()
  await gh.install(page)
  await openApp(page)
  await connectFake(page)
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.ready.then(() => true)), { timeout: 20000 })
    .toBe(true)

  await context.setOffline(true)
  await page.goto('/')
  await expect(page.locator('.home-top .sync-badge.is-off')).toBeVisible()
  await page.locator('.tree-row', { hasText: 'WebNota' }).locator('.tree-title').tap()
  await expect(page.locator('.wn-editor')).toBeVisible()
  await page.locator('.wn-editor p').first().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' offline-edit-7k3')

  await context.setOffline(false)
  const has = () => [...gh.blobs.values()].some((b) => b.includes('offline-edit-7k3'))
  await expect.poll(has, { timeout: 20000 }).toBe(true)
  noErrors()
})
