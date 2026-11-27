import { use, useState } from 'react'
import { wsKey } from '@/core/docs/slots'
import { useLayout } from '@/platform/layout'
import { ws } from '@/core/docs/workspace'
import { databaseIdOf, type ViewMeta } from '@/core/model/views'
import { EmptyState, Skeleton } from '@/ui'
import { DbToolbar } from './DbToolbar'
import { Grid } from './Grid'
import { CardList } from './CardList'
import { dt, loadDbMessages } from './i18n'
import { useDbSession } from './useDbSession'
import './database.css'

// The `db.*` dictionary is part of this chunk's load (it is not in the boot dictionary).
const messages = loadDbMessages()

/** A database view (Grid in M4; Board/Calendar in M5). Lazy chunk `database`. */
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
  return (
    <div className="db-view" data-layout={view.layout} data-rows={state.result.rowIds.length}>
      {view.layout === 'grid' ? (
        <>
          <DbToolbar
            session={session}
            state={state}
            readOnly={readOnly}
            cards={phone ? cards : undefined}
            onToggleCards={toggleCards}
          />
          {phone && cards ? (
            <CardList session={session} state={state} title={view.title} readOnly={readOnly} />
          ) : (
            <Grid session={session} state={state} title={view.title} readOnly={readOnly} />
          )}
        </>
      ) : (
        <EmptyState title={dt('db.comingSoon')} description={dt('db.comingSoonHint')} />
      )}
    </div>
  )
}

/** Phone "card list" preference, per device and workspace (MB-30). */
function readCards() {
  try {
    return localStorage.getItem(wsKey('db-cards')) === '1'
  } catch {
    return false
  }
}
