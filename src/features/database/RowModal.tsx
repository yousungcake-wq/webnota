import {
  ChevronDown,
  ChevronUp,
  Copy,
  Link as LinkIcon,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as Y from 'yjs'
import { rowDocName } from '@/core/docs/database'
import { openDoc, retainDoc } from '@/core/docs/registry'
import { t } from '@/core/i18n'
import { duplicateRow, updateRow } from '@/core/model/database'
import { closeTo, href, navigate } from '@/core/store/router'
import { useLayout } from '@/platform/layout'
import { Menu, toast, useFocusTrap, useLayer, type MenuEntry } from '@/ui'
import { dt } from './i18n'
import { deleteRowsWithUndo } from './rowActions'
import { RowPage } from './RowPage'
import type { DbSession, DbState } from './session'

const FULL_KEY = 'webnota:row-full'
const readFull = () => {
  try {
    return localStorage.getItem(FULL_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Row page navigation (M5-09, DB-R04, MB-31): a centred modal on desktop (full screen on
 * request, remembered per device), full screen on phones. The row is in the route
 * (`#/w/:ws/v/:view/r/:row`), so links open it and back closes it. Previous / next follow
 * the view's order; the menu copies the link, duplicates (with its body) or deletes.
 */
export function RowModal({
  session,
  state,
  routeId,
  rowId,
  readOnly,
}: {
  session: DbSession
  state: DbState
  /** The page the row route belongs to: the view, or the document of an inline database. */
  routeId: string
  rowId: string
  readOnly: boolean
}) {
  const phone = useLayout().layout === 'phone'
  const [fullPref, setFullPref] = useState(readFull)
  const full = phone || fullPref
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const close = () => closeTo({ name: 'page', id: routeId })
  useLayer(close, { modal: true })
  useFocusTrap(ref)
  const ids = state.result.rowIds
  const index = ids.indexOf(rowId)
  const go = (delta: number) => {
    const next = ids[index + delta]
    if (next) navigate({ name: 'page', id: routeId, row: next }, { replace: true })
  }
  const toggleFull = () => {
    setFullPref(!fullPref)
    try {
      localStorage.setItem(FULL_KEY, fullPref ? '0' : '1')
    } catch {
      /* per-device convenience */
    }
  }
  const copyLink = () => {
    const url = location.origin + location.pathname + href({ name: 'page', id: routeId, row: rowId })
    navigator.clipboard.writeText(url).then(
      () => toast(t('page.linkCopied')),
      () => toast(t('page.linkCopyFailed'), { tone: 'error' }),
    )
  }
  const duplicate = async () => {
    const id = duplicateRow(state.docs, rowId)
    if (!id) return
    if (session.row(rowId)?.hasDoc) await copyBody(state.dbId, rowId, id)
    if (session.row(rowId)?.hasDoc) updateRow(state.docs, id, { hasDoc: true })
    navigate({ name: 'page', id: routeId, row: id }, { replace: true })
  }
  const items: MenuEntry[] = [
    { label: t('page.copyLink'), icon: LinkIcon, onSelect: copyLink },
    ...(readOnly
      ? []
      : ([
          { label: dt('db.row.duplicate'), icon: Copy, onSelect: () => void duplicate() },
          'separator',
          {
            label: dt('db.row.delete'),
            icon: Trash2,
            danger: true,
            onSelect: () => {
              deleteRowsWithUndo(state.docs, [rowId])
              close()
            },
          },
        ] as MenuEntry[])),
  ]
  return createPortal(
    <div
      className={`db-row-backdrop${full ? ' is-full' : ''}`}
      onPointerDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={dt('db.rowpage.label')}
        tabIndex={-1}
        className="db-row-modal"
      >
        <div className="db-row-bar">
          <button type="button" className="db-icon-btn" aria-label={dt('db.rowpage.close')} onClick={close}>
            <X size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="db-icon-btn"
            aria-label={dt('db.rowpage.prev')}
            disabled={index <= 0}
            onClick={() => go(-1)}
          >
            <ChevronUp size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="db-icon-btn"
            aria-label={dt('db.rowpage.next')}
            disabled={index < 0 || index >= ids.length - 1}
            onClick={() => go(1)}
          >
            <ChevronDown size={16} aria-hidden />
          </button>
          <span className="db-row-pos">{index >= 0 ? `${index + 1} / ${ids.length}` : ''}</span>
          {!phone && (
            <button
              type="button"
              className="db-icon-btn"
              aria-label={full ? dt('db.rowpage.center') : dt('db.rowpage.full')}
              title={full ? dt('db.rowpage.center') : dt('db.rowpage.full')}
              onClick={toggleFull}
            >
              {full ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
            </button>
          )}
          <button
            type="button"
            className="db-icon-btn"
            aria-label={dt('db.rowpage.more')}
            aria-haspopup="menu"
            onClick={(e) => setMenu(e.currentTarget)}
          >
            <MoreHorizontal size={16} aria-hidden />
          </button>
        </div>
        <div className="db-row-scroll">
          <RowPage key={rowId} session={session} state={state} rowId={rowId} readOnly={readOnly} />
        </div>
        {menu && <Menu anchor={menu} items={items} onClose={() => setMenu(null)} />}
      </div>
    </div>,
    document.body,
  )
}

/** Copies a row page body to another row (duplicate row). */
async function copyBody(dbId: string, from: string, to: string) {
  const a = rowDocName(dbId, from)
  const b = rowDocName(dbId, to)
  const ra = retainDoc(a)
  const rb = retainDoc(b)
  try {
    const [src, dst] = await Promise.all([openDoc(a), openDoc(b)])
    Y.applyUpdate(dst, Y.encodeStateAsUpdate(src))
  } finally {
    ra()
    rb()
  }
}
