import { hangulIncludes } from '@/core/text/hangul'
import { useEffect, useMemo, useState } from 'react'
import { useRecent } from '@/core/store/prefs'
import { useAliveViews } from '@/core/store/views'
import { displayTitle } from '@/features/page'
import type { SearchHit } from './engine'

const loadClient = () => import('./client')

/**
 * Results for a search box (WS-07): recent views when empty; otherwise title matches
 * (instant) followed by full-text hits from the worker.
 */
export function useSearch(q: string) {
  const { alive, byId } = useAliveViews()
  const recent = useRecent()
  const [hits, setHits] = useState<{ q: string; hits: SearchHit[] } | null>(null)
  const query = q.trim()

  useEffect(() => {
    if (!query) return
    let stale = false
    const timer = setTimeout(() => {
      void loadClient()
        .then((c) => c.search(query))
        .then((r) => !stale && setHits({ q: query, hits: r }))
    }, 120)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [query])

  const results = useMemo((): SearchHit[] => {
    const aliveIds = new Set(alive.map((p) => p.id))
    if (!query) {
      const list = recent.filter((id) => aliveIds.has(id))
      const ids = list.length ? list : [...alive].sort((a, b) => b.updatedAt - a.updatedAt).map((v) => v.id)
      return ids.slice(0, 30).map((id) => ({ id, score: 0, terms: [], snippet: '' }))
    }
    // While the next search runs, keep the previous full-text hits that still match the
    // query by title or snippet, so typing (e.g. 없 → 없ㅇ → 없음) does not blink (feedback 8).
    const prev = hits?.q === query ? hits.hits : (hits?.hits ?? []).filter((h) => stillMatches(h, query))
    const out = prev.filter((h) => aliveIds.has(h.id))
    const seen = new Set(out.map((h) => h.id))
    const titleHits = alive
      .filter((p) => !seen.has(p.id) && hangulIncludes(displayTitle(p.title), query))
      .map((p) => ({ id: p.id, score: 0, terms: query.split(/\s+/).filter(Boolean), snippet: '' }))
    return [...titleHits, ...out]
  }, [alive, hits, query, recent])

  return { query, results, byId, searched: !query || hits?.q === query }
}

/** A hit from the previous query that the new one probably keeps (snippet or terms match). */
const stillMatches = (h: SearchHit, query: string) =>
  hangulIncludes(h.snippet, query) || h.terms.some((t) => hangulIncludes(t, query) || hangulIncludes(query, t))
