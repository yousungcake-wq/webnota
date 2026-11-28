import { useEffect, useMemo, useState } from 'react'
import { CSV_TYPES, importCsv, planCsv, renameField, type CsvColumnPlan, type FieldType } from '@/core/model/database'
import { useLayout } from '@/platform/layout'
import { Button, Dialog, Sheet, Switch, toast } from '@/ui'
import { readCsv } from './csvEntry'
import { FIELD_TYPE_INFO } from './fieldTypes'
import { dt } from './i18n'
import type { DbState } from './session'

const PREVIEW_ROWS = 5
const NEW = '__new'
const SKIP = '__skip'

/**
 * CSV import preview (M6-06, DB-IO): the first rows, "first row is the header", and per
 * column what it becomes — the title, an existing field (by name), a new field of a type,
 * or skipped. A database created just for the file (`fresh`) takes the header's first name
 * for its title field and is removed again on cancel.
 */
export function CsvImportDialog({
  file,
  state,
  fresh,
  onClose,
}: {
  file: File
  state: DbState
  fresh: boolean
  onClose: (imported: boolean) => void
}) {
  const phone = useLayout().layout === 'phone'
  const [rows, setRows] = useState<string[][] | null>(null)
  const [error, setError] = useState(false)
  const [hasHeader, setHasHeader] = useState(true)
  // user changes per column index (null = skipped); cleared when the header choice changes
  const [edits, setEdits] = useState<Map<number, CsvColumnPlan | null>>(() => new Map())
  const fields = state.fields
  const primaryId = state.meta.primaryFieldId

  useEffect(() => {
    let alive = true
    readCsv(file).then(
      (r) => alive && setRows(r),
      () => alive && setError(true),
    )
    return () => {
      alive = false
    }
  }, [file])

  const header = useMemo(
    () =>
      rows ? (hasHeader ? (rows[0] ?? []) : (rows[0] ?? []).map((_, i) => `${dt('db.csv.column')} ${i + 1}`)) : [],
    [rows, hasHeader],
  )
  const records = useMemo(
    () => (rows ? (hasHeader ? rows.slice(1) : rows) : []).filter((r) => r.some((c) => c.trim())),
    [rows, hasHeader],
  )
  // the inferred plan; columns match existing fields by name
  const base = useMemo(
    () =>
      rows
        ? planCsv(header, records).map((p) => {
            if (p.index === 0) return p
            const same = fields.find((f) => f.name === p.name && f.id !== primaryId)
            return same && !fresh ? { ...p, fieldId: same.id, type: same.type } : p
          })
        : [],
    [rows, header, records, fields, primaryId, fresh],
  )
  const plan = base.map((p) => (edits.has(p.index) ? edits.get(p.index)! : p)).filter((p): p is CsvColumnPlan => !!p)
  const setCol = (index: number, next: CsvColumnPlan | null) => setEdits((m) => new Map(m).set(index, next))
  const skipped = header.map((_, i) => !plan.some((p) => p.index === i))
  const run = () => {
    if (fresh && plan.some((p) => p.fieldId === 'primary')) {
      const title = plan.find((p) => p.fieldId === 'primary')!
      if (title.name) renameField(state.docs, primaryId, title.name)
    }
    const n = importCsv(state.docs, records, plan)
    toast(dt('db.csv.done', { count: n }))
    onClose(true)
  }

  const body = (
    <div className="db-csv">
      {error && <p className="db-empty">{dt('db.csv.error')}</p>}
      {!rows && !error && <p className="db-empty">{dt('db.csv.reading')}</p>}
      {rows && (
        <>
          <Switch
            checked={hasHeader}
            label={dt('db.csv.header')}
            onChange={(on) => {
              setHasHeader(on)
              setEdits(new Map())
            }}
          />
          <p className="db-csv-count">{dt('db.csv.count', { rows: records.length, cols: header.length })}</p>
          <div className="db-csv-cols">
            {header.map((name, i) => {
              const p = plan.find((x) => x.index === i)
              const target = !p ? SKIP : p.fieldId === 'primary' ? 'primary' : (p.fieldId ?? NEW)
              const existing = p?.fieldId && p.fieldId !== 'primary' ? fields.find((f) => f.id === p.fieldId) : null
              return (
                <div key={i} className={`db-csv-col${skipped[i] ? ' is-skipped' : ''}`} data-col={i}>
                  <span className="db-csv-name" title={name}>
                    {name || `${dt('db.csv.column')} ${i + 1}`}
                  </span>
                  <select
                    className="db-input"
                    aria-label={dt('db.csv.into', { name: name || String(i + 1) })}
                    value={target}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === SKIP) return setCol(i, null)
                      const cur = p ?? base.find((x) => x.index === i)!
                      if (v === 'primary') {
                        const prev = plan.find((x) => x.fieldId === 'primary' && x.index !== i)
                        setEdits((m) => {
                          const n = new Map(m).set(i, { ...cur, fieldId: 'primary', type: 'text' })
                          return prev ? n.set(prev.index, { ...prev, fieldId: undefined }) : n
                        })
                      } else if (v === NEW) setCol(i, { ...cur, fieldId: undefined })
                      else {
                        const f = fields.find((x) => x.id === v)!
                        setCol(i, { ...cur, fieldId: f.id, type: f.type })
                      }
                    }}
                  >
                    <option value="primary">{dt('db.csv.asTitle')}</option>
                    <option value={NEW}>{dt('db.csv.asNew')}</option>
                    {!fresh &&
                      fields
                        .filter((f) => f.id !== primaryId)
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                    <option value={SKIP}>{dt('db.csv.skip')}</option>
                  </select>
                  {p && p.fieldId !== 'primary' && !existing && (
                    <select
                      className="db-input"
                      aria-label={dt('db.csv.type', { name: name || String(i + 1) })}
                      value={p.type}
                      onChange={(e) => setCol(i, { ...p, type: e.target.value as FieldType })}
                    >
                      {CSV_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {dt(FIELD_TYPE_INFO[t].label)}
                        </option>
                      ))}
                    </select>
                  )}
                  <span className="db-csv-sample">
                    {records
                      .slice(0, PREVIEW_ROWS)
                      .map((r) => r[i] ?? '')
                      .filter(Boolean)
                      .slice(0, 3)
                      .join(' · ')}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => onClose(false)}>
              {dt('db.csv.cancel')}
            </Button>
            <Button variant="primary" disabled={!records.length || !plan.length} onClick={run}>
              {dt('db.csv.import', { count: records.length })}
            </Button>
          </div>
        </>
      )}
    </div>
  )
  const title = dt('db.csv.title', { name: file.name })
  return phone ? (
    <Sheet title={title} onClose={() => onClose(false)}>
      {body}
    </Sheet>
  ) : (
    <Dialog title={title} onClose={() => onClose(false)} className="db-csv-dialog">
      {body}
    </Dialog>
  )
}
