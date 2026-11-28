import { expect, test } from '@playwright/test'
import { failOnConsoleErrors, newPageFromSidebar, openApp, openQaDatabase, waitForNewPage } from './helpers'
import { connectFake, FakeGithub } from './fakeGithub'
import { pasteOrDropImage } from './media'

test('files upload in the sync commit; "clean up storage" removes only unused ones (SY-04, M3-10)', async ({
  page,
}) => {
  const check = failOnConsoleErrors(page)
  const gh = new FakeGithub()
  await gh.install(page)
  await openApp(page)

  // two pages with one image each
  for (const [title, w] of [
    ['남길 페이지', 40],
    ['지울 페이지', 60],
  ] as const) {
    await newPageFromSidebar(page)
    await waitForNewPage(page)
    await page.fill('.page-title', title)
    await page.locator('.wn-editor').click()
    await pasteOrDropImage(page, 'paste', w, 20)
    await expect(page.locator('.wn-editor .image-frame img')).toHaveAttribute('src', /^blob:/)
  }

  await connectFake(page)
  await expect.poll(() => gh.files().filter((f) => f.startsWith('files/')).length, { timeout: 15000 }).toBe(2)
  const before = gh.files().filter((f) => f.startsWith('files/'))
  // files and the docs that use them arrive in the same commit
  const commit = gh.commits.get(gh.head)!
  expect(commit.message).toMatch(/WebNota sync/)

  // delete one page permanently
  await page.goto('/')
  await page.locator('.tree-row', { hasText: '지울 페이지' }).click()
  await page.locator('.topbar').getByRole('button', { name: '더보기' }).click()
  await page.getByRole('menuitem', { name: '휴지통으로 이동' }).click()
  await page.goto('/#/trash')
  await page.getByRole('button', { name: '휴지통 비우기' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '휴지통 비우기' }).click()

  // clean up
  await page.goto('/#/settings')
  await page.getByRole('button', { name: '저장소 정리' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '정리' }).click()
  await expect(page.getByText('쓰지 않는 파일 1개를 지웠습니다 (남은 파일 1개)')).toBeVisible({ timeout: 15000 })
  const after = gh.files().filter((f) => f.startsWith('files/'))
  expect(after).toHaveLength(1)
  expect(before).toContain(after[0])
  expect(gh.commits.get(gh.head)!.message).toMatch(/cleanup.*remove 1 unused/)

  // the kept page still shows its image
  await page.goto('/')
  await page.locator('.tree-row', { hasText: '남길 페이지' }).click()
  await expect(page.locator('.wn-editor .image-frame img')).toHaveAttribute('src', /^blob:/)
  check()
})

test('another device downloads the image from the repository and caches it (SY-04, M3-02)', async ({
  page,
  browser,
}) => {
  const gh = new FakeGithub()
  await gh.install(page)
  await openApp(page)
  await newPageFromSidebar(page)
  await waitForNewPage(page)
  await page.fill('.page-title', '사진 페이지')
  await page.locator('.wn-editor').click()
  await pasteOrDropImage(page, 'paste', 50, 30)
  await expect(page.locator('.wn-editor .image-frame img')).toHaveAttribute('src', /^blob:/)
  await connectFake(page)
  await expect.poll(() => gh.files().some((f) => f.startsWith('files/')), { timeout: 15000 }).toBe(true)

  // a second device (fresh storage) on the same repository
  const other = await browser.newContext({ locale: 'ko-KR' })
  const p2 = await other.newPage()
  await gh.install(p2)
  await openApp(p2)
  await connectFake(p2)
  await p2.goto('/')
  await p2.locator('.tree-row', { hasText: '사진 페이지' }).click({ timeout: 15000 })
  const img = p2.locator('.wn-editor .image-frame img')
  await expect(img).toHaveAttribute('src', /^blob:/)
  expect(await img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(50)
  await other.close()
})

test('"clean up storage" also removes the page bodies of deleted rows (M6-00)', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  const gh = new FakeGithub()
  await gh.install(page)
  await openQaDatabase(page)
  // a body for the first row
  const first = page.locator('.dbg-row').first()
  await first.hover()
  await first.locator('.dbg-open').click()
  const modal = page.getByRole('dialog', { name: '행 페이지' })
  await modal.locator('.wn-editor').click()
  await page.keyboard.type('지워질 본문')
  await modal.getByRole('button', { name: '닫기' }).click()

  await connectFake(page)
  const bodies = () => gh.files().filter((f) => /^data\/dbs\/[^/]+\/rows\/[^/]+\.yjs$/.test(f))
  await expect.poll(bodies, { timeout: 15000 }).toHaveLength(1)

  // delete the row (its body file stays for undo), then clean up
  await page.locator('.sidebar .tree-link', { hasText: 'QA database' }).click()
  await first.hover()
  await first.locator('.dbg-gbtn.is-grip').click()
  await page.getByRole('menuitem', { name: '삭제' }).click()
  await page.goto('/#/settings')
  await page.getByRole('button', { name: '저장소 정리' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '정리' }).click()
  await expect.poll(bodies, { timeout: 15000 }).toHaveLength(0)
  check()
})
