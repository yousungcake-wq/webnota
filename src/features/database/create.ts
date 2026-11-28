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

/**
 * A new inline database (M5-10): its view is embedded (not in the sidebar), a child of the
 * page; ids are chosen by the editor block so both agree.
 */
export async function createInlineDatabase(opts: {
  viewId: string
  databaseId: string
  parentId: string
  layout: DbLayout
}) {
  await loadDbMessages()
  const { docs, release } = await openDatabase(opts.databaseId)
  try {
    createDatabase(ws(), docs, {
      dbId: opts.databaseId,
      viewId: opts.viewId,
      parentId: opts.parentId,
      layout: opts.layout,
      primaryName: dt('db.field.name'),
      rows: 3,
      embedded: true,
    })
    if (opts.layout === 'board') updateGroup(docs, opts.viewId, { fieldId: addStatusField(docs) })
  } finally {
    release()
  }
}
