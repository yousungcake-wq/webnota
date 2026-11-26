import { Search } from 'lucide-react'
import { useState } from 'react'
import { t } from '@/core/i18n'
import { ViewHeader } from '@/ui'
import { ResultItem } from './ResultItem'
import { useSearch } from './useSearch'
import './search.css'

/** Phone search tab (MB-04) and the search route: recent items, then full-text results (WS-07). */
export function SearchView({ autoFocus = true }: { autoFocus?: boolean }) {
  const [q, setQ] = useState('')
  const { query, results, byId, searched } = useSearch(q)
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
        {results.map((h) => (
          <ResultItem key={h.id} hit={h} view={byId.get(h.id)!} byId={byId} />
        ))}
        {query && searched && !results.length && <p className="muted pad">{t('search.noResults')}</p>}
      </div>
    </div>
  )
}
