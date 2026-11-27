import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { exitSuggestion, type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { forwardRef, Fragment, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { CATEGORY_LABEL, filterBlocks, type BlockItem } from './blocks'
import { recentBlocks, recordBlockUse } from './rank'
import { t } from '@/core/i18n'

export interface SlashListHandle {
  onKeyDown: (e: KeyboardEvent) => boolean
}

interface SlashListProps {
  items: BlockItem[]
  command: (item: BlockItem) => void
  query?: string
}

export const SlashList = forwardRef<SlashListHandle, SlashListProps>(function SlashList(
  { items, command, query },
  ref,
) {
  const recent = query ? [] : recentBlocks().slice(0, 3)
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => setSelected(0), [items])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (!items.length) return false
      if (e.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % items.length)
        return true
      }
      if (e.key === 'ArrowUp') {
        setSelected((s) => (s - 1 + items.length) % items.length)
        return true
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const item = items[selected]
        if (item) command(item)
        return true
      }
      return false
    },
  }))

  if (!items.length) {
    return (
      <div className="slash-menu" role="listbox">
        <div className="slash-empty">{t('editor.noMatchingBlocks')}</div>
      </div>
    )
  }
  return (
    <div className="slash-menu" role="listbox" ref={listRef}>
      {items.map((item, i) => {
        const Icon = item.icon
        // Section headings when browsing (no query): recent, then each category.
        const section = query ? null : i < recent.length && recent.includes(item.id) ? 'recent' : item.category
        const prev = items[i - 1]
        const prevSection =
          !prev || query ? null : i - 1 < recent.length && recent.includes(prev.id) ? 'recent' : prev.category
        const heading = !query && (i === 0 || section !== prevSection)
        return (
          <Fragment key={item.id}>
            {heading && (
              <div className="slash-heading" role="presentation">
                {section === 'recent' ? t('block.cat.recent') : t(CATEGORY_LABEL[item.category])}
              </div>
            )}
            <button
              type="button"
              data-index={i}
              role="option"
              aria-selected={i === selected}
              className={`slash-item${i === selected ? ' is-selected' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setSelected(i)}
              onClick={() => command(item)}
            >
              <span className="slash-icon">
                <Icon size={18} />
              </span>
              <span className="slash-text">
                <span className="slash-title">{item.title}</span>
                <span className="slash-hint">{item.hint}</span>
              </span>
            </button>
          </Fragment>
        )
      })}
    </div>
  )
})

/** Positions a floating element under the caret, flipping above it when there's no room (e.g. above a phone keyboard). */
export function place(el: HTMLElement, rect: DOMRect | null | undefined) {
  if (!rect) return
  const vv = window.visualViewport
  const viewTop = vv?.offsetTop ?? 0
  const viewHeight = vv?.height ?? window.innerHeight
  const viewWidth = vv?.width ?? window.innerWidth
  const toolbar = document.querySelector<HTMLElement>('.kb-toolbar')?.offsetHeight ?? 0
  const h = el.offsetHeight
  const w = el.offsetWidth
  const spaceBelow = viewTop + viewHeight - toolbar - rect.bottom
  const top = spaceBelow >= h + 8 || rect.top - viewTop < h + 8 ? rect.bottom + 6 : rect.top - h - 6
  const left = Math.max(8, Math.min(rect.left, viewWidth - w - 8))
  el.style.top = `${Math.max(viewTop + 8, top)}px`
  el.style.left = `${left}px`
}

/**
 * A press outside the list ends the suggestion (feedback 2-7): the menu closes and the
 * typed `/…` stays as plain text, instead of the menu lingering or the click selecting
 * blocks. Returns the cleanup.
 */
export function exitOnOutsidePress(wrap: HTMLElement, view: EditorView, key: PluginKey): () => void {
  const onDown = (e: PointerEvent) => {
    if (wrap.contains(e.target as Node)) return
    exitSuggestion(view, key)
  }
  document.addEventListener('pointerdown', onDown, true)
  return () => document.removeEventListener('pointerdown', onDown, true)
}

export const slashPluginKey = new PluginKey('slash')

export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion<BlockItem, BlockItem>({
        editor: this.editor,
        pluginKey: slashPluginKey,
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        items: ({ query }) => filterBlocks(query),
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: BlockItem }) => {
          recordBlockUse(props.id)
          props.run(editor.chain().focus().deleteRange(range)).run()
        },
        render: () => {
          let renderer: ReactRenderer<SlashListHandle, SlashListProps> | null = null
          let wrap: HTMLDivElement | null = null
          let stop: (() => void) | null = null
          return {
            onStart: (props: SuggestionProps<BlockItem, BlockItem>) => {
              renderer = new ReactRenderer(SlashList, { props, editor: props.editor })
              wrap = document.createElement('div')
              wrap.className = 'slash-wrap'
              wrap.appendChild(renderer.element)
              document.body.appendChild(wrap)
              stop = exitOnOutsidePress(wrap, props.editor.view, slashPluginKey)
              requestAnimationFrame(() => wrap && place(wrap, props.clientRect?.()))
            },
            onUpdate: (props: SuggestionProps<BlockItem, BlockItem>) => {
              renderer?.updateProps(props)
              requestAnimationFrame(() => wrap && place(wrap, props.clientRect?.()))
            },
            onKeyDown: ({ event }: SuggestionKeyDownProps) => {
              if (event.key === 'Escape') return true // the plugin then exits
              return renderer?.ref?.onKeyDown(event) ?? false
            },
            onExit: () => {
              stop?.()
              stop = null
              wrap?.remove()
              renderer?.destroy()
              wrap = null
              renderer = null
            },
          }
        },
      }),
    ]
  },
})
