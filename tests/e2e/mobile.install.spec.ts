import { expect, test, type Page } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'

/** Pretends this is the user's third visit. */
async function thirdVisit(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('webnota:visits')) localStorage.setItem('webnota:visits', '2')
  })
}
/** Chrome's install prompt event, with a recorded prompt(). */
const fireInstallPrompt = (page: Page) =>
  page.evaluate(() => {
    const e = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> }
    e.prompt = async () => {
      ;(window as unknown as { __prompted: boolean }).__prompted = true
    }
    e.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(e)
  })

test.describe('install offer (MB-40, M7-09)', () => {
  test('Android: from the third visit a toast offers installing, once; settings has the button', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'iphone', 'Chrome on Android')
    const noErrors = failOnConsoleErrors(page)
    await thirdVisit(page)
    await openApp(page)
    await fireInstallPrompt(page)
    const toast = page.locator('.toast', { hasText: '홈 화면에 설치' })
    await expect(toast).toBeVisible({ timeout: 10000 })
    await toast.getByRole('button', { name: '설치' }).tap()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true)

    // once: the next visit does not offer again; settings shows the installed state
    await page.reload()
    await expect(page.locator('.wn-editor')).toBeVisible()
    await fireInstallPrompt(page)
    await page.waitForTimeout(1500)
    await expect(page.locator('.toast', { hasText: '홈 화면에 설치' })).toHaveCount(0)
    await page.goto('/#/settings')
    await expect(page.getByText('설치됨')).toBeVisible()
    noErrors()
  })

  test('settings: the install button appears when the browser allows it', async ({ page }, info) => {
    test.skip(info.project.name === 'iphone', 'Chrome on Android')
    await openApp(page) // first visit: no offer
    await page.goto('/#/settings')
    await expect(page.getByRole('heading', { name: '앱 설치' })).toBeVisible()
    await expect(page.getByRole('button', { name: '홈 화면에 설치' })).toHaveCount(0)
    await fireInstallPrompt(page)
    await page.getByRole('button', { name: '홈 화면에 설치' }).tap()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true)
    await expect(page.locator('.toast', { hasText: '홈 화면에 설치' })).toHaveCount(0)
  })

  test('iPhone: from the third visit the Add to Home Screen steps, once', async ({ page }, info) => {
    test.skip(info.project.name !== 'iphone', 'iOS Safari')
    const noErrors = failOnConsoleErrors(page)
    await thirdVisit(page)
    await openApp(page)
    const dialog = page.getByRole('alertdialog', { name: '홈 화면에 추가' })
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await expect(dialog.locator('.install-steps li')).toHaveCount(3)
    await dialog.getByRole('button', { name: '알겠어요' }).tap()
    await expect(dialog).toHaveCount(0)
    await page.reload()
    await expect(page.locator('.wn-editor')).toBeVisible()
    await page.waitForTimeout(1500)
    await expect(dialog).toHaveCount(0)
    await page.goto('/#/settings')
    await page.getByRole('button', { name: '설치 방법' }).tap()
    await expect(dialog).toBeVisible()
    noErrors()
  })
})
