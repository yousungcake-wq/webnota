import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { displayTitle, pathOf } from '@/features/page'
import { useAliveViews } from '@/core/store/views'
import { useRecent } from '@/core/store/prefs'
import { PageListItem } from '@/features/sidebar'
import { ViewHeader } from '@/ui'
import './search.css'
import { t } from '@/core/i18n'

export function SearchView({ autoFocus = true }: { autoFocus?: boolean }) {
  const { alive, byId } = useAliveViews()
  const [q, setQ] = useState('')
  const recent = useRecent()
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) {
      // No query: recently opened on this device (WS-05), else recently edited.
      const byIdAlive = new Map(alive.map((p) => [p.id, p]))
      const recents = recent.flatMap((id) => byIdAlive.get(id) ?? [])
      return recents.length ? recents : [...alive].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30)
    }
    const list = alive.filter((p) => displayTitle(p.title).toLowerCase().includes(s))
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50)
  }, [alive, q, recent])
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
