import { ChevronRight, Plus } from 'lucide-react'
import { useRef } from 'react'
import { ws } from '@/core/docs/workspace'
import { t } from '@/core/i18n'
import { listSpaces, moveSpace, visibleSpaces } from '@/core/model/views'
import { foldedSpacesStore, toggleSpaceFolded } from '@/core/store/prefs'
import { useStore } from '@/core/store/useStore'
import { useSpaces } from '@/core/store/views'
import { newView } from '@/features/page'
import { SpaceActions, SpaceBadge } from '@/features/spaces'
import { IconButton } from '@/ui'
import { beginListDrag, preloadDrag } from './dragStart'
import { PageTree } from './PageTree'

/**
 * Every space with its pages, one foldable section each (feedback 7). Drag a space's
 * header to reorder the spaces.
 */
export function SpaceSections({ currentId }: { currentId?: string }) {
  const spaces = visibleSpaces(useSpaces())
  const folded = useStore(foldedSpacesStore)
  const listRef = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={listRef}
      className="space-sections"
      onPointerEnter={(e) => e.pointerType === 'mouse' && void preloadDrag()}
      onPointerDown={(e) => {
        if (!(e.target as HTMLElement).closest('.space-head')) return
        beginListDrag(
          e,
          listRef.current,
          (id, index) => {
            // `index` counts the visible spaces; moveSpace counts all of them
            const rest = listSpaces(ws()).filter((x) => x.id !== id)
            const before = spaces.filter((x) => x.id !== id)[index]
            moveSpace(ws(), id, before ? rest.findIndex((x) => x.id === before.id) : rest.length)
          },
          'space-id',
        )
      }}
    >
      {spaces.map((s) => {
        const isFolded = folded.has(s.id)
        return (
          <section key={s.id} className="section space-section" data-space-id={s.id}>
            <div className="section-head space-head">
              <button
                type="button"
                className={`tree-toggle${isFolded ? '' : ' is-open'}`}
                aria-expanded={!isFolded}
                aria-label={isFolded ? t('tree.expand') : t('tree.collapse')}
                onClick={() => toggleSpaceFolded(s.id)}
              >
                <ChevronRight size={14} />
              </button>
              <span className="space-head-name" data-drag-label onClick={() => toggleSpaceFolded(s.id)}>
                <SpaceBadge space={s} />
                <span className="space-name">{s.name || t('space.untitled')}</span>
              </span>
              <span className="space-head-actions">
                <SpaceActions spaceId={s.id} />
                <IconButton
                  size="sm"
                  icon={Plus}
                  data-new-page
                  label={t('common.newPage')}
                  onClick={(e) => newView(e.currentTarget, null, s.id)}
                />
              </span>
            </div>
            {!isFolded && <PageTree spaceId={s.id} currentId={currentId} />}
          </section>
        )
      })}
    </div>
  )
}
