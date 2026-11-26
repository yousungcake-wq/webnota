import { expect, test } from '@playwright/test'

// SY-02d / ST-04: sync runs are listed in Settings. GitHub is stubbed (no network in tests).
test('settings shows the sync history, folding repeated failures', async ({ page }) => {
  let calls = 0
  await page.route('https://api.github.com/**', (route) => {
    calls++
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Service Unavailable"}' })
  })
  await page.addInitScript(() => {
    if (sessionStorage.getItem('wn-test-init')) return
    sessionStorage.setItem('wn-test-init', '1')
    localStorage.setItem('webnota:gh-token', 'test-token')
    localStorage.setItem(
      'webnota:account',
      JSON.stringify({ login: 'tester', avatarUrl: '', owner: 'tester', repo: 'webnota-data', branch: 'main' }),
    )
  })
  await page.goto('/')
  await expect(page.locator('.wn-editor')).toBeVisible() // first run opens the welcome page
  await expect.poll(() => calls).toBeGreaterThan(0)
  await page.getByRole('link', { name: '설정' }).click()

  const log = page.locator('.sync-log')
  await log.locator('summary').click()
  await expect(log.locator('li').first()).toContainText('실패: 503 Service Unavailable')

  await page.getByRole('button', { name: '지금 동기화' }).click() // bypasses the backoff
  await expect(log.locator('li').first()).toContainText('(2회)')
  await expect(log.locator('li')).toHaveCount(1)
})
