import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { findMatches, matchAfter, type Match } from './find/find'

/** Find & replace state (ED-F07). Matches are recomputed when the query or document changes. */
export interface FindState {
  query: string
  caseSensitive: boolean
  matches: Match[]
  current: number
}

export const findKey = new PluginKey<FindState>('findReplace')
const EMPTY: FindState = { query: '', caseSensitive: false, matches: [], current: 0 }

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    findReplace: {
      setFind: (opts: { query?: string; caseSensitive?: boolean }) => ReturnType
      findStep: (dir: 1 | -1) => ReturnType
      replaceCurrent: (text: string) => ReturnType
      replaceAll: (text: string) => ReturnType
      clearFind: () => ReturnType
    }
  }
}

export const findStateOf = (state: Parameters<typeof findKey.getState>[0]) => findKey.getState(state) ?? EMPTY

export const FindReplace = Extension.create({
  name: 'findReplace',
  addCommands() {
    const select = (tr: Transaction, m: Match | undefined) =>
      m ? tr.setSelection(TextSelection.create(tr.doc, m.from, m.to)).scrollIntoView() : tr
    return {
      setFind:
        (opts) =>
        ({ tr, state, dispatch }) => {
          const prev = findStateOf(state)
          const query = opts.query ?? prev.query
          const caseSensitive = opts.caseSensitive ?? prev.caseSensitive
          const matches = findMatches(tr.doc, query, caseSensitive)
          const current = matchAfter(matches, state.selection.from)
          if (dispatch) select(tr.setMeta(findKey, { query, caseSensitive, matches, current }), matches[current])
          return true
        },
      findStep:
        (dir) =>
        ({ tr, state, dispatch }) => {
          const f = findStateOf(state)
          if (!f.matches.length) return false
          const current = (f.current + dir + f.matches.length) % f.matches.length
          if (dispatch) select(tr.setMeta(findKey, { ...f, current }), f.matches[current])
          return true
        },
      replaceCurrent:
        (text) =>
        ({ tr, state, dispatch }) => {
          const f = findStateOf(state)
          const m = f.matches[f.current]
          if (!m) return false
          if (dispatch) {
            tr.insertText(text, m.from, m.to).setMeta('wnUndoBoundary', true)
            const matches = findMatches(tr.doc, f.query, f.caseSensitive)
            const current = matchAfter(matches, m.from + text.length)
            select(tr.setMeta(findKey, { ...f, matches, current }), matches[current])
          }
          return true
        },
      replaceAll:
        (text) =>
        ({ tr, state, dispatch }) => {
          const f = findStateOf(state)
          if (!f.matches.length) return false
          if (dispatch) {
            for (const m of [...f.matches].reverse()) tr.insertText(text, m.from, m.to)
            tr.setMeta('wnUndoBoundary', true) // one undo step
            tr.setMeta(findKey, { ...f, matches: findMatches(tr.doc, f.query, f.caseSensitive), current: 0 })
          }
          return true
        },
      clearFind:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(findKey, EMPTY)
          return true
        },
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: () => EMPTY,
          apply: (tr, value) => {
            const meta = tr.getMeta(findKey) as FindState | undefined
            if (meta) return meta
            if (!tr.docChanged || !value.query) return value
            const matches = findMatches(tr.doc, value.query, value.caseSensitive)
            return { ...value, matches, current: Math.min(value.current, Math.max(0, matches.length - 1)) }
          },
        },
        props: {
          decorations(state) {
            const f = findKey.getState(state)
            if (!f?.matches.length) return null
            return DecorationSet.create(
              state.doc,
              f.matches.map((m, i) =>
                Decoration.inline(m.from, m.to, { class: i === f.current ? 'find-match is-current' : 'find-match' }),
              ),
            )
          },
        },
      }),
    ]
  },
})
