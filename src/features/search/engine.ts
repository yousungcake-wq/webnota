import MiniSearch from 'minisearch'

/**
 * Full-text search core (WS-07): MiniSearch with a tokenizer that splits on whitespace
 * and punctuation and adds Hangul bigrams (a 3-syllable word also yields its 2 bigrams) so Korean words
 * match inside compounds. Runs inside the search worker; pure, so it is unit-tested here.
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

const HANGUL = /\p{Script=Hangul}/u

export function tokenize(text: string): string[] {
  const out: string[] = []
  for (const raw of text.toLowerCase().split(/[\s\p{P}\p{S}]+/u)) {
    if (!raw) continue
    out.push(raw)
    if (HANGUL.test(raw) && raw.length > 2) for (let i = 0; i < raw.length - 1; i++) out.push(raw.slice(i, i + 2))
  }
  return out
}

const OPTIONS = {
  fields: ['title', 'body'],
  tokenize,
  searchOptions: { boost: { title: 3 }, prefix: true, combineWith: 'AND' as const, fuzzy: 0 },
}

interface Saved {
  index: unknown
  bodies: Record<string, string>
}

function snippetOf(body: string, terms: string[]): string {
  const lower = body.toLowerCase()
  let at = -1
  for (const t of terms) {
    const i = lower.indexOf(t)
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
      // Each typed word must match (as a whole token or a prefix); bigrams help inside Korean compounds.
      return mini
        .search(words, {
          tokenize: (s) =>
            s
              .toLowerCase()
              .split(/[\s\p{P}\p{S}]+/u)
              .filter(Boolean),
        })
        .slice(0, limit)
        .map((r) => ({
          id: String(r.id),
          score: r.score,
          terms: r.queryTerms ?? r.terms,
          snippet: snippetOf(bodies[String(r.id)] ?? '', r.queryTerms ?? r.terms),
        }))
    },
    toJSON: (): string => JSON.stringify({ index: mini.toJSON(), bodies } satisfies Saved),
  }
}

export type SearchIndex = ReturnType<typeof createSearch>
