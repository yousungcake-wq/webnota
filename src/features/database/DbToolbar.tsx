import {
  ArrowUpDown,
  CalendarDays,
  Filter as FilterIcon,
  KanbanSquare,
  LayoutList,
  ListChecks,
  MoreHorizontal,
  Upload,
  Search,
  Table2,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import type { FilterGroup } from '@/core/model/database'
import { useLayout } from '@/platform/layout'
import { Menu, Overlay } from '@/ui'
import { BoardPanel } from './BoardPanel'
import { CalendarPanel } from './CalendarPanel'
import { FilterPanel } from './FilterPanel'
import { dt } from './i18n'
import { PropsPanel } from './PropsPanel'
import type { DbSession, DbState } from './session'
import { SortPanel } from './SortPanel'

const countFilters = (g: FilterGroup | null): number =>
  g ? g.items.reduce((n, x) => n + ('items' in x ? countFilters(x) : 1), 0) : 0

/** Settings bar (DB-G07): filter, sort, properties, row search. */
export function DbToolbar({
  session,
  state,
  readOnly,
  cards,
  onToggleCards,
  onImportCsv,
}: {
  session: DbSession
  state: DbState
  readOnly: boolean
  /** Phones: card list on/off (MB-30); undefined hides the switch. */
  cards?: boolean
  onToggleCards?: () => void
  /** "Import CSV" in the database menu (M6-06). */
  onImportCsv?: (file: File) => void
}) {
  const phone = useLayout().layout === 'phone'
  const [open, setOpen] = useState<{
    panel: 'filter' | 'sort' | 'props' | 'board' | 'calendar'
    anchor: HTMLElement
  } | null>(null)
  const [searching, setSearching] = useState(state.search !== '')
  const [more, setMore] = useState<HTMLElement | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const view = state.view
  if (!view) return null
  const filters = countFilters(view.filter)
  const sorts = view.sorts.length
  const hidden = state.fields.filter((f) => view.fields[f.id]?.visible === false).length
  const button = (
    panel: 'filter' | 'sort' | 'props' | 'board' | 'calendar',
    Icon: typeof Search,
    label: string,
    count: number,
  ) => (
    <button
      type="button"
      className={`db-barbtn${count ? ' is-on' : ''}`}
      aria-haspopup="dialog"
      disabled={readOnly}
      onClick={(e) => setOpen({ panel, anchor: e.currentTarget })}
    >
      <Icon size={14} aria-hidden />
      <span>{count ? dt('db.bar.count', { label, count }) : label}</span>
    </button>
  )
  const titles = {
    filter: dt('db.bar.filter'),
    sort: dt('db.bar.sort'),
    props: dt('db.bar.props'),
    board: dt('db.board.settings'),
    calendar: dt('db.cal.settings'),
  }
  return (
    <div className="db-bar" role="toolbar" aria-label={dt('db.bar.filter') + ' · ' + dt('db.bar.sort')}>
      {searching ? (
        <span className="db-search">
          <Search size={14} aria-hidden />
          <input
            autoFocus
            className="db-search-input"
            placeholder={dt('db.bar.searchPlaceholder')}
            aria-label={dt('db.bar.search')}
            defaultValue={state.search}
            onChange={(e) => session.setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                session.setSearch('')
                setSearching(false)
              }
            }}
          />
          <button
            type="button"
            className="db-icon-btn"
            aria-label={dt('db.bar.searchClose')}
            onClick={() => {
              session.setSearch('')
              setSearching(false)
            }}
          >
            <X size={14} aria-hidden />
          </button>
        </span>
      ) : (
        <button type="button" className="db-barbtn" aria-label={dt('db.bar.search')} onClick={() => setSearching(true)}>
          <Search size={14} aria-hidden />
        </button>
      )}
      {button('filter', FilterIcon, dt('db.bar.filter'), filters)}
      {button('sort', ArrowUpDown, dt('db.bar.sort'), sorts)}
      {button('props', ListChecks, dt('db.bar.props'), hidden)}
      {view.layout === 'board' && button('board', KanbanSquare, dt('db.board.settings'), 0)}
      {view.layout === 'calendar' && button('calendar', CalendarDays, dt('db.cal.settings'), 0)}
      {cards !== undefined && (
        <button
          type="button"
          className="db-barbtn"
          aria-label={cards ? dt('db.view.table') : dt('db.view.cards')}
          title={cards ? dt('db.view.table') : dt('db.view.cards')}
          onClick={onToggleCards}
        >
          {cards ? <Table2 size={16} aria-hidden /> : <LayoutList size={16} aria-hidden />}
        </button>
      )}
      {onImportCsv && !readOnly && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv,.tsv,text/tab-separated-values"
            hidden
            onChange={(e) => {
              const f = e.currentTarget.files?.[0]
              e.currentTarget.value = ''
              if (f) onImportCsv(f)
            }}
          />
          <button
            type="button"
            className="db-barbtn"
            aria-label={dt('db.more')}
            title={dt('db.more')}
            aria-haspopup="menu"
            onClick={(e) => setMore(e.currentTarget)}
          >
            <MoreHorizontal size={16} aria-hidden />
          </button>
        </>
      )}
      {more && (
        <Menu
          anchor={more}
          title={dt('db.more')}
          onClose={() => setMore(null)}
          items={[{ label: dt('db.csv.importRows'), icon: Upload, onSelect: () => fileInput.current?.click() }]}
        />
      )}
      {open && (
        <Overlay anchor={open.anchor} title={titles[open.panel]} sheet={phone} onClose={() => setOpen(null)}>
          <div className="db-pop db-panel">
            {open.panel === 'filter' ? (
              <FilterPanel docs={state.docs} view={view} fields={state.fields} />
            ) : open.panel === 'calendar' ? (
              <CalendarPanel docs={state.docs} view={view} fields={state.fields} />
            ) : open.panel === 'board' ? (
              <BoardPanel docs={state.docs} view={view} fields={state.fields} />
            ) : open.panel === 'sort' ? (
              <SortPanel docs={state.docs} view={view} fields={state.fields} />
            ) : (
              <PropsPanel docs={state.docs} view={view} fields={state.fields} primaryId={state.meta.primaryFieldId} />
            )}
          </div>
        </Overlay>
      )}
    </div>
  )
}
