import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { t } from '@/core/i18n'
import { useRecent } from '@/core/store/prefs'
import { href } from '@/core/store/router'
import { useAliveViews } from '@/core/store/views'
import { displayTitle, pathOf, ViewIcon } from '@/features/page'
import { PageListItem } from '@/features/sidebar'
import { ViewHeader } from '@/ui'
import type { SearchHit } from './engine'
import { Highlight } from './Highlight'
import './search.css'

const loadClient = () => import('./client')

/** Phone search tab / desktop search screen (WS-07): recent items, then full-text results. */
export function SearchView({ autoFocus = true }: { autoFocus?: boolean }) {
  const { alive, byId } = useAliveViews()
  const recent = useRecent()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const query = q.trim()

  useEffect(() => {
    if (!query) return
    let stale = false
    const timer = setTimeout(() => {
      void loadClient()
        .then((c) => c.search(query))
        .then((r) => !stale && setHits(r))
    }, 120)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [query])

  const recents = useMemo(() => {
    const ids = new Set(alive.map((p) => p.id))
    const list = recent.filter((id) => ids.has(id)).map((id) => byId.get(id)!)
    return list.length ? list : [...alive].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30)
  }, [alive, byId, recent])
  const results = useMemo(() => {
    if (!query) return []
    const aliveIds = new Set(alive.map((p) => p.id))
    const out = (hits ?? []).filter((h) => aliveIds.has(h.id))
    // Title matches show at once, before the index catches up with a new or renamed page.
    const seen = new Set(out.map((h) => h.id))
    const lower = query.toLowerCase()
    const titleHits = alive
      .filter((p) => !seen.has(p.id) && displayTitle(p.title).toLowerCase().includes(lower))
      .map((p) => ({ id: p.id, score: 0, terms: [lower], snippet: '' }))
    return [...titleHits, ...out]
  }, [alive, hits, query])

  return (
    <div className="view">
      <ViewHeader title={t('common.search')} />
      <label className="search-box">
        <Search size={18} />
        <input
          autoFocus={autoFocus}
          type="search"
          enterKeyHint="search"
          placeholder={t('search.placeholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <div className="section-head">
        <span>{query ? t('search.results', { count: results.length }) : t('search.recent')}</span>
      </div>
      <div className="list">
        {query
          ? results.map((h) => {
              const v = byId.get(h.id)!
              return (
                <a key={h.id} className="list-item" href={href({ name: 'page', id: h.id })}>
                  <span className="tree-icon">
                    <ViewIcon icon={v.icon} size={18} />
                  </span>
                  <span className="list-text">
                    <span className="list-title">
                      <Highlight text={displayTitle(v.title)} terms={h.terms} />
                    </span>
                    {h.snippet ? (
                      <span className="list-sub search-snippet">
                        <Highlight text={h.snippet} terms={h.terms} />
                      </span>
                    ) : (
                      pathOf(v, byId) && <span className="list-sub">{pathOf(v, byId)}</span>
                    )}
                  </span>
                </a>
              )
            })
          : recents.map((p) => <PageListItem key={p.id} page={p} subtitle={pathOf(p, byId) || undefined} />)}
        {query && !results.length && hits && <p className="muted pad">{t('search.noResults')}</p>}
      </div>
    </div>
  )
}
