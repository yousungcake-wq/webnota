import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { ySyncPluginKey } from '@tiptap/y-tiptap'
import { lazy, Suspense } from 'react'
import { ws } from '@/core/docs/workspace'
import { getView, newId, restoreView, trashView } from '@/core/model/views'
import { createInlineDatabase, loadInlineDatabase } from '@/features/database'
import { DatabaseNode } from './nodes/database'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    database: {
      /** A new inline database of a layout (M5-10); the docs are created right after. */
      insertDatabase: (layout: 'grid' | 'board' | 'calendar') => ReturnType
      /** An empty block that asks which existing database to show. */
      insertLinkedDatabase: () => ReturnType
    }
  }
}

const InlineDatabase = lazy(loadInlineDatabase)

function databaseViewIds(doc: PMNode): Set<string> {
  const ids = new Set<string>()
  doc.descendants((n) => {
    if (n.type.name === 'database' && n.attrs.viewId) ids.add(n.attrs.viewId as string)
    return !n.isTextblock
  })
  return ids
}

function DatabaseNodeView(props: ReactNodeViewProps) {
  const { node, updateAttributes, editor, selected } = props
  const pageId = (props.extension.options as { pageId: string | null }).pageId
  return (
    <NodeViewWrapper
      className={`db-block${selected ? ' is-selected' : ''}`}
      data-drag-handle=""
      contentEditable={false}
    >
      <Suspense
        fallback={<div className="db-block-loading" style={{ height: (node.attrs.height as number) || 400 }} />}
      >
        <InlineDatabase
          viewId={node.attrs.viewId as string | null}
          height={node.attrs.height as number | null}
          pageId={pageId}
          readOnly={!editor.isEditable}
          onChange={(attrs: object) => updateAttributes(attrs as Record<string, unknown>)}
        />
      </Suspense>
    </NodeViewWrapper>
  )
}

/** Inline database block with its UI (the schema-only node stays React-free). */
export const DatabaseWithView = DatabaseNode.extend<{ pageId: string | null }>({
  addOptions() {
    return { pageId: null }
  },
  addNodeView() {
    // the database handles its own keys, clicks and drags: ProseMirror must not see them
    // (except dragging the block by the editor's handle, which starts outside it)
    return ReactNodeViewRenderer(DatabaseNodeView, {
      stopEvent: ({ event }) => !(event.type.startsWith('drag') || event.type === 'drop'),
      ignoreMutation: () => true,
    })
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('databaseTrash'),
        // Like sub-pages (M6-00): deleting an inline database block trashes its embedded view
        // (local edits only); a block that comes back restores it. Remote changes and Yjs
        // undo leave views alone — the block then offers "restore".
        appendTransaction: (trs, oldState, newState) => {
          if (!trs.some((tr) => tr.docChanged) || trs.some((tr) => tr.getMeta(ySyncPluginKey))) return null
          const before = databaseViewIds(oldState.doc)
          const after = databaseViewIds(newState.doc)
          for (const id of before) {
            const v = after.has(id) ? null : getView(ws(), id)
            if (v?.embedded && !v.deletedAt) trashView(ws(), id)
          }
          for (const id of after) {
            const v = before.has(id) ? null : getView(ws(), id)
            if (v?.embedded && v.deletedAt) restoreView(ws(), id)
          }
          return null
        },
      }),
    ]
  },
  addCommands() {
    return {
      insertDatabase:
        (layout) =>
        ({ commands }) => {
          const pageId = this.options.pageId
          if (!pageId) return false
          const viewId = newId()
          const databaseId = newId()
          // ids first, so the block and the docs agree even if the user keeps typing
          void createInlineDatabase({ viewId, databaseId, parentId: pageId, layout })
          return commands.insertContent([
            { type: this.name, attrs: { viewId, databaseId, layout } },
            { type: 'paragraph' },
          ])
        },
      insertLinkedDatabase:
        () =>
        ({ commands }) =>
          commands.insertContent([{ type: this.name }, { type: 'paragraph' }]),
    }
  },
})
