import { use } from 'react'
import { ws } from '@/core/docs/workspace'
import { databaseIdOf, type ViewMeta } from '@/core/model/views'
import { EmptyState, Skeleton } from '@/ui'
import { Grid } from './Grid'
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
  if (!dbId) return <EmptyState title={dt('db.missing')} />
  if (!state || !session) return <Skeleton className="editor-loading" />
  return (
    <div className="db-view" data-layout={view.layout} data-rows={state.result.rowIds.length}>
      {view.layout === 'grid' ? (
        <Grid session={session} state={state} title={view.title} readOnly={readOnly} />
      ) : (
        <EmptyState title={dt('db.comingSoon')} description={dt('db.comingSoonHint')} />
      )}
    </div>
  )
}
