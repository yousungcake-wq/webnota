import { toCSV } from '@/core/io/csv'
import {
  asChecklist,
  asDate,
  cellOf,
  cellText,
  computeRollup,
  formatDateValue,
  listRows,
  orderedFields,
  relationIds,
  relationTitles,
  rollupRelation,
  type DbDocs,
  type FieldMeta,
  type RowSnapshot,
} from '@/core/model/database'
import { formatCalc } from './CalcRow'
import { appLocale } from './locale'
import { targetOf } from './relationContext'
import type { DbSession, DbState } from './session'

/**
 * CSV export (M6-07, IO-13): the current view (its filter, sort and visible fields) or the
 * whole database (every field, manual order). Values are what the cells show: option
 * names, dates in the field's format, linked titles, rollup results; numbers stay plain so
 * spreadsheets read them as numbers. UTF-8 with BOM (Excel).
 */
export function databaseCsv(session: DbSession, state: DbState, scope: 'view' | 'all'): string {
  const view = state.view
  const fields =
    scope === 'view' && view
      ? orderedFields(state.fields, view).filter((f) => view.fields[f.id]?.visible !== false)
      : state.fields
  const rows =
    scope === 'view'
      ? state.result.rowIds.map((id) => session.row(id)).filter((r): r is RowSnapshot => !!r)
      : listRows(state.docs)
  const target = (f: FieldMeta): DbDocs | null => session.target(targetOf(f, state.dbId))
  const value = (f: FieldMeta, row: RowSnapshot): string => {
    const v = cellOf(f, row)
    switch (f.type) {
      case 'checkbox':
        return v === true ? 'Yes' : 'No'
      case 'date': {
        const d = asDate(v)
        return d ? formatDateValue(d, f.options, appLocale()) : ''
      }
      case 'checklist':
        return asChecklist(v)
          .map((i) => `${i.done ? '[x]' : '[ ]'} ${i.name}`)
          .join(', ')
      case 'relation': {
        const t = target(f)
        return t
          ? relationTitles(t, relationIds(v))
              .map((x) => x.title)
              .join(', ')
          : ''
      }
      case 'rollup': {
        const rel = rollupRelation(f, state.fields)
        const r = rel ? computeRollup(f, row, state.fields, target(rel)) : null
        return !r ? '' : r.kind === 'list' ? r.items.join(', ') : formatCalc(r.field, r.result)
      }
      default:
        return cellText(f, v)
    }
  }
  return toCSV([fields.map((f) => f.name), ...rows.map((r) => fields.map((f) => value(f, r)))])
}

/** Saves a CSV: the share sheet on phones that can share files, else a download. */
export async function saveCsv(csv: string, name: string) {
  const file = new File([csv], `${name.replace(/[\\/:*?"<>|]/g, '_') || 'database'}.csv`, { type: 'text/csv' })
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (nav.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await nav.share({ files: [file], title: file.name })
      return
    } catch {
      /* cancelled or refused: fall back to a download */
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
