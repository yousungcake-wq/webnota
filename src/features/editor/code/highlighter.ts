import { createLowlight } from 'lowlight'
import { LANGUAGES } from './languages'

/** Lowlight core (no grammars); grammars register on first use. Lazy chunk. */
const lowlight = createLowlight()
const loading = new Map<string, Promise<boolean>>()

export function ensureLanguage(id: string): Promise<boolean> {
  if (lowlight.registered(id)) return Promise.resolve(true)
  const lang = LANGUAGES.find((l) => l.id === id)
  if (!lang?.load) return Promise.resolve(false)
  let p = loading.get(id)
  if (!p) {
    p = lang
      .load()
      .then((m) => {
        lowlight.register(id, m.default as Parameters<typeof lowlight.register>[1])
        return true
      })
      .catch(() => false)
    loading.set(id, p)
  }
  return p
}

export interface Span {
  from: number
  to: number
  className: string
}

type HastNode = { type: string; value?: string; properties?: { className?: string[] }; children?: HastNode[] }

/** Highlighted class spans (offsets into `code`), or [] if the grammar is not loaded. */
export function highlight(code: string, id: string): Span[] {
  if (!lowlight.registered(id)) return []
  const tree = lowlight.highlight(id, code) as unknown as HastNode
  const out: Span[] = []
  let pos = 0
  const walk = (node: HastNode, classes: string[]) => {
    if (node.type === 'text') {
      const len = node.value?.length ?? 0
      if (classes.length && len) out.push({ from: pos, to: pos + len, className: classes.join(' ') })
      pos += len
      return
    }
    const cls = node.properties?.className ?? []
    for (const c of node.children ?? []) walk(c, [...classes, ...cls])
  }
  walk(tree, [])
  return out
}
