import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { getLang, t } from '@/core/i18n'
import { useAliveViews } from '@/core/store/views'
import { navigate } from '@/core/store/router'
import { ViewIcon } from '@/features/page'
import { useLayout } from '@/platform/layout'
import { Overlay } from '@/ui'
import { addDays, formatDate, isoDate, relativeDay } from './mention/dates'
import type { MentionAttrs } from './mention/mention'

const LOCALE = { ko: 'ko-KR', en: 'en-US' } as const

/** Display text of a date mention: today / tomorrow / yesterday, else a localized date. */
export function dateLabel(date: string | null, today = isoDate(new Date())): string {
  if (!date) return ''
  const rel = relativeDay(date, today)
  if (rel) return t(`mention.${rel}`)
  return formatDate(date, today, LOCALE[getLang()])
}

/** Chip for a mention node: live page title (deleted pages struck through) or a date. */
export function MentionChip({ node, updateAttributes, editor, selected }: ReactNodeViewProps) {
  const attrs = node.attrs as MentionAttrs
  return (
    <NodeViewWrapper as="span" className={`mention${selected ? ' is-selected' : ''}`} data-kind={attrs.kind}>
      {attrs.kind === 'date' ? (
        <DateChip date={attrs.date} editable={editor.isEditable} onChange={(date) => updateAttributes({ date })} />
      ) : (
        <PageChip id={attrs.viewId} />
      )}
    </NodeViewWrapper>
  )
}

function PageChip({ id }: { id: string | null }) {
  const { byId, alive } = useAliveViews()
  const view = id ? byId.get(id) : undefined
  const deleted = !view || !alive.includes(view)
  const title = view ? view.title.trim() || t('common.untitled') : t('mention.missing')
  return (
    <button
      type="button"
      className={`mention-page${deleted ? ' is-deleted' : ''}`}
      title={deleted && view ? t('mention.deleted') : title}
      onClick={() => view && navigate({ name: 'page', id: view.id })}
    >
      <span className="mention-icon" aria-hidden>
        <ViewIcon icon={view?.icon ?? null} size={14} />
      </span>
      <span className="mention-title">{title}</span>
    </button>
  )
}

function DateChip({
  date,
  editable,
  onChange,
}: {
  date: string | null
  editable: boolean
  onChange: (date: string) => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const open = anchor !== null
  const setOpen = (v: false) => setAnchor(v || null)
  const phone = useLayout().layout === 'phone'
  const today = isoDate(new Date())
  const pick = (d: string) => {
    onChange(d)
    setOpen(false)
  }
  return (
    <>
      <button
        type="button"
        className="mention-date"
        title={date ?? ''}
        onClick={(e) => editable && setAnchor(e.currentTarget)}
      >
        <CalendarDays size={14} aria-hidden />
        <span className="mention-title">{dateLabel(date, today)}</span>
      </button>
      {open && (
        <Overlay anchor={anchor} title={t('mention.date')} sheet={phone} onClose={() => setOpen(false)}>
          <div className="mention-date-picker">
            <input
              type="date"
              aria-label={t('mention.date')}
              defaultValue={date ?? today}
              // stays open while typing segment by segment; quick buttons / outside click close it
              onChange={(e) => e.target.value && onChange(e.target.value)}
            />
            <div className="mention-date-quick">
              <button type="button" className="btn" onClick={() => pick(today)}>
                {t('mention.today')}
              </button>
              <button type="button" className="btn" onClick={() => pick(addDays(today, 1))}>
                {t('mention.tomorrow')}
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </>
  )
}
