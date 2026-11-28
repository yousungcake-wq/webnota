import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'
import * as Y from 'yjs'
import { assertWritable } from '../guard'
import { bySiblingOrder, createView, getCurrentUser, newId, type IconValue } from '../views'
import { shardOf, SHARD_COUNT } from './shard'
import type {
  CalcType,
  CellValue,
  CoverValue,
  DbLayout,
  DbMeta,
  FieldMeta,
  FieldOptions,
  BoardSettings,
  CalendarSettings,
  FieldType,
  GroupSettings,
  FilterGroup,
  RowSnapshot,
  Sort,
  ViewFieldSettings,
  ViewSettings,
} from './types'

/**
 * A database's docs (spec/02 §4): `db/<id>` holds meta, fields and view settings;
 * `dbr/<id>/<n>` holds the rows whose `shardOf(rowId)` is n. All shards are loaded
 * while a database is open, so readers see every row.
 */
export interface DbDocs {
  schema: Y.Doc
  shards: Y.Doc[]
}

type YMap = Y.Map<unknown>

/** Format of the db docs themselves (the workspace schemaVersion gates the app). */
export const DB_FORMAT_VERSION = 1
export const DEFAULT_FIELD_WIDTH = 180
export const PRIMARY_FIELD_WIDTH = 240

const metaOf = (db: DbDocs) => db.schema.getMap<unknown>('meta')
export const fieldsOf = (db: DbDocs) => db.schema.getMap<YMap>('fields')
export const dbViewsOf = (db: DbDocs) => db.schema.getMap<YMap>('views')
export const rowsOf = (shard: Y.Doc) => shard.getMap<YMap>('rows')

const shardFor = (db: DbDocs, rowId: string) => db.shards[shardOf(rowId, db.shards.length)]!
const rowMap = (db: DbDocs, rowId: string) => rowsOf(shardFor(db, rowId)).get(rowId)

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const toPlain = (v: unknown): unknown => (v instanceof Y.AbstractType ? v.toJSON() : v)

/** Order key strictly between two neighbours; tolerates equal keys from concurrent inserts. */
function keyBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && a >= b) return generateKeyBetween(a, null)
  return generateKeyBetween(a, b)
}

// ---------- create ----------

export interface CreateDatabaseOptions {
  dbId: string
  /** The workspace view (and the database's first view) id. */
  viewId?: string
  parentId?: string | null
  spaceId?: string
  title?: string
  layout?: DbLayout
  /** Name of the primary text field (UI language). */
  primaryName: string
  /** Empty rows to start with (AppFlowy starts a grid with a few). */
  rows?: number
  /** An inline database's view (M5-10): hidden from the sidebar. */
  embedded?: boolean
}

/**
 * Creates a database: the workspace view (kind=database), its schema doc with a primary
 * text field and the first view's settings, and `rows` empty rows. The docs in `db` must
 * be the (empty) docs of `opts.dbId`.
 */
export function createDatabase(ws: Y.Doc, db: DbDocs, opts: CreateDatabaseOptions): { viewId: string; dbId: string } {
  assertWritable()
  const layout = opts.layout ?? 'grid'
  const viewId = opts.viewId ?? newId()
  const now = Date.now()
  const primaryId = newId()
  db.schema.transact(() => {
    const meta = metaOf(db)
    meta.set('schemaVersion', DB_FORMAT_VERSION)
    meta.set('shardCount', db.shards.length)
    meta.set('primaryFieldId', primaryId)
    meta.set('createdAt', now)
    fieldsOf(db).set(primaryId, fieldMap(opts.primaryName, 'text', {}, now))
    dbViewsOf(db).set(viewId, viewMap(db, layout, [primaryId]))
  })
  for (let i = 0; i < (opts.rows ?? 0); i++) addRow(db)
  createView(ws, {
    id: viewId,
    parentId: opts.parentId,
    spaceId: opts.spaceId,
    title: opts.title,
    kind: 'database',
    layout,
    databaseId: opts.dbId,
    embedded: opts.embedded,
  })
  return { viewId, dbId: opts.dbId }
}

function fieldMap(name: string, type: FieldType, options: FieldOptions, now: number) {
  const m = new Y.Map<unknown>()
  m.set('name', name)
  m.set('type', type)
  const o = new Y.Map<unknown>()
  for (const [k, v] of Object.entries(options)) o.set(k, v)
  m.set('options', o)
  m.set('createdAt', now)
  return m
}

function viewFieldMap(s: ViewFieldSettings) {
  const m = new Y.Map<unknown>()
  m.set('visible', s.visible)
  m.set('width', s.width)
  m.set('order', s.order)
  m.set('wrap', s.wrap)
  return m
}

function viewMap(db: DbDocs, layout: DbLayout, fieldIds: string[]) {
  const m = new Y.Map<unknown>()
  m.set('layout', layout)
  const fields = new Y.Map<unknown>()
  let last: string | null = null
  const primary = metaOf(db).get('primaryFieldId')
  for (const id of fieldIds) {
    last = generateKeyBetween(last, null)
    const width = id === primary ? PRIMARY_FIELD_WIDTH : DEFAULT_FIELD_WIDTH
    fields.set(id, viewFieldMap({ visible: true, width, order: last, wrap: false }))
  }
  m.set('fields', fields)
  m.set('filter', null)
  m.set('sorts', [])
  m.set('group', null)
  m.set('calcs', new Y.Map<unknown>())
  m.set('frozenColumns', 1)
  return m
}

/**
 * Adds settings for a further view of the database (M5 tabs). Grids show every field;
 * board cards and calendar events start with just the title (like AppFlowy) — the
 * properties panel turns more on.
 */
export function addDbView(db: DbDocs, viewId: string, layout: DbLayout) {
  assertWritable()
  db.schema.transact(() => {
    const m = viewMap(
      db,
      layout,
      listFields(db).map((f) => f.id),
    )
    dbViewsOf(db).set(viewId, m)
    if (layout !== 'grid') {
      const primary = metaOf(db).get('primaryFieldId')
      ;(m.get('fields') as Y.Map<YMap>).forEach((f, id) => id !== primary && f.set('visible', false))
    }
  })
}

// ---------- read ----------

export function readDbMeta(db: DbDocs): DbMeta {
  const m = metaOf(db)
  const num = (k: string, d: number) => (typeof m.get(k) === 'number' ? (m.get(k) as number) : d)
  return {
    schemaVersion: num('schemaVersion', DB_FORMAT_VERSION),
    shardCount: num('shardCount', SHARD_COUNT),
    primaryFieldId: typeof m.get('primaryFieldId') === 'string' ? (m.get('primaryFieldId') as string) : '',
    createdAt: num('createdAt', 0),
  }
}

function readField(id: string, m: YMap): FieldMeta {
  const options = m.get('options')
  return {
    id,
    name: typeof m.get('name') === 'string' ? (m.get('name') as string) : '',
    type: (typeof m.get('type') === 'string' ? m.get('type') : 'text') as FieldType,
    options: options instanceof Y.Map ? (options.toJSON() as FieldOptions) : {},
    createdAt: typeof m.get('createdAt') === 'number' ? (m.get('createdAt') as number) : 0,
  }
}

/** Fields in creation order (views order them with their own settings). */
export function listFields(db: DbDocs): FieldMeta[] {
  const out: FieldMeta[] = []
  fieldsOf(db).forEach((m, id) => out.push(readField(id, m)))
  return out.sort((a, b) => a.createdAt - b.createdAt || cmp(a.id, b.id))
}

export function getField(db: DbDocs, id: string): FieldMeta | null {
  const m = fieldsOf(db).get(id)
  return m ? readField(id, m) : null
}

const readIcon = (v: unknown) => (v && typeof v === 'object' ? (v as IconValue) : null)

export function readRow(id: string, m: YMap): RowSnapshot {
  const cells = m.get('cells')
  const str = (k: string) => (typeof m.get(k) === 'string' ? (m.get(k) as string) : '')
  const num = (k: string) => (typeof m.get(k) === 'number' ? (m.get(k) as number) : 0)
  return {
    id,
    order: str('order'),
    cells: cells instanceof Y.Map ? (cells.toJSON() as Record<string, CellValue>) : {},
    icon: readIcon(m.get('icon')),
    cover: (m.get('cover') as CoverValue | null) ?? null,
    hasDoc: m.get('hasDoc') === true,
    createdAt: num('createdAt'),
    createdBy: str('createdBy'),
    updatedAt: num('updatedAt'),
    updatedBy: str('updatedBy'),
  }
}

/** Every row in manual order (order, id). */
export function listRows(db: DbDocs): RowSnapshot[] {
  const out: RowSnapshot[] = []
  for (const shard of db.shards) rowsOf(shard).forEach((m, id) => out.push(readRow(id, m)))
  return out.sort(bySiblingOrder)
}

export function getRow(db: DbDocs, id: string): RowSnapshot | null {
  const m = rowMap(db, id)
  return m ? readRow(id, m) : null
}

export function rowCount(db: DbDocs): number {
  return db.shards.reduce((n, s) => n + rowsOf(s).size, 0)
}

export function readViewSettings(db: DbDocs, viewId: string): ViewSettings | null {
  const m = dbViewsOf(db).get(viewId)
  if (!m) return null
  const fields: Record<string, ViewFieldSettings> = {}
  const fm = m.get('fields')
  if (fm instanceof Y.Map)
    (fm as Y.Map<YMap>).forEach((f, id) => {
      if (!(f instanceof Y.Map)) return
      fields[id] = {
        visible: f.get('visible') !== false,
        width: typeof f.get('width') === 'number' ? (f.get('width') as number) : DEFAULT_FIELD_WIDTH,
        order: typeof f.get('order') === 'string' ? (f.get('order') as string) : '',
        wrap: f.get('wrap') === true,
      }
    })
  const calcs = m.get('calcs')
  const layout = m.get('layout')
  return {
    id: viewId,
    layout: layout === 'board' || layout === 'calendar' ? layout : 'grid',
    fields,
    filter: (toPlain(m.get('filter')) as FilterGroup | null) ?? null,
    sorts: Array.isArray(m.get('sorts')) ? (m.get('sorts') as Sort[]) : [],
    calcs: calcs instanceof Y.Map ? (calcs.toJSON() as Record<string, CalcType>) : {},
    frozenColumns: typeof m.get('frozenColumns') === 'number' ? (m.get('frozenColumns') as number) : 1,
    group: readGroup(toPlain(m.get('group'))),
    board: readBoard(toPlain(m.get('board'))),
    calendar: readCalendar(toPlain(m.get('calendar'))),
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function readGroup(v: unknown): GroupSettings | null {
  if (!isObj(v) || typeof v.fieldId !== 'string') return null
  const order: Record<string, string> = {}
  if (isObj(v.order)) for (const [k, o] of Object.entries(v.order)) if (typeof o === 'string') order[k] = o
  const unit = v.dateUnit
  return {
    fieldId: v.fieldId,
    hideEmpty: v.hideEmpty === true,
    order,
    hidden: Array.isArray(v.hidden) ? v.hidden.filter((x): x is string => typeof x === 'string') : [],
    ...(unit === 'day' || unit === 'week' || unit === 'month' || unit === 'year' ? { dateUnit: unit } : {}),
  }
}

function readBoard(v: unknown): BoardSettings {
  if (!isObj(v)) return {}
  const out: BoardSettings = {}
  if (typeof v.coverFieldId === 'string' || v.coverFieldId === null) out.coverFieldId = v.coverFieldId
  const c = v.calc as { fieldId?: unknown; calc?: unknown } | null | undefined
  if (c && typeof c.fieldId === 'string' && typeof c.calc === 'string')
    out.calc = { fieldId: c.fieldId, calc: c.calc as CalcType }
  return out
}

function readCalendar(v: unknown): CalendarSettings | null {
  if (!isObj(v)) return null
  return {
    dateFieldId: typeof v.dateFieldId === 'string' ? v.dateFieldId : null,
    firstDayOfWeek: v.firstDayOfWeek === 1 ? 1 : 0,
    showWeekends: v.showWeekends !== false,
    showWeekNumbers: v.showWeekNumbers === true,
  }
}

/**
 * The view's fields in display order: every field of the database, those without view
 * settings (added on another device before this view knew them) at the end.
 */
export function orderedFields(fields: FieldMeta[], view: ViewSettings): FieldMeta[] {
  const known = fields.filter((f) => view.fields[f.id])
  const unknown = fields.filter((f) => !view.fields[f.id])
  known.sort((a, b) =>
    bySiblingOrder({ id: a.id, order: view.fields[a.id]!.order }, { id: b.id, order: view.fields[b.id]!.order }),
  )
  return [...known, ...unknown]
}

// ---------- fields ----------

export interface AddFieldOptions {
  name: string
  type: FieldType
  options?: FieldOptions
  /** View whose column order places the field (others put it last). */
  viewId?: string
  /** Insert right after / before this field in `viewId`; default: at the end. */
  afterId?: string
  beforeId?: string
  id?: string
}

export function addField(db: DbDocs, opts: AddFieldOptions): string {
  assertWritable()
  const id = opts.id ?? newId()
  db.schema.transact(() => {
    fieldsOf(db).set(id, fieldMap(opts.name, opts.type, opts.options ?? {}, Date.now()))
    dbViewsOf(db).forEach((vm, viewId) => {
      const fm = vm.get('fields')
      if (!(fm instanceof Y.Map)) return
      const view = readViewSettings(db, viewId)!
      const ordered = orderedFields(listFields(db), view).filter((f) => f.id !== id && view.fields[f.id])
      const keys = ordered.map((f) => view.fields[f.id]!.order)
      let i = ordered.length
      if (viewId === opts.viewId && opts.afterId) {
        const at = ordered.findIndex((f) => f.id === opts.afterId)
        if (at >= 0) i = at + 1
      } else if (viewId === opts.viewId && opts.beforeId) {
        const at = ordered.findIndex((f) => f.id === opts.beforeId)
        if (at >= 0) i = at
      }
      const order = keyBetween(keys[i - 1] ?? null, keys[i] ?? null)
      fm.set(id, viewFieldMap({ visible: true, width: DEFAULT_FIELD_WIDTH, order, wrap: false }))
    })
  })
  return id
}

export function renameField(db: DbDocs, id: string, name: string) {
  assertWritable()
  const m = fieldsOf(db).get(id)
  if (m && m.get('name') !== name) m.set('name', name)
}

/** Merges type options key by key (each key is LWW). `undefined` removes a key. */
export function setFieldOptions(db: DbDocs, id: string, patch: FieldOptions) {
  assertWritable()
  const m = fieldsOf(db).get(id)
  const o = m?.get('options')
  if (!(o instanceof Y.Map)) return
  db.schema.transact(() => {
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) o.delete(k)
      else if (JSON.stringify(o.get(k)) !== JSON.stringify(v)) o.set(k, v)
    }
  })
}

export class PrimaryFieldError extends Error {
  constructor() {
    super('The primary field cannot be deleted or change type')
  }
}

/** Sets the stored type only; value conversion is `convertField` (M4-07). */
export function setFieldType(db: DbDocs, id: string, type: FieldType) {
  assertWritable()
  if (id === readDbMeta(db).primaryFieldId) throw new PrimaryFieldError()
  const m = fieldsOf(db).get(id)
  if (m && m.get('type') !== type) m.set('type', type)
}

/** Deletes a field, its view settings and its cells (DB-F02). The primary field cannot go (DB-F05). */
export function deleteField(db: DbDocs, id: string) {
  assertWritable()
  if (id === readDbMeta(db).primaryFieldId) throw new PrimaryFieldError()
  db.schema.transact(() => {
    fieldsOf(db).delete(id)
    dbViewsOf(db).forEach((vm) => {
      const fm = vm.get('fields')
      if (fm instanceof Y.Map) fm.delete(id)
      const calcs = vm.get('calcs')
      if (calcs instanceof Y.Map) calcs.delete(id)
      const sorts = vm.get('sorts')
      if (Array.isArray(sorts) && sorts.some((s: Sort) => s.fieldId === id))
        vm.set(
          'sorts',
          sorts.filter((s: Sort) => s.fieldId !== id),
        )
    })
  })
  for (const shard of db.shards)
    shard.transact(() =>
      rowsOf(shard).forEach((rm) => {
        const cells = rm.get('cells')
        if (cells instanceof Y.Map && cells.has(id)) cells.delete(id)
      }),
    )
}

/** Copies a field (and its cells) right after it in `viewId`. Returns the new id. */
export function duplicateField(db: DbDocs, id: string, name: string, viewId?: string): string | null {
  const src = getField(db, id)
  if (!src) return null
  const type = id === readDbMeta(db).primaryFieldId ? 'text' : src.type
  const copy = addField(db, { name, type, options: src.options, viewId, afterId: id })
  for (const shard of db.shards)
    shard.transact(() =>
      rowsOf(shard).forEach((rm) => {
        const cells = rm.get('cells')
        if (cells instanceof Y.Map && cells.has(id)) cells.set(copy, cells.get(id))
      }),
    )
  return copy
}

// ---------- view settings ----------

export function setViewField(db: DbDocs, viewId: string, fieldId: string, patch: Partial<ViewFieldSettings>) {
  assertWritable()
  const fm = dbViewsOf(db).get(viewId)?.get('fields')
  if (!(fm instanceof Y.Map)) return
  db.schema.transact(() => {
    let f = fm.get(fieldId)
    if (!(f instanceof Y.Map)) {
      const view = readViewSettings(db, viewId)!
      const last = Object.values(view.fields).reduce<string | null>(
        (m, s) => (m === null || s.order > m ? s.order : m),
        null,
      )
      f = viewFieldMap({ visible: true, width: DEFAULT_FIELD_WIDTH, order: keyBetween(last, null), wrap: false })
      fm.set(fieldId, f)
    }
    const map = f as YMap
    for (const [k, v] of Object.entries(patch)) if (map.get(k) !== v) map.set(k, v)
  })
}

/** Moves a field to `index` among the view's ordered fields (DB-F03). */
export function moveViewField(db: DbDocs, viewId: string, fieldId: string, index: number) {
  const view = readViewSettings(db, viewId)
  if (!view) return
  const rest = orderedFields(listFields(db), view).filter((f) => f.id !== fieldId)
  const keyOf = (f?: FieldMeta) => (f ? (view.fields[f.id]?.order ?? null) : null)
  const i = Math.max(0, Math.min(index, rest.length))
  setViewField(db, viewId, fieldId, { order: keyBetween(keyOf(rest[i - 1]), keyOf(rest[i])) })
}

type ViewPatch = Partial<{
  filter: FilterGroup | null
  sorts: Sort[]
  frozenColumns: number
  layout: DbLayout
  group: GroupSettings | null
  board: BoardSettings
  calendar: CalendarSettings | null
}>

/** Replaces whole small JSON settings (LWW, spec/02 §4.1). */
export function updateDbView(db: DbDocs, viewId: string, patch: ViewPatch) {
  assertWritable()
  const vm = dbViewsOf(db).get(viewId)
  if (!vm) return
  db.schema.transact(() => {
    for (const [k, v] of Object.entries(patch)) vm.set(k, v ?? null)
  })
}

export function setCalc(db: DbDocs, viewId: string, fieldId: string, calc: CalcType | null) {
  assertWritable()
  const calcs = dbViewsOf(db).get(viewId)?.get('calcs')
  if (!(calcs instanceof Y.Map)) return
  if (calc) calcs.set(fieldId, calc)
  else calcs.delete(fieldId)
}

// ---------- rows ----------

export interface AddRowOptions {
  /** Insert right after / before this row in manual order; default: at the end. */
  afterId?: string
  beforeId?: string
  cells?: Record<string, CellValue>
  id?: string
}

function rowKey(db: DbDocs, opts: { afterId?: string; beforeId?: string }, exclude?: string): string {
  const rows = listRows(db).filter((r) => r.id !== exclude)
  let i = rows.length
  if (opts.afterId) {
    const at = rows.findIndex((r) => r.id === opts.afterId)
    if (at >= 0) i = at + 1
  } else if (opts.beforeId) {
    const at = rows.findIndex((r) => r.id === opts.beforeId)
    if (at >= 0) i = at
  }
  const a = rows[i - 1]?.order || null
  if (a === null || !rows[i] || rows[i]!.order > a) return keyBetween(a, rows[i]?.order || null)
  // Equal keys (concurrent inserts) leave no room: re-key the following run of rows that
  // are not after `a`, so the new row lands exactly at position i (spec/02 §5).
  let j = i
  while (rows[j] && rows[j]!.order <= a) j++
  const keys = generateNKeysBetween(a, rows[j]?.order || null, j - i + 1)
  for (let k = i; k < j; k++) {
    const id = rows[k]!.id
    const m = rowMap(db, id)
    shardFor(db, id).transact(() => m?.set('order', keys[k - i + 1]))
  }
  return keys[0]!
}

export function addRow(db: DbDocs, opts: AddRowOptions = {}): string {
  assertWritable()
  const id = opts.id ?? newId()
  const order = rowKey(db, opts)
  const now = Date.now()
  const user = getCurrentUser()
  const shard = shardFor(db, id)
  shard.transact(() => {
    const m = new Y.Map<unknown>()
    m.set('order', order)
    const cells = new Y.Map<unknown>()
    for (const [k, v] of Object.entries(opts.cells ?? {})) if (v !== undefined) cells.set(k, v)
    m.set('cells', cells)
    m.set('icon', null)
    m.set('cover', null)
    m.set('hasDoc', false)
    m.set('createdAt', now)
    m.set('createdBy', user)
    m.set('updatedAt', now)
    m.set('updatedBy', user)
    rowsOf(shard).set(id, m)
  })
  return id
}

/**
 * Appends many rows at once (TSV paste, CSV import, QA seeds): one transaction per shard,
 * keys from a single `generateNKeysBetween`. Returns the new ids in order.
 */
export function addRows(db: DbDocs, cellsList: Record<string, CellValue>[], opts: { afterId?: string } = {}): string[] {
  assertWritable()
  if (!cellsList.length) return []
  const rows = listRows(db)
  let i = rows.length
  if (opts.afterId) {
    const at = rows.findIndex((r) => r.id === opts.afterId)
    if (at >= 0) i = at + 1
  }
  const a = rows[i - 1]?.order || null
  let b = rows[i]?.order || null
  if (a !== null && b !== null && a >= b) b = null // equal keys: append after them
  const keys = generateNKeysBetween(a, b, cellsList.length)
  const ids = cellsList.map(() => newId())
  const now = Date.now()
  const user = getCurrentUser()
  const byShard = new Map<Y.Doc, number[]>()
  ids.forEach((id, k) => {
    const s = shardFor(db, id)
    byShard.set(s, [...(byShard.get(s) ?? []), k])
  })
  for (const [shard, list] of byShard)
    shard.transact(() => {
      for (const k of list) {
        const m = new Y.Map<unknown>()
        m.set('order', keys[k])
        const cells = new Y.Map<unknown>()
        for (const [f, v] of Object.entries(cellsList[k]!)) if (v !== undefined && v !== null) cells.set(f, v)
        m.set('cells', cells)
        m.set('icon', null)
        m.set('cover', null)
        m.set('hasDoc', false)
        m.set('createdAt', now)
        m.set('createdBy', user)
        m.set('updatedAt', now)
        m.set('updatedBy', user)
        rowsOf(shard).set(ids[k]!, m)
      }
    })
  return ids
}

function touch(m: YMap) {
  m.set('updatedAt', Date.now())
  m.set('updatedBy', getCurrentUser())
}

/** Sets one cell (LWW per cell). `null`/`undefined` clears it. */
export function setCell(db: DbDocs, rowId: string, fieldId: string, value: CellValue | undefined) {
  assertWritable()
  const m = rowMap(db, rowId)
  const cells = m?.get('cells')
  if (!m || !(cells instanceof Y.Map)) return
  const cur = cells.get(fieldId)
  const empty = value === null || value === undefined
  if (empty ? !cells.has(fieldId) : JSON.stringify(cur) === JSON.stringify(value)) return
  shardFor(db, rowId).transact(() => {
    if (empty) cells.delete(fieldId)
    else cells.set(fieldId, value)
    touch(m)
  })
}

export type RowPatch = Partial<{ icon: IconValue | null; cover: CoverValue | null; hasDoc: boolean }>

export function updateRow(db: DbDocs, rowId: string, patch: RowPatch) {
  assertWritable()
  const m = rowMap(db, rowId)
  if (!m) return
  shardFor(db, rowId).transact(() => {
    for (const [k, v] of Object.entries(patch)) m.set(k, v ?? null)
    touch(m)
  })
}

export function deleteRows(db: DbDocs, ids: string[]) {
  assertWritable()
  const byShard = new Map<Y.Doc, string[]>()
  for (const id of ids) {
    const s = shardFor(db, id)
    byShard.set(s, [...(byShard.get(s) ?? []), id])
  }
  for (const [shard, list] of byShard) shard.transact(() => list.forEach((id) => rowsOf(shard).delete(id)))
}

/** Puts deleted rows back as they were (same ids, order, cells): undo of `deleteRows`. */
export function restoreRows(db: DbDocs, rows: RowSnapshot[]) {
  assertWritable()
  const byShard = new Map<Y.Doc, RowSnapshot[]>()
  for (const r of rows) {
    const s = shardFor(db, r.id)
    byShard.set(s, [...(byShard.get(s) ?? []), r])
  }
  for (const [shard, list] of byShard)
    shard.transact(() => {
      for (const r of list) {
        if (rowsOf(shard).has(r.id)) continue
        const m = new Y.Map<unknown>()
        m.set('order', r.order)
        const cells = new Y.Map<unknown>()
        for (const [k, v] of Object.entries(r.cells)) cells.set(k, v)
        m.set('cells', cells)
        m.set('icon', r.icon)
        m.set('cover', r.cover)
        m.set('hasDoc', r.hasDoc)
        m.set('createdAt', r.createdAt)
        m.set('createdBy', r.createdBy)
        m.set('updatedAt', r.updatedAt)
        m.set('updatedBy', r.updatedBy)
        rowsOf(shard).set(r.id, m)
      }
    })
}

/** Moves a row in manual order (DB-G03). */
export function moveRow(db: DbDocs, rowId: string, to: { afterId?: string; beforeId?: string }) {
  assertWritable()
  const m = rowMap(db, rowId)
  if (!m) return
  const order = rowKey(db, to, rowId)
  shardFor(db, rowId).transact(() => m.set('order', order))
}

/** Copies a row's cells, icon and cover right below it (DB-G02). Returns the new id. */
export function duplicateRow(db: DbDocs, rowId: string): string | null {
  const src = getRow(db, rowId)
  if (!src) return null
  const id = addRow(db, { afterId: rowId, cells: src.cells })
  if (src.icon || src.cover) updateRow(db, id, { icon: src.icon, cover: src.cover })
  return id
}
