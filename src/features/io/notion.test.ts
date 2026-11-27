import { describe, expect, it } from 'vitest'
import {
  attachmentsOf,
  linkParents,
  notionTitle,
  planNotionImport,
  resolveRelative,
  rewriteNotionMarkdown,
} from './notion'

const H = '0123456789abcdef0123456789abcdef'

describe('Notion export structure (feedback 11)', () => {
  it('reads titles without the id', () => {
    expect(notionTitle(`Meeting notes ${H}.md`)).toBe('Meeting notes')
    expect(notionTitle(`Tasks ${H}_all.csv`)).toBe('Tasks')
    expect(notionTitle('Plain.md')).toBe('Plain')
  })
  it('builds the page tree from folders; databases prefer _all.csv; rows sit under their database', () => {
    const plan = planNotionImport([
      `Export/Home ${H}.md`,
      `Export/Home ${H}/Child ${H}.md`,
      `Export/Home ${H}/image.png`,
      `Export/Home ${H}/Tasks ${H}.csv`,
      `Export/Home ${H}/Tasks ${H}_all.csv`,
      `Export/Home ${H}/Tasks ${H}/Row one ${H}.md`,
    ])
    expect(plan.map((i) => [i.title, i.kind, i.parent && plan.find((x) => x.path === i.parent)!.title])).toEqual([
      ['Home', 'page', null],
      ['Child', 'page', 'Home'],
      ['Tasks', 'database', 'Home'],
      ['Row one', 'page', 'Tasks'],
    ])
    expect(plan.find((i) => i.kind === 'database')!.path).toBe(`Export/Home ${H}/Tasks ${H}_all.csv`)
  })
  it('resolves relative, URL-encoded links', () => {
    expect(resolveRelative('A/B', 'Child%20page%20x.md')).toBe('A/B/Child page x.md')
    expect(resolveRelative('A/B', '../C.md')).toBe('A/C.md')
    expect(resolveRelative('A', 'https://x.y')).toBeNull()
  })
})

describe('Notion Markdown → editor HTML', () => {
  const ctx = {
    dir: 'Export',
    page: (p: string) => (p === 'Export/Other x.md' ? 'view1' : null),
    file: (p: string) =>
      p === 'Export/Home/pic.png'
        ? 'f'.repeat(64) + '.png'
        : p === 'Export/Home/doc.pdf'
          ? 'd'.repeat(64) + '.pdf'
          : null,
  }
  it('drops the title line, turns page links into mentions and attachments into blocks', () => {
    const md = '# Home\n\nSee [Other](Other%20x.md) now\n\n![a cat](Home/pic.png)\n\n[doc.pdf](Home/doc.pdf)\n'
    expect(attachmentsOf(md, 'Export')).toEqual(['Export/Home/pic.png', 'Export/Home/doc.pdf'])
    const out = rewriteNotionMarkdown(md, 'Home', ctx)
    expect(out).not.toContain('# Home')
    expect(out).toContain('<span data-mention data-kind="page" data-view-id="view1"></span>')
    expect(out).toContain(
      `<figure data-image data-file="${'f'.repeat(64)}.png"><figcaption>a cat</figcaption></figure>`,
    )
    expect(out).toContain(`<div data-file-block data-file="${'d'.repeat(64)}.pdf" data-name="doc.pdf">doc.pdf</div>`)
  })
  it('turns <aside> callouts into callout blocks', () => {
    expect(rewriteNotionMarkdown('<aside>\n💡 Remember this\n</aside>', 'x', ctx)).toBe(
      '<div data-type="callout" data-icon="💡"><p>Remember this</p></div>',
    )
  })
})

describe('Notion exports with other layouts (feedback 2-10)', () => {
  it('finds sub-pages in folders named without the id', () => {
    const plan = planNotionImport([`Home ${H}.md`, `Home/Child ${H}.md`, `Home/Child/Deep ${H}.md`])
    expect(plan.map((i) => [i.title, i.parent && plan.find((x) => x.path === i.parent)!.title])).toEqual([
      ['Home', null],
      ['Child', 'Home'],
      ['Deep', 'Child'],
    ])
  })
  it('flat exports: the page that links to a page on its own line is its parent', () => {
    const files: Record<string, string> = {
      [`Home ${H}.md`]: `# Home\n\nintro [inline](Other%20${H}.md)\n\n[Child](Child%20${H}.md)\n`,
      [`Child ${H}.md`]: `# Child\n\n<aside>\n[Grand](Grand%20${H}.md)\n</aside>\n`,
      [`Grand ${H}.md`]: '# Grand\n',
      [`Other ${H}.md`]: '# Other\n',
    }
    const plan = linkParents(planNotionImport(Object.keys(files)), (p) => files[p]!)
    const parent = (t: string) => {
      const i = plan.find((x) => x.title === t)!
      return i.parent && plan.find((x) => x.path === i.parent)!.title
    }
    expect([parent('Home'), parent('Child'), parent('Grand'), parent('Other')]).toEqual([null, 'Home', 'Child', null])
  })
  it('child page links become sub-page blocks, an <aside> around page links is not a callout', () => {
    const ctx = {
      dir: '',
      page: (p: string) => (p.startsWith('Child') ? 'c1' : null),
      file: () => null,
      child: () => true,
    }
    const out = rewriteNotionMarkdown(`# T\n\n<aside>\n📄 [Child](Child%20${H}.md)\n</aside>\n`, 'T', ctx)
    expect(out.trim()).toBe('<div data-sub-page data-view-id="c1"></div>')
  })
})
