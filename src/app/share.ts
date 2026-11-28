import { ws } from '@/core/docs/workspace'
import { openDoc, pageDocName } from '@/core/docs/registry'
import { updateView } from '@/core/model/views'
import { loadDocIO } from '@/features/editor'
import { addPage } from '@/features/page'

/** The query the manifest's `share_target` sends (MB-43). */
export const SHARE_PARAMS = ['share-title', 'share-text', 'share-url'] as const

const LINK = /https?:\/\/[^\s<>"]+/

/**
 * Web Share Target (MB-43, M7-11): text or a link shared from another Android app becomes a
 * new page — the shared title (else the first line, else the link's site) as its title,
 * the text as paragraphs and the link as a link. Android apps often put the link inside
 * the text; it is taken out of there.
 */
export async function handleShare(params: URLSearchParams) {
  const sharedTitle = (params.get('share-title') ?? '').trim()
  let text = (params.get('share-text') ?? '').trim()
  let url = (params.get('share-url') ?? '').trim()
  if (!url) url = text.match(LINK)?.[0] ?? ''
  if (url) text = text.replace(url, '').trim()
  if (!/^https?:\/\//.test(url)) url = ''
  if (!sharedTitle && !text && !url) return
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const title = sharedTitle || lines.find(Boolean)?.slice(0, 80) || hostOf(url)
  const id = addPage(null)
  if (!id) return
  updateView(ws(), id, { title })
  const paragraphs = lines.filter(Boolean).map((l) => ({ type: 'paragraph', content: [{ type: 'text', text: l }] }))
  if (url)
    paragraphs.push({
      type: 'paragraph',
      content: [{ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] } as never],
    })
  if (!paragraphs.length) return
  const [doc, { jsonIntoDoc }] = await Promise.all([openDoc(pageDocName(id)), loadDocIO()])
  if (doc.getXmlFragment('default').length === 0) jsonIntoDoc(doc, { type: 'doc', content: paragraphs })
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}
