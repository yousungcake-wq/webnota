import { use } from 'react'
import type { ViewMeta } from '@/core/model/views'
import { EmptyState } from '@/ui'
import { dt, loadDbMessages } from './i18n'
import './database.css'

// The `db.*` dictionary is part of this chunk's load (it is not in the boot dictionary).
const messages = loadDbMessages()

/** A database view (Grid in M4; Board/Calendar in M5). Lazy chunk `database`. */
export function DatabaseView({ view }: { view: ViewMeta; readOnly: boolean }) {
  use(messages)
  return (
    <div className="db-view" data-layout={view.layout}>
      <EmptyState title={dt('db.comingSoon')} description={dt('db.comingSoonHint')} />
    </div>
  )
}
