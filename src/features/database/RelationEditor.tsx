import { Check, Search } from 'lucide-react'
import { useState } from 'react'
import {
  listRows,
  readDbMeta,
  relationIds,
  relationTitles,
  setLinks,
  type DbDocs,
  type FieldMeta,
} from '@/core/model/database'
import { dt } from './i18n'
import { targetOf, useRelations } from './relationContext'

const LIMIT = 100

/**
 * Relation cell editor (M6-02, spec/05 §3.2): the linked rows on top (remove), then the
 * target database's rows to search and toggle. Popover on desktop, sheet on phones.
 */
export function RelationEditor({
  docs,
  field,
  rowId,
  value,
  readOnly,
}: {
  docs: DbDocs
  field: FieldMeta
  rowId: string
  value: unknown
  readOnly: boolean
}) {
  const rel = useRelations()
  const [q, setQ] = useState('')
  const targetId = rel ? targetOf(field, rel.dbId) : null
  const target = targetId && rel ? rel.target(targetId) : null
  if (!target) return <p className="db-empty">{dt('db.rel.loading')}</p>
  const ids = relationIds(value)
  const linked = new Set(ids)
  const primary = readDbMeta(target).primaryFieldId
  const query = q.trim().toLowerCase()
  const candidates = listRows(target)
    .filter((r) => r.id !== rowId || targetId !== rel!.dbId)
    .map((r) => ({ id: r.id, title: typeof r.cells[primary] === 'string' ? (r.cells[primary] as string) : '' }))
    .filter((r) => !query || r.title.toLowerCase().includes(query))
  const shown = candidates.slice(0, LIMIT)
  // through setLinks: a two-way relation updates the other side too (M6-03)
  const set = (next: string[]) => setLinks(docs, target, field.id, rowId, next)
  const toggle = (id: string) => set(linked.has(id) ? ids.filter((x) => x !== id) : [...ids, id])
  return (
    <div className="db-rel-editor">
      {ids.length > 0 && (
        <div className="db-rel-linked" aria-label={dt('db.rel.linked')}>
          {relationTitles(target, ids).map((r) => (
            <span key={r.id} className="db-rel-chip">
              {r.title || dt('db.row.untitled')}
              {!readOnly && (
                <button
                  type="button"
                  className="db-chip-x"
                  aria-label={dt('db.rel.unlink', { name: r.title || dt('db.row.untitled') })}
                  onClick={() => set(ids.filter((x) => x !== r.id))}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!readOnly && (
        <>
          <label className="db-search db-rel-search">
            <Search size={14} aria-hidden />
            <input
              className="db-search-input"
              autoFocus
              placeholder={dt('db.rel.search')}
              aria-label={dt('db.rel.search')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <div className="db-rel-list" role="listbox" aria-multiselectable="true" aria-label={field.name}>
            {!shown.length && <p className="db-empty">{dt('db.rel.none')}</p>}
            {shown.map((r) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={linked.has(r.id)}
                className="db-option db-rel-option"
                onClick={() => toggle(r.id)}
              >
                <span className="db-rel-check">{linked.has(r.id) && <Check size={14} aria-hidden />}</span>
                {r.title || dt('db.row.untitled')}
              </button>
            ))}
            {candidates.length > LIMIT && (
              <p className="db-empty">{dt('db.rel.more', { count: candidates.length - LIMIT })}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
