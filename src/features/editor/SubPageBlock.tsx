import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { ySyncPluginKey } from '@tiptap/y-tiptap'
import { ws } from '@/core/docs/workspace'
import { t } from '@/core/i18n'
import { createView, getView, listViews, restoreView, trashView } from '@/core/model/views'
import { toggleExpanded } from '@/core/store/prefs'
import { navigate } from '@/core/store/router'
import { useAliveViews } from '@/core/store/views'
import { ViewIcon } from '@/features/page'
import { SubPage } from './nodes/subPage'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    subPage: {
      /** Creates a child view of the current page and inserts its block (ED-B19). */
      insertSubPage: () => ReturnType
    }
  }
}

function subPageIds(doc: PMNode): Set<string> {
  const ids = new Set<string>()
  doc.descendants((n) => {
    if (n.type.name === 'subPage' && n.attrs.viewId) ids.add(n.attrs.viewId as string)
    return !n.isTextblock // sub-pages are never inside a paragraph
  })
  return ids
}

function SubPageView({ node, selected }: ReactNodeViewProps) {
  const id = node.attrs.viewId as string | null
  const { byId, alive } = useAliveViews()
  const view = id ? byId.get(id) : undefined
  const trashed = !!view && !alive.includes(view)
  const title = view ? view.title.trim() || t('common.untitled') : t('mention.missing')
  return (
    <NodeViewWrapper className={`sub-page${selected ? ' is-selected' : ''}${trashed || !view ? ' is-deleted' : ''}`}>
      <button
        type="button"
        className="sub-page-link"
        contentEditable={false}
        onClick={() => view && !trashed && navigate({ name: 'page', id: view.id })}
      >
        <span className="sub-page-icon" aria-hidden>
          <ViewIcon icon={view?.icon ?? null} size={18} />
        </span>
        <span className="sub-page-title">{title}</span>
      </button>
      {trashed && (
        <button type="button" className="sub-page-restore" onClick={() => restoreView(ws(), view.id)}>
          {t('subPage.restore')}
        </button>
      )}
    </NodeViewWrapper>
  )
}

/** Sub-page block with its UI (the schema-only `SubPage` stays usable without React). */
export const SubPageWithView = SubPage.extend<{ pageId: string | null }>({
  addOptions() {
    return { pageId: null }
  },
  addNodeView() {
    return ReactNodeViewRenderer(SubPageView)
  },
  addCommands() {
    return {
      insertSubPage:
        () =>
        ({ commands, dispatch }) => {
          const parentId = this.options.pageId
          if (!parentId || !getView(ws(), parentId)) return false
          if (!dispatch) return true // can() check: don't create a view
          const viewId = createView(ws(), { parentId })
          const ok = commands.insertContent({ type: this.name, attrs: { viewId } })
          if (!ok) return false
          toggleExpanded(parentId, true) // show the new child in the sidebar, like "add page"
          setTimeout(() => navigate({ name: 'page', id: viewId }))
          return true
        },
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('subPageTrash'),
        // Local edits only: removing the last block of a sub-page trashes the page;
        // a block that comes back (paste of a cut block) restores it. Remote changes and
        // Yjs undo arrive through y-sync and leave the views alone — the block then shows
        // a restore button instead.
        appendTransaction: (trs, oldState, newState) => {
          if (!trs.some((tr) => tr.docChanged) || trs.some((tr) => tr.getMeta(ySyncPluginKey))) return null
          const before = subPageIds(oldState.doc)
          const after = subPageIds(newState.doc)
          const views = new Map(listViews(ws()).map((v) => [v.id, v]))
          for (const id of before) if (!after.has(id) && views.get(id) && !views.get(id)!.deletedAt) trashView(ws(), id)
          for (const id of after) if (!before.has(id) && views.get(id)?.deletedAt) restoreView(ws(), id)
          return null
        },
      }),
    ]
  },
})
