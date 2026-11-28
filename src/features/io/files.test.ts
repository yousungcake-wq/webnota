import { describe, expect, it, vi } from 'vitest'

vi.mock('@/core/docs/database', () => ({}))
vi.mock('@/core/docs/registry', () => ({}))
vi.mock('@/core/docs/workspace', () => ({}))
vi.mock('@/core/files/ingest', () => ({}))
vi.mock('@/features/editor', () => ({}))
vi.mock('./i18n', () => ({ it: (k: string) => k }))

const { decodeText, folderPages, frontMatter, textToHtml } = await import('./importer')
const { FILE_PAGES, planNotionImport } = await import('./notion')

const enc = (s: string) => new TextEncoder().encode(s)

describe('file import helpers (M8-01~03)', () => {
  it('front matter: title out, body without it', () => {
    expect(frontMatter('---\ntitle: "회의록"\ntags: [a]\n---\n# 본문\n')).toEqual({ title: '회의록', body: '# 본문\n' })
    expect(frontMatter('# no front matter')).toEqual({ title: null, body: '# no front matter' })
  })

  it('text: a paragraph per line, escaped, empty lines dropped', () => {
    expect(textToHtml('첫 줄\n\n<둘째> & 셋\r\n')).toBe('<p>첫 줄</p><p>&lt;둘째&gt; &amp; 셋</p>')
  })

  it('decodes UTF-8 and falls back to EUC-KR', () => {
    expect(decodeText(enc('﻿한글'))).toBe('한글')
    // "한글" in EUC-KR
    expect(decodeText(new Uint8Array([0xc7, 0xd1, 0xb1, 0xdb]))).toBe('한글')
  })

  it('a picked folder: its name for the space, empty pages for folders without one', () => {
    const files = new Map([
      ['Notes/Home.md', enc('# Home')],
      ['Notes/Projects/A.md', enc('a')],
      ['Notes/Projects/img/x.png', enc('png')],
      ['Notes/Journal.txt', enc('day')],
    ])
    const { root, files: out } = folderPages(files)
    expect(root).toBe('Notes')
    expect([...out.keys()].sort()).toEqual([
      'Home.md',
      'Journal.txt',
      'Projects.md',
      'Projects/A.md',
      'Projects/img/x.png',
    ])
    const plan = planNotionImport([...out.keys()], FILE_PAGES)
    expect(plan.map((p) => [p.path, p.title, p.parent])).toEqual([
      ['Home.md', 'Home', null],
      ['Journal.txt', 'Journal', null],
      ['Projects.md', 'Projects', null],
      ['Projects/A.md', 'A', 'Projects.md'],
    ])
  })

  it('loose files keep no root', () => {
    expect(
      folderPages(
        new Map([
          ['a.md', enc('')],
          ['b.html', enc('')],
        ]),
      ).root,
    ).toBeNull()
  })
})
