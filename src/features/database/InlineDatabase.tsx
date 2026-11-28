import { Database, Maximize2, Search } from 'lucide-react'
import { lazy, Suspense, use, useMemo, useState } from 'react'
import { openDatabase } from '@/core/docs/database'
import { ws } from '@/core/docs/workspace'
import { duplicateDbView, readViewSettings } from '@/core/model/database'
import { createView, getView, type ViewMeta } from '@/core/model/views'
import { navigate } from '@/core/store/router'
import { useAliveViews } from '@/core/store/views'
import { useY } from '@/core/store/useY'
import { displayTitle, ViewIcon } from '@/features/page'
import { dt, loadDbMessages } from './i18n'
import { RowRouteContext } from './rowNav'
import './inline.css'

// the database UI is its own chunk (shared with full-page database views)
const DatabaseView = lazy(() => import('./DatabaseView').then((m) => ({ default: m.DatabaseView })))

const messages = loadDbMessages()

const DEFAULT_HEIGHT = 400
const MIN_HEIGHT = 200
const MAX_HEIGHT = 1600

interface Attrs {
  viewId?: string | null
  databaseId?: string | null
  layout?: string | null
  height?: number | null
}

const sameView = (a: ViewMeta | null, b: ViewMeta | null) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Inline database block (M5-10, ED-B20, spec/05 §8): an embedded view inside the page,
 * height-limited (default 400px, drag the bottom edge), "open as full page", rows open
 * over the page. Without a view yet, it lists the databases to link (a new view of one).
 */
export default function InlineDatabase({
  viewId,
  height,
  pageId,
  readOnly,
  onChange,
}: {
  viewId: string | null
  height: number | null
  pageId: string | null
  readOnly: boolean
  onChange: (attrs: Attrs) => void
}) {
  use(messages)
  const view = useY(ws(), (doc) => (viewId ? getView(doc, viewId) : null), sameView)
  const [dragH, setDragH] = useState<number | null>(null)
  const h = dragH ?? height ?? DEFAULT_HEIGHT
  if (!viewId) return <Linker pageId={pageId} readOnly={readOnly} onLinked={onChange} />
  if (!view) return <div className="db-inline is-loading" style={{ height: h }} />
  const startResize = (e: React.PointerEvent<HTMLElement>) => {
    if (readOnly) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const y0 = e.clientY
    const h0 = h
    let last = h0
    const move = (ev: PointerEvent) => {
      last = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(h0 + ev.clientY - y0)))
      setDragH(last)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDragH(null)
      onChange({ height: last })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <div className="db-inline" data-view-id={view.id}>
      <div className="db-inline-head">
        <span className="db-inline-title">
          <ViewIcon icon={view.icon} layout={view.layout} size={16} />
          {displayTitle(view.title)}
        </span>
        <button
          type="button"
          className="db-barbtn"
          aria-label={dt('db.inline.openFull')}
          title={dt('db.inline.openFull')}
          onClick={() => navigate({ name: 'page', id: view.id })}
        >
          <Maximize2 size={14} aria-hidden />
        </button>
      </div>
      <div className="db-inline-body" style={{ height: h }}>
        <RowRouteContext value={pageId}>
          <Suspense fallback={null}>
            <DatabaseView view={view} readOnly={readOnly} />
          </Suspense>
        </RowRouteContext>
      </div>
      {!readOnly && (
        <div
          className="db-inline-resize"
          role="separator"
          aria-orientation="horizontal"
          aria-label={dt('db.inline.resize')}
          onPointerDown={startResize}
        />
      )}
    </div>
  )
}

/** Pick an existing database: the block gets a new embedded view of it (settings copied). */
function Linker({
  pageId,
  readOnly,
  onLinked,
}: {
  pageId: string | null
  readOnly: boolean
  onLinked: (a: Attrs) => void
}) {
  const { alive } = useAliveViews()
  const [q, setQ] = useState('')
  const databases = useMemo(() => {
    const seen = new Set<string>()
    return alive.filter((v) => {
      if (v.kind !== 'database' || !v.databaseId || seen.has(v.databaseId)) return false
      seen.add(v.databaseId)
      return true
    })
  }, [alive])
  const shown = databases.filter((v) => displayTitle(v.title).toLowerCase().includes(q.trim().toLowerCase()))
  const link = async (src: ViewMeta) => {
    if (!pageId || !src.databaseId) return
    const { docs, release } = await openDatabase(src.databaseId)
    try {
      const id = createView(ws(), {
        parentId: pageId,
        kind: 'database',
        layout: src.layout,
        databaseId: src.databaseId,
        title: src.title,
        icon: src.icon,
        embedded: true,
      })
      if (readViewSettings(docs, src.id)) duplicateDbView(docs, src.id, id)
      onLinked({ viewId: id, databaseId: src.databaseId, layout: src.layout })
    } finally {
      release()
    }
  }
  return (
    <div className="db-inline db-linker">
      <div className="db-linker-head">
        <Database size={16} aria-hidden />
        {dt('db.inline.linkTitle')}
      </div>
      {readOnly ? null : (
        <>
          <label className="db-search db-linker-search">
            <Search size={14} aria-hidden />
            <input
              className="db-search-input"
              placeholder={dt('db.inline.search')}
              aria-label={dt('db.inline.search')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <div className="db-linker-list" role="list">
            {!shown.length && <p className="db-empty">{dt('db.inline.none')}</p>}
            {shown.map((v) => (
              <button key={v.id} type="button" role="listitem" className="db-linker-item" onClick={() => void link(v)}>
                <ViewIcon icon={v.icon} layout={v.layout} size={16} />
                {displayTitle(v.title)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
