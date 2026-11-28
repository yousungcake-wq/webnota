import { mergeAttributes, Node } from '@tiptap/core'

/**
 * Inline database block (M5-10, ED-B20, spec/05 §8): an embedded database view inside the
 * page. `viewId` is a workspace view (embedded, child of the page), `databaseId` its
 * database, `layout` a hint for the placeholder, `height` the box height in px (null =
 * default 400). Schema only; the UI loads from `@/features/database` (`DatabaseBlock.tsx`).
 */
export const DatabaseNode = Node.create({
  name: 'database',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    const attr = (name: string, data: string) => ({
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute(data),
      renderHTML: (a: Record<string, unknown>) => (a[name] ? { [data]: String(a[name]) } : {}),
    })
    return {
      databaseId: attr('databaseId', 'data-database-id'),
      viewId: attr('viewId', 'data-view-id'),
      layout: attr('layout', 'data-layout'),
      height: {
        default: null,
        parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-height')) || null,
        renderHTML: (a: Record<string, unknown>) => (a.height ? { 'data-height': String(a.height) } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-database]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-database': '', class: 'db-block' }, HTMLAttributes)]
  },
})
