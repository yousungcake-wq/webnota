import { openDatabase } from '@/core/docs/database'
import { openDoc, pageDocName, retainDoc } from '@/core/docs/registry'
import { ws } from '@/core/docs/workspace'
import {
  addField,
  addRows,
  createDatabase,
  readDbMeta,
  updateDbView,
  updateGroup,
  type CellValue,
} from '@/core/model/database'
import { createView, getView, newId, updateView } from '@/core/model/views'
import { toggleExpanded } from '@/core/store/prefs'
import { navigate } from '@/core/store/router'
import { loadDocIO } from '@/features/editor'
import type { DbTemplate, DocTemplate, Template, TemplateCell } from './types'

const COLORS = ['gray', 'blue', 'green', 'orange', 'purple', 'pink', 'yellow']
const DAY = 86_400_000

async function writeDoc(viewId: string, json: DocTemplate['doc']) {
  const name = pageDocName(viewId)
  const release = retainDoc(name)
  try {
    const [doc, io] = await Promise.all([openDoc(name), loadDocIO()])
    const frag = doc.getXmlFragment('default')
    // an opened empty page holds one empty paragraph: replace it
    if (frag.length === 1 && frag.toJSON() === '<paragraph></paragraph>') doc.transact(() => frag.delete(0, 1))
    if (frag.length === 0) io.jsonIntoDoc(doc, json as Record<string, unknown>)
  } finally {
    release()
  }
}

async function createDb(t: DbTemplate, parentId: string | null, spaceId?: string): Promise<string> {
  const dbId = newId()
  const { docs, release } = await openDatabase(dbId)
  try {
    const { viewId } = createDatabase(ws(), docs, {
      dbId,
      parentId,
      spaceId,
      layout: t.layout,
      title: t.name,
      primaryName: t.primary,
    })
    updateView(ws(), viewId, { icon: { type: 'emoji', value: t.icon } })
    const ids = new Map<string, string>()
    const choices = new Map<string, Map<string, string>>()
    for (const f of t.fields) {
      const list = (f.choices ?? []).map((name, i) => ({ id: newId(), name, color: COLORS[i % COLORS.length]! }))
      choices.set(f.key, new Map(list.map((c) => [c.name, c.id])))
      ids.set(f.key, addField(docs, { name: f.name, type: f.type, options: list.length ? { choices: list } : {} }))
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const value = (key: string, v: TemplateCell): CellValue => {
      if (typeof v === 'object') return { start: today.getTime() + v.days * DAY, includeTime: false }
      return choices.get(key)?.get(String(v)) ?? v
    }
    const primary = readDbMeta(docs).primaryFieldId
    addRows(
      docs,
      t.rows.map((r) => {
        const cells: Record<string, CellValue> = {}
        for (const [k, v] of Object.entries(r)) {
          const id = k === 'title' ? primary : ids.get(k)
          if (id) cells[id] = k === 'title' ? String(v) : value(k, v)
        }
        return cells
      }),
    )
    const by = t.by ? ids.get(t.by) : undefined
    if (by && t.layout === 'board') updateGroup(docs, viewId, { fieldId: by })
    if (by && t.layout === 'calendar')
      updateDbView(docs, viewId, {
        calendar: { dateFieldId: by, firstDayOfWeek: 0, showWeekends: true, showWeekNumbers: false },
      })
    return viewId
  } finally {
    release()
  }
}

/** A new page or database from a template (M8-09), opened. */
export async function createFromTemplate(t: Template, parentId: string | null, spaceId?: string): Promise<string> {
  let viewId: string
  if (t.kind === 'database') viewId = await createDb(t, parentId, spaceId)
  else {
    viewId = createView(ws(), {
      parentId,
      spaceId,
      title: t.name,
      icon: { type: 'emoji', value: t.icon },
      kind: 'document',
    })
    await writeDoc(viewId, t.doc)
  }
  if (parentId) toggleExpanded(parentId, true)
  navigate({ name: 'page', id: viewId })
  return viewId
}

/** Fills an empty page with a document template (the empty-page picker); title and icon only if unset. */
export async function applyToPage(t: DocTemplate, viewId: string) {
  const view = getView(ws(), viewId)
  if (!view) return
  updateView(ws(), viewId, {
    ...(view.title ? {} : { title: t.name }),
    ...(view.icon ? {} : { icon: { type: 'emoji', value: t.icon } }),
  })
  await writeDoc(viewId, t.doc)
}
