import { pathOf } from '@/core/model/pages'
import { useAlivePages } from '@/core/store/pages'
import { PageListItem } from '@/features/sidebar'
import { ViewHeader } from '@/ui/ViewHeader'

export function FavoritesView() {
  const { alive, byId } = useAlivePages()
  const favs = alive.filter((p) => p.favorite)
  return (
    <div className="view">
      <ViewHeader title="즐겨찾기" />
      <div className="list">
        {favs.map((p) => (
          <PageListItem key={p.id} page={p} subtitle={pathOf(p, byId) || undefined} />
        ))}
        {!favs.length && <p className="muted pad">페이지의 ☆ 버튼을 눌러 즐겨찾기에 추가하세요.</p>}
      </div>
    </div>
  )
}
