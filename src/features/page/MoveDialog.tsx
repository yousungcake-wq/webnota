import { hangulIncludes } from '@/core/text/hangul'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ws } from '@/core/docs/workspace'
import { t } from '@/core/i18n'
import {
  descendantsOf,
  isAlive,
  listSpaces,
  listViews,
  moveView,
  visibleSpaces,
  type ViewMeta,
} from '@/core/model/views'
import { setCurrentSpace, toggleExpanded } from '@/core/store/prefs'
import { Dialog, toast } from '@/ui'
import { SpaceBadge } from '@/features/spaces'
import { displayTitle } from './titles'
import { ViewIcon } from './ViewIcon'

interface Target {
  key: string
  spaceId: string
  parentId: string | null
  label: string
  depth: number
  view?: ViewMeta
  disabled: boolean
}

/** "Move to" picker (WS-12): every space and page, searchable; the view itself and its subtree are excluded. */
export function MoveDialog({ view, onClose }: { view: ViewMeta; onClose: () => void }) {
  const [q, setQ] = useState('')
  const targets = useMemo(() => {
    const doc = ws()
    const all = listViews(doc)
    const byId = new Map(all.map((v) => [v.id, v]))
    const alive = all.filter((v) => isAlive(byId, v.id))
    const blocked = new Set([view.id, ...descendantsOf(all, view.id)])
    const out: Target[] = []
    for (const space of visibleSpaces(listSpaces(doc))) {
      out.push({
        key: `s:${space.id}`,
        spaceId: space.id,
        parentId: null,
        label: space.name,
        depth: 0,
        disabled: false,
      })
      const walk = (parentId: string | null, depth: number) => {
        for (const v of alive.filter((x) => x.spaceId === space.id && x.parentId === parentId)) {
          out.push({
            key: v.id,
            spaceId: space.id,
            parentId: v.id,
            label: displayTitle(v.title),
            depth,
            view: v,
            disabled: blocked.has(v.id),
          })
          walk(v.id, depth + 1)
        }
      }
      walk(null, 1)
    }
    return out
  }, [view.id])
  const spaces = listSpaces(ws())
  const shown = q.trim() ? targets.filter((x) => hangulIncludes(x.label, q)) : targets

  const pick = (target: Target) => {
    const doc = ws()
    const siblings = listViews(doc).filter(
      (v) => !v.deletedAt && v.id !== view.id && v.spaceId === target.spaceId && v.parentId === target.parentId,
    )
    if (!moveView(doc, view.id, { parentId: target.parentId, spaceId: target.spaceId, index: siblings.length })) return
    if (target.parentId) toggleExpanded(target.parentId, true)
    if (target.spaceId !== view.spaceId) setCurrentSpace(target.spaceId)
    toast(t('page.moved', { title: displayTitle(view.title), target: target.label }))
    onClose()
  }

  return (
    <Dialog title={t('page.moveTitle', { title: displayTitle(view.title) })} onClose={onClose}>
      <label className="search-box move-search">
        <Search size={18} />
        <input
          data-autofocus
          type="search"
          placeholder={t('page.moveSearch')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <div className="move-list" role="listbox" aria-label={t('page.move')}>
        {shown.map((x) => {
          const space = spaces.find((s) => s.id === x.spaceId)
          return (
            <button
              key={x.key}
              type="button"
              role="option"
              aria-selected={false}
              disabled={x.disabled}
              className={`move-item${x.view ? '' : ' is-space'}`}
              style={{ paddingLeft: 8 + (q.trim() ? 0 : x.depth) * 16 }}
              onClick={() => pick(x)}
            >
              <span className="tree-icon">
                {x.view ? <ViewIcon icon={x.view.icon} /> : space && <SpaceBadge space={space} size={18} />}
              </span>
              <span className="move-label">{x.label}</span>
            </button>
          )
        })}
      </div>
    </Dialog>
  )
}
