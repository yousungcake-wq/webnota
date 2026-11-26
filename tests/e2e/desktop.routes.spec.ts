import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('routes: canonical #/w/<ws>/v/<id>; PoC #/page/<id> and foreign workspace ids redirect (M1-17)', async ({
  page,
}) => {
  await openApp(page)
  const url = new URL(page.url())
  const m = /^#\/w\/([\w-]+)\/v\/([\w-]+)$/.exec(url.hash)
  expect(m).not.toBeNull()
  const [, ws, id] = m!

  await page.goto(`/#/page/${id}`)
  await expect(page.locator('.page-title')).toHaveValue('WebNota 시작하기')
  await expect(page).toHaveURL(new RegExp(`#/w/${ws}/v/${id}$`))

  await page.goto(`/#/w/someone-elses-ws/v/${id}`)
  await expect(page.locator('.page-title')).toHaveValue('WebNota 시작하기')
  await expect(page).toHaveURL(new RegExp(`#/w/${ws}/v/${id}$`))
})
