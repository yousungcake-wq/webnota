import { strFromU8, unzipSync } from 'fflate'
import { openDoc, pageDocName, retainDoc } from '@/core/docs/registry'
import { ws } from '@/core/docs/workspace'
import { getFile } from '@/core/files/db'
import { loadFile, mimeFor } from '@/core/files/cache'
import { getView, listViews } from '@/core/model/views'
import { loadDocIO } from '@/features/editor'
import { buildExport } from './exporter'

/**
 * One page out of WebNota (M8-05, M8-06): Markdown — a single `.md`, or a zip when the page
 * has sub-pages, attachments or databases (the same Notion-readable layout as the full
 * export, with `webnota.json`) — and a self-contained HTML file.
 */

const safe = (s: string) =>
  // eslint-disable-next-line no-control-regex -- file names must not hold control characters
  (s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'Untitled').slice(0, 80).replace(/\.+$/, '')

export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Markdown export of a page and what is under it; returns the file name it saved. */
export async function exportMarkdown(viewId: string): Promise<string> {
  const title = getView(ws(), viewId)?.title || 'Untitled'
  const { zip } = await buildExport([viewId])
  const entries = unzipSync(zip)
  const content = Object.keys(entries).filter((p) => p !== 'webnota.json' && !p.startsWith('_files/'))
  if (content.length === 1 && content[0]!.endsWith('.md')) {
    const name = `${safe(title)}.md`
    download(name, strFromU8(entries[content[0]!]!), 'text/markdown;charset=utf-8')
    return name
  }
  const name = `${safe(title)}.zip`
  download(name, zip as BlobPart, 'application/zip')
  return name
}

/** A file's bytes: local copy first, then the repository (through the file cache). */
async function fileBytes(id: string): Promise<Uint8Array | null> {
  const local = (await getFile('cache', id)) ?? (await getFile('pending', id))
  if (local) return local.bytes
  const view = await loadFile(id)
  if (!view.url) return null
  return new Uint8Array(await (await fetch(view.url)).arrayBuffer())
}

const MAX_INLINE = 5 * 1024 * 1024

function dataUri(bytes: Uint8Array, mime: string) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${mime};base64,${btoa(bin)}`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const STYLE = `body{margin:0;background:#fff;color:#1f2328;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Noto Sans KR",sans-serif}
article{max-width:760px;margin:0 auto;padding:48px 24px 96px}h1.page-title{font-size:2.2em;margin:.2em 0 .6em}
img{max-width:100%;height:auto;border-radius:6px}figure{margin:1em 0;text-align:center}figcaption{color:#656d76;font-size:.9em}
pre{background:#f6f8fa;padding:12px 16px;border-radius:8px;overflow:auto}code{font-family:ui-monospace,Menlo,monospace;font-size:.9em}
blockquote{border-left:3px solid #d0d7de;margin:0;padding:0 1em;color:#57606a}table{border-collapse:collapse}td,th{border:1px solid #d0d7de;padding:6px 10px}
[data-callout],.callout{background:#f6f8fa;border-radius:8px;padding:12px 16px;margin:1em 0}
[data-columns]{display:flex;gap:24px}[data-column]{flex:1;min-width:0}
ul[data-type=taskList]{list-style:none;padding-left:4px}li[data-checked=true]>*{color:#8c959f;text-decoration:line-through}
.mention{color:#0969da}.attachment{display:inline-block;padding:6px 10px;border:1px solid #d0d7de;border-radius:6px}
@media(prefers-color-scheme:dark){body{background:#0d1117;color:#e6edf3}pre,[data-callout],.callout{background:#161b22}}`

/**
 * HTML export (M8-06): one file that opens anywhere — images inside as data URIs, files
 * up to 5 MB attached the same way (bigger ones by name), math as MathML (browsers draw it
 * without KaTeX), page mentions and sub-pages as their titles.
 */
export async function pageToHtmlFile(viewId: string): Promise<{ name: string; html: string }> {
  const view = getView(ws(), viewId)
  const title = view?.title || 'Untitled'
  const io = await loadDocIO()
  const name = pageDocName(viewId)
  const release = retainDoc(name)
  let body: string
  try {
    body = io.docToHtml(await openDoc(name))
  } finally {
    release()
  }
  const dom = new DOMParser().parseFromString(`<body>${body}</body>`, 'text/html')
  const titles = new Map(listViews(ws()).map((v) => [v.id, v.title || 'Untitled']))

  for (const fig of dom.querySelectorAll<HTMLElement>('[data-image]')) {
    const src = fig.getAttribute('data-file') ?? ''
    if (!src) continue
    let url = /^https?:/i.test(src) ? src : null
    if (!url) {
      const b = await fileBytes(src)
      if (b) url = dataUri(b, mimeFor(src))
    }
    if (!url) continue
    // the schema's markup already has an <img> (empty src for stored files)
    const img = fig.querySelector('img') ?? fig.insertBefore(dom.createElement('img'), fig.firstChild)
    img.src = url
    const w = fig.getAttribute('data-width')
    if (w) img.style.width = `${w}%`
  }
  for (const el of dom.querySelectorAll<HTMLElement>('[data-file-block]')) {
    const id = el.getAttribute('data-file') ?? ''
    const label = el.getAttribute('data-name') || el.textContent || id
    const b = id ? await fileBytes(id) : null
    const p = dom.createElement('p')
    if (b && b.length <= MAX_INLINE) {
      const a = Object.assign(dom.createElement('a'), {
        href: dataUri(b, mimeFor(id)),
        download: label,
        className: 'attachment',
      })
      a.textContent = `📎 ${label}`
      p.append(a)
    } else p.textContent = `📎 ${label}`
    el.replaceWith(p)
  }
  for (const el of dom.querySelectorAll<HTMLElement>('[data-video], [data-embed], [data-link-preview]')) {
    const url = el.getAttribute('data-src') ?? el.getAttribute('data-url') ?? ''
    const p = dom.createElement('p')
    if (/^https?:/i.test(url)) {
      const a = Object.assign(dom.createElement('a'), { href: url })
      a.textContent = url
      p.append(a)
    }
    el.replaceWith(p)
  }
  for (const el of dom.querySelectorAll<HTMLElement>('[data-mention]')) {
    const id = el.getAttribute('data-view-id')
    const span = Object.assign(dom.createElement('span'), { className: 'mention' })
    span.textContent = id ? `@${titles.get(id) ?? ''}` : el.textContent || ''
    el.replaceWith(span)
  }
  for (const el of dom.querySelectorAll<HTMLElement>('[data-sub-page], [data-database]')) {
    const id = el.getAttribute('data-view-id')
    const p = dom.createElement('p')
    p.textContent = `📄 ${id ? (titles.get(id) ?? '') : ''}`
    el.replaceWith(p)
  }
  const math = [...dom.querySelectorAll<HTMLElement>('[data-math-block], [data-inline-math]')]
  if (math.length) {
    const katex = (await import('katex')).default
    for (const el of math) {
      const block = el.hasAttribute('data-math-block')
      try {
        el.innerHTML = katex.renderToString(el.getAttribute('data-latex') ?? '', {
          output: 'mathml',
          displayMode: block,
          throwOnError: false,
        })
      } catch {
        el.textContent = el.getAttribute('data-latex') ?? ''
      }
    }
  }
  const icon = view?.icon?.type === 'emoji' ? `${view.icon.value} ` : ''
  const lang = document.documentElement.lang || 'ko'
  const html = `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<article>
<h1 class="page-title">${esc(icon + title)}</h1>
${dom.body.innerHTML}
</article>
</body>
</html>
`
  return { name: `${safe(title)}.html`, html }
}

export async function exportHtml(viewId: string): Promise<string> {
  const { name, html } = await pageToHtmlFile(viewId)
  download(name, html, 'text/html;charset=utf-8')
  return name
}
