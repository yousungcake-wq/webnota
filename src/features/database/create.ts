import { openDatabase } from '@/core/docs/database'
import { ws } from '@/core/docs/workspace'
import { addField, createDatabase, updateGroup, type DbLayout } from '@/core/model/database'
import { newId } from '@/core/model/views'
import { dt, loadDbMessages } from './i18n'

/** New database with one view (DB-F05: primary text field "Name", three empty rows like AppFlowy). */
export async function createDatabaseView(opts: { parentId: string | null; spaceId?: string; layout: DbLayout }) {
  await loadDbMessages()
  const dbId = newId()
  const { docs, release } = await openDatabase(dbId)
  try {
    const { viewId } = createDatabase(ws(), docs, {
      dbId,
      parentId: opts.parentId,
      spaceId: opts.spaceId,
      layout: opts.layout,
      primaryName: dt('db.field.name'),
      rows: 3,
    })
    if (opts.layout === 'board') updateGroup(docs, viewId, { fieldId: addStatusField(docs) })
    return viewId
  } finally {
    release()
  }
}

/** A "Status" select with To do / Doing / Done (a new board groups by it, like AppFlowy). */
export function addStatusField(docs: Parameters<typeof addField>[0]) {
  return addField(docs, {
    name: dt('db.board.statusField'),
    type: 'select',
    options: {
      choices: [
        { id: 'todo', name: dt('db.board.todo'), color: 'gray' },
        { id: 'doing', name: dt('db.board.doing'), color: 'blue' },
        { id: 'done', name: dt('db.board.done'), color: 'green' },
      ],
    },
  })
}
