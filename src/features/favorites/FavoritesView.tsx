import { pathOf } from '@/features/page'
import { useAlivePages } from '@/core/store/pages'
import { PageListItem } from '@/features/sidebar'
import { ViewHeader } from '@/ui/ViewHeader'
import { t } from '@/core/i18n'

export function FavoritesView() {
  const { alive, byId } = useAlivePages()
  const favs = alive.filter((p) => p.favorite)
  return (
    <div className="view">
      <ViewHeader title={t('common.favorites')} />
      <div className="list">
        {favs.map((p) => (
          <PageListItem key={p.id} page={p} subtitle={pathOf(p, byId) || undefined} />
        ))}
        {!favs.length && <p className="muted pad">{t('favorites.empty')}</p>}
      </div>
    </div>
  )
}
