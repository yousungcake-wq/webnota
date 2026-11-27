import { MoreHorizontal, Plus, Settings2, Trash2 } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { t } from '@/core/i18n'
import { afterMenuClosed } from '@/features/page'
import { ws } from '@/core/docs/workspace'
import { listSpaces } from '@/core/model/views'
import { IconButton, Menu } from '@/ui'
import { confirmDeleteSpace } from './deleteSpace'

const SpaceDialog = lazy(() => import('./SpaceDialog'))

/** "⋯" of a space in the sidebar (feedback 7): its settings, or a new space. */
export function SpaceActions({ spaceId }: { spaceId: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [editing, setEditing] = useState<{ id: string | null } | null>(null)
  const open = (id: string | null) => void afterMenuClosed().then(() => setEditing({ id }))
  return (
    <>
      <IconButton
        size="sm"
        icon={MoreHorizontal}
        label={t('space.settings')}
        onClick={(e) => setAnchor(e.currentTarget)}
      />
      {anchor && (
        <Menu
          anchor={anchor}
          title={t('space.title')}
          onClose={() => setAnchor(null)}
          items={[
            { label: t('space.settings'), icon: Settings2, onSelect: () => open(spaceId) },
            { label: t('space.new'), icon: Plus, onSelect: () => open(null) },
            ...(listSpaces(ws()).length > 1
              ? [
                  'separator' as const,
                  {
                    label: t('space.delete'),
                    icon: Trash2,
                    danger: true,
                    onSelect: () => void afterMenuClosed().then(() => confirmDeleteSpace(spaceId)),
                  },
                ]
              : []),
          ]}
        />
      )}
      {editing && (
        <Suspense fallback={null}>
          <SpaceDialog spaceId={editing.id} onClose={() => setEditing(null)} />
        </Suspense>
      )}
    </>
  )
}
