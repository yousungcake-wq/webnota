import { Check, Copy, ExternalLink } from 'lucide-react'
import {
  asChecklist,
  asDate,
  asMedia,
  asNumber,
  choicesOf,
  formatDateValue,
  selectedIds,
  asText,
  cellText,
  formatDateTime,
  formatMinutes,
  formatNumber,
  isOpenableUrl,
  relationIds,
  relationTitles,
  type CellValue,
  type FieldMeta,
} from '@/core/model/database'
import { toast } from '@/ui'
import { Chip } from './Chip'
import { MediaThumb } from './MediaEditor'
import { dt } from './i18n'
import { appLocale } from './locale'
import { targetOf, useRelations } from './relationContext'

/** Read-only presentation of one cell (spec/05 §3.2). Editing is the grid's job. */
export function CellView({
  field,
  value,
  wrap,
  readOnly,
  onToggle,
}: {
  field: FieldMeta
  value: CellValue | undefined
  wrap: boolean
  readOnly: boolean
  onToggle: () => void
}) {
  switch (field.type) {
    case 'number': {
      const n = asNumber(value)
      return <span className="dbc-num">{n === null ? '' : formatNumber(n, field.options, appLocale())}</span>
    }
    case 'time': {
      const n = asNumber(value)
      return <span className="dbc-num">{n === null ? '' : formatMinutes(n)}</span>
    }
    case 'checkbox':
      return (
        <button
          type="button"
          role="checkbox"
          aria-checked={value === true}
          aria-label={field.name}
          className={`dbc-check${value === true ? ' is-on' : ''}`}
          disabled={readOnly}
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
        >
          {value === true && <Check size={14} strokeWidth={3} aria-hidden />}
        </button>
      )
    case 'url': {
      const url = asText(value)
      if (!url) return null
      return (
        <span className="dbc-url">
          <span className="dbc-url-text">{url}</span>
          <span className="dbc-actions">
            {isOpenableUrl(url) && (
              <a
                className="dbc-action"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={dt('db.url.open')}
                title={dt('db.url.open')}
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={14} aria-hidden />
              </a>
            )}
            <button
              type="button"
              className="dbc-action"
              aria-label={dt('db.url.copy')}
              title={dt('db.url.copy')}
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation()
                void navigator.clipboard?.writeText(url).then(() => toast(dt('db.copied')))
              }}
            >
              <Copy size={14} aria-hidden />
            </button>
          </span>
        </span>
      )
    }
    case 'createdTime':
    case 'updatedTime': {
      const n = asNumber(value)
      return <span className="dbc-muted">{n === null ? '' : formatDateTime(n, appLocale())}</span>
    }
    case 'select':
    case 'multiSelect': {
      const byId = new Map(choicesOf(field).map((c) => [c.id, c]))
      return (
        <span className={`dbc-chips${wrap ? ' is-wrap' : ''}`}>
          {selectedIds(field, value).map((id) => (
            <Chip key={id} choice={byId.get(id)!} />
          ))}
        </span>
      )
    }
    case 'relation':
      return <RelationChips field={field} value={value} wrap={wrap} />
    case 'date': {
      const d = asDate(value)
      return <span className="dbc-text">{d ? formatDateValue(d, field.options, appLocale()) : ''}</span>
    }
    case 'checklist': {
      const items = asChecklist(value)
      if (!items.length) return null
      const done = items.filter((i) => i.done).length
      return (
        <span className="dbc-progress" aria-label={dt('db.check.progress', { done, total: items.length })}>
          <span className="db-progress-bar">
            <span style={{ width: `${(done / items.length) * 100}%` }} />
          </span>
          <span className="dbc-muted">
            {done}/{items.length}
          </span>
        </span>
      )
    }
    case 'media': {
      const items = asMedia(value)
      return (
        <span className="dbc-chips">
          {items.map((it, i) => (
            <span key={`${it.fileId}-${i}`} className="dbc-media">
              <MediaThumb item={it} />
              {field.options.hideFileNames !== true && <span className="dbc-text">{it.name}</span>}
            </span>
          ))}
        </span>
      )
    }
    case 'text':
      return <span className={wrap ? 'dbc-text is-wrap' : 'dbc-text'}>{asText(value)}</span>
    default:
      return <span className="dbc-text">{cellText(field, value)}</span>
  }
}

/** Linked rows as chips (M6-02); a chip opens that row's page (DB-R05). */
function RelationChips({ field, value, wrap }: { field: FieldMeta; value: CellValue | undefined; wrap: boolean }) {
  const rel = useRelations()
  const ids = relationIds(value)
  if (!rel || !ids.length) return null
  const dbId = targetOf(field, rel.dbId)
  const target = rel.target(dbId)
  if (!target) return <span className="dbc-muted">…</span>
  return (
    <span className={`dbc-chips${wrap ? ' is-wrap' : ''}`}>
      {relationTitles(target, ids).map((r) => (
        <button
          key={r.id}
          type="button"
          className="db-rel-chip is-link"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation()
            rel.openTarget(dbId, r.id)
          }}
        >
          {r.title || dt('db.row.untitled')}
        </button>
      ))}
    </span>
  )
}
