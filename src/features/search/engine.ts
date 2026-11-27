import MiniSearch from 'minisearch'
import { matchRange, queryTokens, searchTokens } from '@/core/text/hangul'

/**
 * Full-text search core (WS-07): MiniSearch with Korean-aware tokens (core/text/hangul:
 * jamo of every suffix + 초성), so `삭` finds `사과`, `ㅎㅇㄹ` finds `회의록`, and words match
 * inside compounds. Runs inside the search worker; pure, so it is unit-tested here.
 */
export interface SearchDoc {
  id: string
  title: string
  body: string
}

export interface SearchHit {
  id: string
  score: number
  /** Query terms that matched (for highlighting). */
  terms: string[]
  /** A short piece of the body around the first match, or ''. */
  snippet: string
}

/** Bumped when the tokens change: an index saved in another format is rebuilt. */
export const INDEX_FORMAT = 2

export const tokenize = searchTokens

const OPTIONS = {
  fields: ['title', 'body'],
  tokenize,
  searchOptions: { boost: { title: 3 }, prefix: true, combineWith: 'AND' as const, fuzzy: 0 },
}

interface Saved {
  format?: number
  index: unknown
  bodies: Record<string, string>
}

function snippetOf(body: string, words: string[]): string {
  let at = -1
  for (const w of words) {
    const i = matchRange(body, w)?.[0] ?? -1
    if (i >= 0 && (at < 0 || i < at)) at = i
  }
  if (at < 0) return ''
  const start = Math.max(0, at - 30)
  const end = Math.min(body.length, at + 90)
  return (start > 0 ? '…' : '') + body.slice(start, end).replace(/\s+/g, ' ') + (end < body.length ? '…' : '')
}

export function createSearch(saved?: string) {
  let mini: MiniSearch<SearchDoc>
  let bodies: Record<string, string> = {}
  if (saved) {
    const data = JSON.parse(saved) as Saved
    if (data.format !== INDEX_FORMAT) throw new Error('search index format changed')
    mini = MiniSearch.loadJS(data.index as Parameters<typeof MiniSearch.loadJS>[0], OPTIONS)
    bodies = data.bodies
  } else mini = new MiniSearch<SearchDoc>(OPTIONS)

  return {
    has: (id: string) => mini.has(id),
    upsert(doc: SearchDoc) {
      if (mini.has(doc.id)) mini.discard(doc.id)
      mini.add(doc)
      bodies[doc.id] = doc.body
    },
    remove(id: string) {
      if (mini.has(id)) mini.discard(id)
      delete bodies[id]
    },
    ids: () => Object.keys(bodies),
    query(q: string, limit = 50): SearchHit[] {
      const words = q.trim()
      if (!words) return []
      // Each typed word must match as a prefix of some token (jamo / 초성 for Korean).
      const typed = words
        .toLowerCase()
        .split(/[\s\p{P}\p{S}]+/u)
        .filter(Boolean)
      return mini
        .search(words, { tokenize: queryTokens })
        .slice(0, limit)
        .map((r) => ({
          id: String(r.id),
          score: r.score,
          terms: typed, // highlighted with the same Korean-aware matching
          snippet: snippetOf(bodies[String(r.id)] ?? '', typed),
        }))
    },
    toJSON: (): string => JSON.stringify({ format: INDEX_FORMAT, index: mini.toJSON(), bodies } satisfies Saved),
  }
}

export type SearchIndex = ReturnType<typeof createSearch>
