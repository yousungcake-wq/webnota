import { mergeAttributes, Node } from '@tiptap/core'

/**
 * Sub-page block (ED-B19): a child view of the page, shown inline. The view's title
 * and icon are looked up when rendering. Schema only (no React); the block UI, the
 * insert command and the "deleted block → trash" plugin are in `SubPageBlock.tsx`.
 */
export const SubPage = Node.create({
  name: 'subPage',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      viewId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-view-id'),
        renderHTML: (a) => (a.viewId ? { 'data-view-id': a.viewId as string } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-sub-page]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-sub-page': '', class: 'sub-page' }, HTMLAttributes)]
  },
})
