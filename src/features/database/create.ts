import { openDatabase } from '@/core/docs/database'
import { ws } from '@/core/docs/workspace'
import { createDatabase, type DbLayout } from '@/core/model/database'
import { newId } from '@/core/model/views'
import { dt, loadDbMessages } from './i18n'

/** New database with one view (DB-F05: primary text field "Name", three empty rows like AppFlowy). */
export async function createDatabaseView(opts: { parentId: string | null; spaceId?: string; layout: DbLayout }) {
  await loadDbMessages()
  const dbId = newId()
  const { docs, release } = await openDatabase(dbId)
  try {
    return createDatabase(ws(), docs, {
      dbId,
      parentId: opts.parentId,
      spaceId: opts.spaceId,
      layout: opts.layout,
      primaryName: dt('db.field.name'),
      rows: 3,
    }).viewId
  } finally {
    release()
  }
}
