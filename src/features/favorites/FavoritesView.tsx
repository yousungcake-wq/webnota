import { useEffect, useRef } from 'react'
import { FavoritesList } from '@/features/sidebar'
import { loadPullRefresh } from '@/features/home'
import { ViewHeader } from '@/ui'
import { t } from '@/core/i18n'

export function FavoritesView() {
  const ref = useRef<HTMLDivElement>(null)
  // pull to refresh on phones (MB-15)
  useEffect(() => {
    const scroller = ref.current?.closest<HTMLElement>('.phone-content')
    if (!scroller) return
    let off: (() => void) | undefined
    let alive = true
    void loadPullRefresh().then((m) => {
      if (alive) off = m.attachPullRefresh(scroller)
    })
    return () => {
      alive = false
      off?.()
    }
  }, [])
  return (
    <div className="view" ref={ref}>
      <ViewHeader title={t('common.favorites')} />
      <div className="list">
        <FavoritesList withPath empty={<p className="muted pad">{t('favorites.empty')}</p>} />
      </div>
    </div>
  )
}
