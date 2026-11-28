import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, openApp } from './helpers'
import { connectFake, FakeGithub } from './fakeGithub'

test('settings say what a token sign-in can reach; shared spaces need the GitHub App (M9-02)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  const gh = new FakeGithub()
  await gh.install(page)
  await openApp(page)
  await connectFake(page)
  await expect(page.locator('[data-token-kind]')).toContainText('토큰으로 연결했습니다')
  await expect(page.locator('[data-token-kind]')).toContainText('GitHub App')
  check()
})
