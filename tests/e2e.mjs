// End-to-end smoke test: desktop + Android phone + iPhone emulation.
// Usage: node tests/e2e.mjs [baseUrl] [screenshotDir]
import { createRequire } from 'node:module'
// Uses the pre-installed Playwright (set NODE_PATH to its global node_modules) or a local install.
const { chromium, devices } = createRequire(import.meta.url)('playwright')

const BASE = process.argv[2] || 'http://localhost:4173/'
const SHOTS = process.argv[3] || 'test-results'
const results = []
const ok = (name, cond, extra = '') => {
  results.push({ name, pass: Boolean(cond), extra })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`)
}

const browser = await chromium.launch()

async function run(label, contextOpts, fn) {
  const ctx = await browser.newContext(contextOpts)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  try {
    await fn(page, ctx)
  } catch (e) {
    ok(`${label}: no exception`, false, e.message.split('\n')[0])
  }
  ok(`${label}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

// ---------------- desktop ----------------
await run('desktop', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, async (page) => {
  const t0 = Date.now()
  await page.goto(BASE)
  await page.waitForSelector('.wn-editor')
  ok('desktop: welcome page opens with editor', true, `${Date.now() - t0}ms to editor`)
  ok('desktop: welcome content seeded', (await page.textContent('.wn-editor')).includes('WebNota'))
  ok('desktop: sidebar shows welcome page', (await page.locator('.tree-title').first().textContent()).includes('시작하기'))
  await page.screenshot({ path: `${SHOTS}/desktop-welcome.png` })

  // new page via sidebar
  await page.click('.sidebar-bottom >> text=새 페이지')
  await page.waitForFunction(() => document.querySelector('.page-title')?.value === '')
  await page.fill('.page-title', '회의록 2026')
  await page.keyboard.press('Enter')
  await page.keyboard.type('첫 번째 줄입니다')
  await page.keyboard.press('Enter')
  // slash menu
  await page.keyboard.type('/할')
  await page.waitForSelector('.slash-menu')
  ok('desktop: slash menu filters Korean query', (await page.locator('.slash-item').count()) >= 1)
  await page.keyboard.press('Enter')
  await page.keyboard.type('우유 사기')
  ok('desktop: slash → todo list created', (await page.locator('.wn-editor ul[data-type="taskList"]').count()) === 1)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('# 큰 제목')
  ok('desktop: markdown shortcut "# " makes heading', (await page.locator('.wn-editor h1').count()) === 1)
  ok('desktop: sidebar title updated live', (await page.locator('.tree-title', { hasText: '회의록 2026' }).count()) === 1)

  // block move (Alt+Shift+Up)
  await page.keyboard.press('Alt+Shift+ArrowUp')
  const firstTwo = await page.$$eval('.wn-editor > *', (els) => els.map((e) => e.tagName))
  ok('desktop: Alt+Shift+↑ moves block up', firstTwo[1] === 'H1', firstTwo.join(','))

  // persistence across reload
  await page.waitForTimeout(400)
  await page.reload()
  await page.waitForSelector('.wn-editor')
  const text = await page.textContent('.wn-editor')
  ok('desktop: content persists after reload (IndexedDB)', text.includes('첫 번째 줄입니다') && text.includes('우유 사기'))
  ok('desktop: reopens last page', (await page.inputValue('.page-title')) === '회의록 2026')

  // subpage + trash + restore
  await page.locator('.tree-row', { hasText: '회의록 2026' }).hover()
  const parentUrl = page.url()
  await page.locator('.tree-row', { hasText: '회의록 2026' }).getByLabel('하위 페이지 추가').click()
  await page.waitForURL((u) => u.toString() !== parentUrl)
  await page.waitForFunction(() => document.querySelector('.page-title')?.value === '')
  await page.fill('.page-title', '하위 페이지')
  ok('desktop: subpage nested in tree', (await page.locator('.tree [role=group] .tree-title', { hasText: '하위 페이지' }).count()) === 1)
  ok('desktop: breadcrumbs show parent', (await page.locator('.crumbs').textContent()).includes('회의록 2026'))
  await page.screenshot({ path: `${SHOTS}/desktop-subpage.png` })
  await page.getByLabel('더보기').last().click()
  await page.click('text=휴지통으로 이동')
  await page.goto(BASE + '#/trash')
  ok('desktop: page appears in trash', (await page.locator('.list-title', { hasText: '하위 페이지' }).count()) === 1)
  await page.getByLabel('복원').click()
  ok('desktop: restore from trash', (await page.locator('.list-title', { hasText: '하위 페이지' }).count()) === 0)

  // bubble menu
  await page.locator('.tree-link', { hasText: '회의록 2026' }).click()
  await page.waitForSelector('.wn-editor')
  await page.locator('.wn-editor p', { hasText: '첫 번째 줄입니다' }).dblclick()
  await page.waitForSelector('.bubble', { state: 'visible' })
  await page.screenshot({ path: `${SHOTS}/desktop-bubble.png` })
  await page.getByLabel('굵게').click()
  ok('desktop: bubble menu bold', (await page.locator('.wn-editor strong').count()) >= 1)

  // dark theme + settings
  await page.goto(BASE + '#/settings')
  await page.click('.segmented >> text=다크')
  await page.screenshot({ path: `${SHOTS}/desktop-settings-dark.png` })
  ok('desktop: dark theme applied', (await page.getAttribute('html', 'data-theme')) === 'dark')
})

// ---------------- phones ----------------
for (const [label, device] of [
  ['android', devices['Pixel 7']],
  ['iphone', devices['iPhone 14']],
]) {
  await run(label, { ...device }, async (page) => {
    await page.goto(BASE)
    await page.waitForSelector('.wn-editor')
    ok(`${label}: opens welcome page full-screen`, (await page.locator('.sidebar').count()) === 0)
    await page.screenshot({ path: `${SHOTS}/${label}-page.png` })

    await page.getByLabel('뒤로').click()
    await page.waitForSelector('.tabbar')
    ok(`${label}: home with bottom tabs`, (await page.locator('.tab').count()) === 4)
    await page.screenshot({ path: `${SHOTS}/${label}-home.png` })

    await page.click('.fab')
    await page.waitForURL(/#\/page\//)
    await page.waitForFunction(() => document.querySelector('.page-title')?.value === '')
    await page.locator('.page-title').tap()
    await page.keyboard.type('모바일 메모')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.kb-toolbar')
    ok(`${label}: keyboard toolbar appears when editing`, await page.locator('.kb-toolbar').isVisible())

    // Simulate Korean IME composition (CDP) — Chromium only, used for both phone profiles
    const cdp = await page.context().newCDPSession(page)
    for (const [comp, commit] of [['ㅎ', null], ['하', null], ['한', null], ['한ㄱ', null], ['한그', null], ['한글', '한글']]) {
      if (commit) await cdp.send('Input.insertText', { text: commit })
      else await cdp.send('Input.imeSetComposition', { text: comp, selectionStart: comp.length, selectionEnd: comp.length })
    }
    await page.keyboard.type(' 입력')
    const para = await page.locator('.wn-editor p').first().textContent()
    ok(`${label}: IME composition commits correctly`, para === '한글 입력', JSON.stringify(para))

    // toolbar: block panel → todo
    await page.getByLabel('블록 바꾸기').tap()
    await page.waitForSelector('.kb-panel')
    await page.screenshot({ path: `${SHOTS}/${label}-block-panel.png` })
    await page.locator('.kb-block', { hasText: '할 일 목록' }).tap()
    ok(`${label}: toolbar converts block to todo`, (await page.locator('.wn-editor ul[data-type="taskList"]').count()) === 1)
    ok(`${label}: editor keeps focus after toolbar tap`, await page.evaluate(() => document.activeElement?.classList.contains('wn-editor')))

    await page.keyboard.press('Enter')
    await page.keyboard.type('두 번째')
    await page.getByLabel('들여쓰기').tap()
    ok(`${label}: indent nests list item`, (await page.locator('.wn-editor li li').count()) === 1)
    await page.getByLabel('굵게').tap()
    await page.keyboard.type('굵게')
    ok(`${label}: bold toggle from toolbar`, (await page.locator('.wn-editor strong').count()) === 1)
    await page.getByLabel('실행 취소').tap()
    ok(`${label}: undo works`, (await page.locator('.wn-editor strong').count()) === 0)
    await page.screenshot({ path: `${SHOTS}/${label}-editing.png` })

    // page menu as bottom sheet
    await page.getByLabel('더보기').tap()
    await page.waitForSelector('.sheet')
    ok(`${label}: page menu is a bottom sheet`, await page.locator('.sheet').isVisible())
    await page.screenshot({ path: `${SHOTS}/${label}-sheet.png` })
    await page.locator('.menu-item', { hasText: '즐겨찾기에 추가' }).tap()

    await page.getByLabel('뒤로').tap()
    await page.locator('.tab', { hasText: '즐겨찾기' }).tap()
    await page.waitForSelector('.list-title, .muted.pad')
    ok(`${label}: favorites tab lists page`, (await page.locator('.list-title', { hasText: '모바일 메모' }).count()) === 1, (await page.$$eval('.list-title', (e) => e.map((x) => x.textContent))).join(','))
    await page.locator('.tab', { hasText: '검색' }).tap()
    await page.fill('.search-box input', '모바일')
    ok(`${label}: search finds page`, (await page.locator('.list-title', { hasText: '모바일 메모' }).count()) === 1)
    await page.locator('.tab', { hasText: '설정' }).tap()
    await page.screenshot({ path: `${SHOTS}/${label}-settings.png` })
  })
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
