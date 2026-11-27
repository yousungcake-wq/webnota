/**
 * ProseMirror JSON (the editor's schema) → Markdown in the dialect Notion's import reads
 * (feedback 11): GFM tables and task lists, `<aside>` callouts, `$$` math. Pure; the
 * exporter supplies how page links and files are written. What Markdown cannot hold
 * (colors, column layout, toggle state…) is kept losslessly in the export's `webnota.json`.
 */

export interface PMNode {
  type: string
  attrs?: Record<string, unknown>
  content?: PMNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

export interface MarkdownContext {
  /** A page mention / sub-page: its title and relative link (or null when unknown). */
  page(viewId: string): { title: string; href: string } | null
  /** A workspace file (image, attachment) as a relative path in the export, or null. */
  file(fileId: string, name: string): string | null
}

const esc = (s: string) => s.replace(/([\\`*_[\]#|<>])/g, '\\$1')

function inline(nodes: PMNode[] | undefined, ctx: MarkdownContext): string {
  let out = ''
  for (const n of nodes ?? []) {
    if (n.type === 'text') {
      let t = n.text ?? ''
      const marks = n.marks ?? []
      const has = (m: string) => marks.some((x) => x.type === m)
      if (has('code')) t = '`' + t.replace(/`/g, '\\`') + '`'
      else t = esc(t)
      if (has('bold')) t = `**${t}**`
      if (has('italic')) t = `*${t}*`
      if (has('strike')) t = `~~${t}~~`
      if (has('underline')) t = `<u>${t}</u>`
      const link = marks.find((x) => x.type === 'link')
      if (link) t = `[${t}](${String(link.attrs?.href ?? '')})`
      out += t
    } else if (n.type === 'hardBreak') out += '<br>'
    else if (n.type === 'inlineMath') out += `$${String(n.attrs?.latex ?? '')}$`
    else if (n.type === 'mention') {
      const a = n.attrs ?? {}
      if (a.kind === 'date') out += String(a.date ?? '')
      else {
        const p = ctx.page(String(a.viewId ?? ''))
        out += p ? `[${esc(p.title)}](${p.href})` : ''
      }
    } else if (n.content) out += inline(n.content, ctx)
  }
  return out
}

function indent(text: string, by: string): string {
  return text
    .split('\n')
    .map((l) => (l ? by + l : l))
    .join('\n')
}

function quote(text: string): string {
  return text
    .split('\n')
    .map((l) => (l ? `> ${l}` : '>'))
    .join('\n')
}

function blocks(nodes: PMNode[] | undefined, ctx: MarkdownContext): string {
  return (nodes ?? [])
    .map((n) => block(n, ctx))
    .filter((s): s is string => s !== null)
    .join('\n\n')
}

function listItems(n: PMNode, ctx: MarkdownContext, marker: (i: number) => string): string {
  return (n.content ?? [])
    .map((item, i) => {
      const m = marker(i)
      const [first, ...rest] = item.content ?? []
      const head = first ? (block(first, ctx) ?? '') : ''
      const body = rest.length ? '\n' + indent(blocks(rest, ctx), ' '.repeat(m.length)) : ''
      return m + head + body
    })
    .join('\n')
}

function block(n: PMNode, ctx: MarkdownContext): string | null {
  const a = n.attrs ?? {}
  switch (n.type) {
    case 'paragraph':
      return inline(n.content, ctx)
    case 'heading':
      return `${'#'.repeat(Math.min(6, Number(a.level) || 1))} ${inline(n.content, ctx)}`
    case 'blockquote':
      return quote(blocks(n.content, ctx))
    case 'codeBlock': {
      const code = (n.content ?? []).map((t) => t.text ?? '').join('')
      return '```' + String(a.language ?? '') + '\n' + code + '\n```'
    }
    case 'horizontalRule':
      return '---'
    case 'bulletList':
      return listItems(n, ctx, () => '- ')
    case 'orderedList': {
      const start = Number(a.start) || 1
      return listItems(n, ctx, (i) => `${start + i}. `)
    }
    case 'taskList':
      return (n.content ?? [])
        .map((item) => {
          const [first, ...rest] = item.content ?? []
          const box = `- [${item.attrs?.checked ? 'x' : ' '}] `
          const body = rest.length ? '\n' + indent(blocks(rest, ctx), '  ') : ''
          return box + (first ? (block(first, ctx) ?? '') : '') + body
        })
        .join('\n')
    case 'toggle': {
      // Notion exports toggles as list items with nested content; so do we
      const [summary, content] = n.content ?? []
      const head = inline(summary?.content, ctx)
      const body = content ? blocks(content.content, ctx) : ''
      return `- ${head}` + (body ? '\n' + indent(body, '  ') : '')
    }
    case 'callout': {
      // a named icon (`icon:…`) has no Markdown form: Notion gets the default emoji
      const icon = String(a.icon ?? '💡')
      const emoji = icon.startsWith('icon:') ? '💡' : icon
      return `<aside>\n${emoji ? `${emoji} ` : ''}${blocks(n.content, ctx)}\n</aside>`
    }
    case 'image': {
      const src = String(a.src ?? '')
      if (!src) return null
      const caption = String(a.caption ?? '')
      const href = /^https?:/i.test(src) ? src : ctx.file(src, caption || 'image')
      return href ? `![${esc(caption)}](${href})` : null
    }
    case 'file': {
      const id = String(a.fileId ?? '')
      const name = String(a.name ?? 'file')
      const href = id ? ctx.file(id, name) : null
      return href ? `[${esc(name)}](${href})` : esc(name)
    }
    case 'video':
    case 'embed':
    case 'linkPreview': {
      const url = String(a.src ?? a.url ?? '')
      if (!url) return null
      const href = /^https?:/i.test(url) ? url : ctx.file(url, 'video')
      const caption = String(a.caption ?? a.title ?? '')
      return href ? `[${esc(caption || url)}](${href})` : null
    }
    case 'mathBlock':
      return `$$\n${String(a.latex ?? '')}\n$$`
    case 'subPage': {
      const p = ctx.page(String(a.viewId ?? ''))
      return p ? `[${esc(p.title)}](${p.href})` : null
    }
    case 'columns':
      // Markdown has no columns: one after another (the layout survives in webnota.json)
      return blocks(
        (n.content ?? []).flatMap((c) => c.content ?? []),
        ctx,
      )
    case 'table': {
      const rows = (n.content ?? []).map((r) =>
        (r.content ?? []).map((c) => blocks(c.content, ctx).replace(/\n+/g, ' ').replace(/\|/g, '\\|')),
      )
      if (!rows.length) return null
      const width = Math.max(...rows.map((r) => r.length))
      const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`
      return [line(rows[0]!), line(Array<string>(width).fill('---')), ...rows.slice(1).map(line)].join('\n')
    }
    case 'outline':
      return null
    default:
      return n.content ? blocks(n.content, ctx) : null
  }
}

/** A page as Markdown: `# Title` then the body. */
export function pageToMarkdown(title: string, doc: PMNode, ctx: MarkdownContext): string {
  const body = blocks(doc.content, ctx).replace(/\n{3,}/g, '\n\n')
  return `# ${title}\n\n${body}\n`
}
