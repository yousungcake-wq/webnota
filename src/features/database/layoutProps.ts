import type { DbSession, DbState } from './session'

/** What every database layout component receives (M5-00). */
export interface LayoutProps {
  session: DbSession
  state: DbState
  title: string
  /** The view is read-only (app read-only, locked view, or the first-screen preview). */
  readOnly: boolean
}
