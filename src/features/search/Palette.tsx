import { hangulIncludes } from '@/core/text/hangul'
import { FilePlus, Moon, Search, Settings, Sun, Trash2, type LucideIcon } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useId, useMemo, useRef, useState } from 'react'
import { t } from '@/core/i18n'
import { getTheme, setTheme } from '@/core/store/prefs'
import { href, navigate } from '@/core/store/router'
import { addPage } from '@/features/page'
import { useFocusTrap, useLayer } from '@/ui'
import { ResultItem } from './ResultItem'
import { useSearch } from './useSearch'
import './search.css'

interface Command {
  id: string
  label: string
  icon: LucideIcon
  run: () => void
}

/**
 * Command palette (WS-07, AppFlowy command_palette): pages by title and body, recent pages
 * when empty, and a few commands. ↑/↓ move, Enter opens, ⌘/Ctrl+Enter opens in a new tab.
 */
export default function Palette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const { query, results, byId, searched } = useSearch(q)
  const listId = useId()
  const ref = useRef<HTMLDivElement>(null)
  useLayer(onClose, { modal: true, history: true })
  useFocusTrap(ref)

  const commands = useMemo<Command[]>(() => {
    const dark =
      getTheme() === 'dark' || (getTheme() === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    const all: Command[] = [
      { id: 'new', label: t('common.newPage'), icon: FilePlus, run: () => addPage(null) },
      {
        id: 'theme',
        label: dark ? t('palette.lightMode') : t('palette.darkMode'),
        icon: dark ? Sun : Moon,
        run: () => setTheme(dark ? 'light' : 'dark'),
      },
      { id: 'settings', label: t('palette.openSettings'), icon: Settings, run: () => navigate({ name: 'settings' }) },
      { id: 'trash', label: t('palette.openTrash'), icon: Trash2, run: () => navigate({ name: 'trash' }) },
    ]
    return query ? all.filter((c) => hangulIncludes(c.label, query)) : []
  }, [query])

  const items = [
    ...results.map((h) => ({ kind: 'page' as const, hit: h })),
    ...commands.map((c) => ({ kind: 'cmd' as const, cmd: c })),
  ]
  const at = Math.min(active, Math.max(0, items.length - 1))

  const pick = (i: number, newTab = false) => {
    const item = items[i]
    if (!item) return
    onClose()
    if (item.kind === 'cmd') return item.cmd.run()
    if (newTab) window.open(`${location.pathname}${href({ name: 'page', id: item.hit.id })}`, '_blank')
    else navigate({ name: 'page', id: item.hit.id })
  }

  return createPortal(
    <div className="dialog-backdrop palette-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="palette" role="dialog" aria-modal="true" aria-label={t('common.search')}>
        <label className="search-box palette-input">
          <Search size={18} />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items.length ? `${listId}-${at}` : undefined}
            placeholder={t('palette.placeholder')}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, items.length - 1))
              else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
              else if (e.key === 'Enter') pick(at, e.metaKey || e.ctrlKey)
              else return
              e.preventDefault()
              requestAnimationFrame(() =>
                document.getElementById(`${listId}-${at}`)?.scrollIntoView({ block: 'nearest' }),
              )
            }}
          />
        </label>
        <div className="palette-head">
          {query ? t('search.results', { count: results.length }) : t('search.recent')}
        </div>
        <div id={listId} className="list palette-list" role="listbox">
          {items.map((item, i) =>
            item.kind === 'page' ? (
              <ResultItem
                key={item.hit.id}
                id={`${listId}-${i}`}
                hit={item.hit}
                view={byId.get(item.hit.id)!}
                byId={byId}
                active={i === at}
                onPick={(e) => {
                  e.preventDefault()
                  pick(i, e.metaKey || e.ctrlKey)
                }}
              />
            ) : (
              <button
                key={item.cmd.id}
                id={`${listId}-${i}`}
                type="button"
                role="option"
                aria-selected={i === at}
                className={`list-item${i === at ? ' is-active' : ''}`}
                onClick={() => pick(i)}
              >
                <span className="tree-icon">
                  <item.cmd.icon size={18} />
                </span>
                <span className="list-text">
                  <span className="list-title">{item.cmd.label}</span>
                </span>
              </button>
            ),
          )}
          {query && searched && !items.length && <p className="muted pad">{t('search.noResults')}</p>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
