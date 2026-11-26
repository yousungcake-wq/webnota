import { pathOf } from '@/features/page'
import { useAliveViews } from '@/core/store/views'
import { PageListItem } from '@/features/sidebar'
import { ViewHeader } from '@/ui'
import { t } from '@/core/i18n'

export function FavoritesView() {
  const { alive, byId } = useAliveViews()
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
