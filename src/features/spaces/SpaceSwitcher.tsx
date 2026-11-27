import { ChevronsUpDown } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { t } from '@/core/i18n'
import { useCurrentSpace, useSpaces } from '@/core/store/views'
import { afterMenuClosed } from '@/features/page'
import { SpaceBadge } from './SpaceBadge'
import './spaces.css'

const SpaceMenu = lazy(() => import('./SpaceMenu'))
const SpaceDialog = lazy(() => import('./SpaceDialog'))
const SpaceOrderDialog = lazy(() => import('./SpaceOrderDialog'))

/** Sidebar / home header button showing the current space; opens the space menu (WS-02). */
export function SpaceSwitcher() {
  const spaces = useSpaces()
  const currentId = useCurrentSpace()
  const current = spaces.find((s) => s.id === currentId)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [editing, setEditing] = useState<{ id: string | null } | null>(null)
  const [ordering, setOrdering] = useState(false)
  return (
    <>
      <button
        type="button"
        className="space-switcher"
        aria-haspopup="menu"
        aria-label={t('space.switch')}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        {current && <SpaceBadge space={current} />}
        <span className="space-name">{current?.name || t('space.untitled')}</span>
        <ChevronsUpDown size={14} />
      </button>
      {anchor && (
        <Suspense fallback={null}>
          <SpaceMenu
            anchor={anchor}
            currentId={currentId}
            onClose={() => setAnchor(null)}
            onEdit={(id) => void afterMenuClosed().then(() => setEditing({ id }))}
            onReorder={() => void afterMenuClosed().then(() => setOrdering(true))}
          />
        </Suspense>
      )}
      {ordering && (
        <Suspense fallback={null}>
          <SpaceOrderDialog onClose={() => setOrdering(false)} />
        </Suspense>
      )}
      {editing && (
        <Suspense fallback={null}>
          <SpaceDialog spaceId={editing.id} onClose={() => setEditing(null)} />
        </Suspense>
      )}
    </>
  )
}
