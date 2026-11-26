import { FavoritesList } from '@/features/sidebar'
import { ViewHeader } from '@/ui'
import { t } from '@/core/i18n'

export function FavoritesView() {
  return (
    <div className="view">
      <ViewHeader title={t('common.favorites')} />
      <div className="list">
        <FavoritesList withPath empty={<p className="muted pad">{t('favorites.empty')}</p>} />
      </div>
    </div>
  )
}
