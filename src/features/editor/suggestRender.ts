import { ReactRenderer } from '@tiptap/react'
import type { PluginKey } from '@tiptap/pm/state'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import type { ComponentType, RefAttributes } from 'react'
import { exitOnOutsidePress, place } from './slash'

export interface ListHandle {
  onKeyDown: (e: KeyboardEvent) => boolean
}
export interface ListProps<T> {
  items: T[]
  command: (item: T) => void
}

/**
 * `render` for a Suggestion whose list hides itself when there are no items, so the
 * trigger character can be typed as plain text (e.g. `@` in an email, `:` in a time).
 */
export function hidingListRenderer<T>(
  Component: ComponentType<ListProps<T> & RefAttributes<ListHandle>>,
  key: PluginKey,
) {
  return () => {
    let renderer: ReactRenderer<ListHandle, ListProps<T>> | null = null
    let wrap: HTMLDivElement | null = null
    let stop: (() => void) | null = null
    const update = (props: SuggestionProps<T, T>) => {
      renderer?.updateProps(props)
      if (wrap) wrap.hidden = props.items.length === 0
      requestAnimationFrame(() => wrap && place(wrap, props.clientRect?.()))
    }
    return {
      onStart: (props: SuggestionProps<T, T>) => {
        renderer = new ReactRenderer(Component, { props, editor: props.editor })
        wrap = document.createElement('div')
        wrap.className = 'slash-wrap'
        wrap.appendChild(renderer.element)
        document.body.appendChild(wrap)
        stop = exitOnOutsidePress(wrap, props.editor.view, key)
        update(props)
      },
      onUpdate: update,
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (!wrap || wrap.hidden) return false
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
  }
}

/** Arrow / Enter / Tab handling shared by the suggestion lists. */
export function listKeys<T>(
  e: KeyboardEvent,
  items: T[],
  selected: number,
  setSelected: (fn: (s: number) => number) => void,
  command: (item: T) => void,
): boolean {
  if (!items.length) return false
  if (e.key === 'ArrowDown') setSelected((s) => (s + 1) % items.length)
  else if (e.key === 'ArrowUp') setSelected((s) => (s - 1 + items.length) % items.length)
  else if (e.key === 'Enter' || e.key === 'Tab') {
    const item = items[selected]
    if (item) command(item)
  } else return false
  return true
}
