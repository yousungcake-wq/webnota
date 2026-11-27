import type { DbLayout } from '@/core/model/database'

// Public API of the database feature (spec/05). Everything is behind a dynamic import so
// the database code never lands in the initial or editor bundles (budget: `database`).
export const loadDatabase = () => import('./DatabaseView')

/** Creates a database and its first view; resolves to the view id. */
export const createDatabaseView = async (opts: { parentId: string | null; spaceId?: string; layout: DbLayout }) =>
  (await import('./create')).createDatabaseView(opts)

/** QA seeds (`webnota:debug=seed-db`, `seed-db-10k`). */
export const seedQaDatabase = async (opts: { rows: number; wide?: boolean; title: string }) =>
  (await import('./qaSeed')).seedQaDatabase(opts)
