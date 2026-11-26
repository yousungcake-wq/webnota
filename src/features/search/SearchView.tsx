import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { displayTitle, pathOf } from '@/features/page'
import { useAlivePages } from '@/core/store/pages'
import { PageListItem } from '@/features/sidebar'
import { ViewHeader } from '@/ui'
import './search.css'
import { t } from '@/core/i18n'

export function SearchView({ autoFocus = true }: { autoFocus?: boolean }) {
  const { alive, byId } = useAlivePages()
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = s ? alive.filter((p) => displayTitle(p.title).toLowerCase().includes(s)) : alive
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50)
  }, [alive, q])
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
        <span>{q.trim() ? t('search.results', { count: results.length }) : t('search.recent')}</span>
      </div>
      <div className="list">
        {results.map((p) => (
          <PageListItem key={p.id} page={p} subtitle={pathOf(p, byId) || undefined} />
        ))}
        {!results.length && <p className="muted pad">{t('search.noResults')}</p>}
      </div>
    </div>
  )
}
