import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createView, listViews, moveView } from '../views'
import { SHARD_COUNT } from './shard'
import {
  addDbView,
  createDatabase,
  databaseTabs,
  duplicateDbView,
  readViewSettings,
  setCalc,
  tabMoveIndex,
  updateDbView,
  type DbDocs,
} from './index'

function setup() {
  const ws = new Y.Doc()
  ws.getMap('spaces').set('s', new Y.Map())
  const db: DbDocs = { schema: new Y.Doc(), shards: Array.from({ length: SHARD_COUNT }, () => new Y.Doc()) }
  const { viewId } = createDatabase(ws, db, { dbId: 'd1', primaryName: 'Name', title: 'Tasks', spaceId: 's' })
  return { ws, db, host: viewId }
}

describe('database tabs (M5-01)', () => {
  it('host first, then its children of the same database in sibling order — from any tab', () => {
    const { ws, host } = setup()
    const board = createView(ws, { parentId: host, kind: 'database', layout: 'board', databaseId: 'd1', title: 'B' })
    createView(ws, { parentId: host, title: 'a sub page' })
    const cal = createView(ws, { parentId: host, kind: 'database', layout: 'calendar', databaseId: 'd1', title: 'C' })
    createView(ws, { parentId: host, kind: 'database', layout: 'grid', databaseId: 'other', title: 'X' })
    const views = listViews(ws)
    const ids = (id: string) => databaseTabs(views, id)?.tabs.map((t) => t.id)
    expect(ids(host)).toEqual([host, board, cal])
    expect(ids(cal)).toEqual([host, board, cal])
    expect(databaseTabs(views, cal)?.hostId).toBe(host)
    expect(databaseTabs(views, views.find((v) => v.title === 'a sub page')!.id)).toBeNull()

    // move C before B: index among all children (the document counts)
    moveView(ws, cal, { parentId: host, index: tabMoveIndex(views, host, cal, 0) })
    expect(ids(host) && databaseTabs(listViews(ws), host)!.tabs.map((t) => t.id)).toEqual([host, cal, board])
    // and back to the end
    const v2 = listViews(ws)
    moveView(ws, cal, { parentId: host, index: tabMoveIndex(v2, host, cal, 5) })
    expect(databaseTabs(listViews(ws), host)!.tabs.map((t) => t.id)).toEqual([host, board, cal])
  })

  it('duplicates view settings deeply (independent afterwards)', () => {
    const { db, host } = setup()
    const primary = readViewSettings(db, host)!
    const fid = Object.keys(primary.fields)[0]!
    updateDbView(db, host, { sorts: [{ id: 's', fieldId: fid, dir: 'desc' }] })
    setCalc(db, host, fid, 'count')
    expect(duplicateDbView(db, host, 'copy')).toBe(true)
    const copy = readViewSettings(db, 'copy')!
    expect(copy.sorts).toEqual([{ id: 's', fieldId: fid, dir: 'desc' }])
    expect(copy.calcs).toEqual({ [fid]: 'count' })
    expect(copy.fields).toEqual(primary.fields)
    setCalc(db, 'copy', fid, null)
    expect(readViewSettings(db, host)!.calcs).toEqual({ [fid]: 'count' })
    addDbView(db, 'b', 'board')
    const b = readViewSettings(db, 'b')!
    expect(b.layout).toBe('board')
    // board cards start with the title only
    expect(
      Object.entries(b.fields)
        .filter(([, f]) => f.visible)
        .map(([id]) => id),
    ).toEqual([fid])
  })
})

describe('group settings (M5-02)', async () => {
  const { moveGroup, setGroupHidden, updateGroup } = await import('./index')
  it('update keeps other settings; a new field resets order and hidden; move re-keys all', () => {
    const { db, host } = setup()
    updateGroup(db, host, { fieldId: 'f1' })
    moveGroup(db, host, ['', 'a', 'b'], 'b', 0)
    setGroupHidden(db, host, 'a', true)
    let g = readViewSettings(db, host)!.group!
    expect(
      Object.entries(g.order)
        .sort((x, y) => (x[1] < y[1] ? -1 : 1))
        .map(([k]) => k),
    ).toEqual(['b', '', 'a'])
    expect(g.hidden).toEqual(['a'])
    updateGroup(db, host, { dateUnit: 'week' })
    g = readViewSettings(db, host)!.group!
    expect(g.hidden).toEqual(['a'])
    expect(g.dateUnit).toBe('week')
    updateGroup(db, host, { fieldId: 'f2' })
    g = readViewSettings(db, host)!.group!
    expect(g).toMatchObject({ fieldId: 'f2', order: {}, hidden: [] })
    setGroupHidden(db, host, 'a', false)
  })
})
