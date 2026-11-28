import { lazy, Suspense, use, useContext, useState } from 'react'
import { wsKey } from '@/core/docs/slots'
import { useLayout } from '@/platform/layout'
import { ws } from '@/core/docs/workspace'
import { databaseIdOf, listViews, type ViewMeta } from '@/core/model/views'
import { navigate, useRoute } from '@/core/store/router'
import { EmptyState, ErrorBoundary, Skeleton } from '@/ui'
import { DbTabs } from './DbTabs'
import { DbToolbar } from './DbToolbar'
import { Grid } from './Grid'
import { CardList } from './CardList'
import { dt, loadDbMessages } from './i18n'
import type { LayoutProps } from './layoutProps'
import { RowModal } from './RowModal'
import { RowRouteContext } from './rowNav'
import { RelationContext, type RelationAccess } from './relationContext'
import { getRow } from '@/core/model/database'
import { useDbSession } from './useDbSession'
import './database.css'

// The `db.*` dictionary is part of this chunk's load (it is not in the boot dictionary).
const messages = loadDbMessages()

/** Board and Calendar are separate chunks, loaded when a view of that layout opens (M5-00). */
const LAYOUTS = {
  board: lazy(() => import('./BoardView')),
  calendar: lazy(() => import('./CalendarView')),
}

/** A database view: Grid, Board or Calendar (spec/05). Lazy chunk `database`. */
export function DatabaseView({ view, readOnly }: { view: ViewMeta; readOnly: boolean }) {
  use(messages)
  const dbId = databaseIdOf(ws(), view.id)
  const { session, state } = useDbSession(dbId, view.id)
  const phone = useLayout().layout === 'phone'
  const route = useRoute()
  const routeId = useContext(RowRouteContext) ?? view.id
  const routeRow = route.name === 'page' && route.id === routeId ? route.row : undefined
  // an inline database shows only rows of its own database (a page may hold several)
  const openRowId = routeRow && state?.docs && getRow(state.docs, routeRow) ? routeRow : undefined
  const [cards, setCards] = useState(() => readCards())
  const toggleCards = () => {
    setCards(!cards)
    try {
      localStorage.setItem(wsKey('db-cards'), cards ? '0' : '1')
    } catch {
      /* per-device convenience only */
    }
  }
  if (!dbId) return <EmptyState title={dt('db.missing')} />
  if (!state || !session) return <Skeleton className="editor-loading" />
  const props: LayoutProps = { session, state, title: view.title, readOnly: readOnly || !!state.preview }
  const layout = state.view?.layout ?? (view.layout === 'document' ? 'grid' : view.layout)
  const Layout = layout === 'grid' ? null : LAYOUTS[layout]
  // relation cells (M6-02): target docs, and a target row opens over its own database view
  const relations: RelationAccess = {
    dbId,
    target: (id) => session.target(id),
    version: state.targetsVersion + state.rowsVersion,
    openTarget: (id, rowId) => {
      if (id === dbId) return navigate({ name: 'page', id: routeId, row: rowId })
      const host = listViews(ws()).find((v) => v.databaseId === id && !v.deletedAt)
      if (host) navigate({ name: 'page', id: host.id, row: rowId })
    },
  }
  return (
    <RelationContext value={relations}>
      <div
        className="db-view"
        data-layout={layout}
        data-rows={state.result.rowIds.length}
        data-preview={state.preview ? '' : undefined}
      >
        <div className="db-head">
          <DbTabs viewId={view.id} docs={state.docs} readOnly={props.readOnly} />
          <DbToolbar
            session={session}
            state={state}
            readOnly={props.readOnly}
            cards={phone && layout === 'grid' ? cards : undefined}
            onToggleCards={toggleCards}
          />
        </div>
        {Layout ? (
          <ErrorBoundary key={layout}>
            <Suspense fallback={<Skeleton className="editor-loading" />}>
              <Layout {...props} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <GridLayout {...props} cards={phone && cards} />
        )}
        {openRowId && !state.preview && (
          <RowModal session={session} state={state} routeId={routeId} rowId={openRowId} readOnly={props.readOnly} />
        )}
      </div>
    </RelationContext>
  )
}

function GridLayout({ cards, ...props }: LayoutProps & { cards: boolean }) {
  return cards ? <CardList {...props} /> : <Grid {...props} />
}

/** Phone "card list" preference, per device and workspace (MB-30). */
function readCards() {
  try {
    return localStorage.getItem(wsKey('db-cards')) === '1'
  } catch {
    return false
  }
}
