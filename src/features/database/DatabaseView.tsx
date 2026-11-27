import { lazy, Suspense, use, useState } from 'react'
import { wsKey } from '@/core/docs/slots'
import { useLayout } from '@/platform/layout'
import { ws } from '@/core/docs/workspace'
import { databaseIdOf, type ViewMeta } from '@/core/model/views'
import { EmptyState, ErrorBoundary, Skeleton } from '@/ui'
import { DbTabs } from './DbTabs'
import { DbToolbar } from './DbToolbar'
import { Grid } from './Grid'
import { CardList } from './CardList'
import { dt, loadDbMessages } from './i18n'
import type { LayoutProps } from './layoutProps'
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
  return (
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
    </div>
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
