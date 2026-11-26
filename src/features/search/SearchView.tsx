import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { displayTitle, pathOf } from '@/core/model/pages'
import { useAlivePages } from '@/core/store/pages'
import { PageListItem } from '@/features/sidebar'
import { ViewHeader } from '@/ui/ViewHeader'
import './search.css'

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
      <ViewHeader title="검색" />
      <label className="search-box">
        <Search size={18} />
        <input
          autoFocus={autoFocus}
          type="search"
          enterKeyHint="search"
          placeholder="페이지 제목 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <div className="section-head">
        <span>{q.trim() ? `결과 ${results.length}개` : '최근 수정한 페이지'}</span>
      </div>
      <div className="list">
        {results.map((p) => (
          <PageListItem key={p.id} page={p} subtitle={pathOf(p, byId) || undefined} />
        ))}
        {!results.length && <p className="muted pad">일치하는 페이지가 없습니다.</p>}
      </div>
    </div>
  )
}
