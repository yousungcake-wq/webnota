import { expect, test } from '@playwright/test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { failOnConsoleErrors, openApp } from './helpers'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('import files (M8-01~03)', () => {
  test('Markdown with front matter, math, a task list and an image; a text file; an HTML file', async ({ page }) => {
    const check = failOnConsoleErrors(page)
    await openApp(page)
    await page.goto('/#/settings')
    const chooser = page.waitForEvent('filechooser')
    await page.locator('[data-io-import]').click()
    await (
      await chooser
    ).setFiles([
      {
        name: 'note.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from(
          '---\ntitle: 회의록\n---\n## 안건\n\n- [ ] 할 일\n\n넓이 $\\pi r^2$, 값 $5 와 $10\n\n$$\nE=mc^2\n$$\n\n![점](dot.png)\n',
        ),
      },
      { name: 'dot.png', mimeType: 'image/png', buffer: PNG },
      { name: '메모.txt', mimeType: 'text/plain', buffer: Buffer.from('첫 줄\n\n둘째 줄\n') },
      {
        name: 'page.html',
        mimeType: 'text/html',
        buffer: Buffer.from(
          '<html><head><title>T</title><script>window.bad=1</script></head><body><h1>웹 문서</h1><p onclick="x()">문단 <a href="https://example.com">링크</a></p><ul><li>하나</li></ul></body></html>',
        ),
      },
    ])
    const tree = page.locator('.sidebar')
    await expect(tree).toContainText(/가져온 파일 \d{4}-\d\d-\d\d/)
    const open = async (title: string) => {
      await page.locator('.sidebar .tree-row', { hasText: title }).first().locator('.tree-link').click()
      await expect(page.locator('.page-title')).toHaveValue(title)
    }
    const editor = page.locator('.wn-editor')
    await open('회의록')
    await expect(editor.locator('h2')).toHaveText('안건')
    await expect(editor.locator('li[data-checked="false"]')).toContainText('할 일')
    await expect(editor.locator('.inline-math .katex')).toHaveCount(1)
    await expect(editor.locator('.math-block .katex')).toHaveCount(1)
    await expect(editor).toContainText('$5 와 $10')
    await expect(editor.locator('.image-figure img')).toBeVisible()
    await expect(editor).not.toContainText('title:')

    await open('메모')
    await expect(editor.locator('p')).toHaveText(['첫 줄', '둘째 줄'])

    await open('page')
    await expect(editor.locator('h1')).toHaveText('웹 문서')
    await expect(editor.locator('a[href="https://example.com"]')).toHaveText('링크')
    await expect(editor.locator('[onclick]')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { bad?: number }).bad)).toBeUndefined()
    check()
  })

  test('a folder keeps its tree: the folder names the space, sub-folders become pages', async ({ page }) => {
    const check = failOnConsoleErrors(page)
    const dir = mkdtempSync(join(tmpdir(), 'wn-md-'))
    const root = join(dir, 'MyNotes')
    mkdirSync(join(root, 'Projects', 'img'), { recursive: true })
    writeFileSync(join(root, 'Home.md'), '# Home\n\n[Alpha](Projects/Alpha.md)\n')
    writeFileSync(join(root, 'Projects', 'Alpha.md'), 'Alpha body\n\n![](img/dot.png)\n')
    writeFileSync(join(root, 'Projects', 'img', 'dot.png'), PNG)
    await openApp(page)
    await page.goto('/#/settings')
    await page.locator('[data-io-folder]').waitFor()
    await page.locator('input[webkitdirectory]').setInputFiles(root)
    const sidebar = page.locator('.sidebar')
    await expect(sidebar.getByText('MyNotes', { exact: true }).first()).toBeVisible()
    const projects = page.locator('.sidebar .tree-row', { hasText: 'Projects' }).first()
    await expect(projects).toBeVisible()
    if (!(await projects.locator('.tree-toggle.is-open').count())) await projects.locator('.tree-toggle').click()
    await page.locator('.sidebar .tree-row', { hasText: 'Alpha' }).first().locator('.tree-link').click()
    await expect(page.locator('.wn-editor')).toContainText('Alpha body')
    await expect(page.locator('.wn-editor .image-figure img')).toBeVisible()
    check()
  })
})

test.describe('import target and stop (M8-11)', () => {
  test('into the current space instead of a new one', async ({ page }) => {
    const check = failOnConsoleErrors(page)
    await openApp(page)
    const spacesBefore = await page.locator('.sidebar .space-section').count()
    await page.goto('/#/settings')
    await page.getByRole('radio', { name: /현재 스페이스/ }).click()
    const chooser = page.waitForEvent('filechooser')
    await page.locator('[data-io-import]').click()
    await (await chooser).setFiles({ name: '여기로.md', mimeType: 'text/markdown', buffer: Buffer.from('본문') })
    await expect(page.locator('.page-title')).toHaveValue('여기로')
    await expect(page.locator('.sidebar')).not.toContainText('가져온 파일')
    expect(await page.locator('.sidebar .space-section').count()).toBe(spacesBefore)
    check()
  })

  test('a long import can be stopped; what was imported stays', async ({ page }) => {
    test.setTimeout(90_000)
    const check = failOnConsoleErrors(page)
    await openApp(page)
    await page.goto('/#/settings')
    const files = Array.from({ length: 300 }, (_, i) => ({
      name: `page-${String(i).padStart(3, '0')}.md`,
      mimeType: 'text/markdown',
      buffer: Buffer.from(`# Page ${i}\n\n${'text '.repeat(200)}\n`),
    }))
    // a slow phone: the import takes long enough to stop it halfway
    const cdp = await page.context().newCDPSession(page)
    const chooser = page.waitForEvent('filechooser')
    await page.locator('[data-io-import]').click()
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 })
    await (await chooser).setFiles(files)
    const stop = page.locator('[data-io-cancel]')
    await stop.click()
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    await expect(page.locator('.toast')).toContainText('멈췄습니다', { timeout: 30_000 })
    await expect(stop).toHaveCount(0)
    check()
  })
})
