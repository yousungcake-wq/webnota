import { mergeAttributes, Node } from '@tiptap/core'

/**
 * Inline mention (ED-I04, ED-I05): `kind=page` points at a view by id (its title is
 * looked up when rendering, so renames show everywhere); `kind=date` holds a local
 * `YYYY-MM-DD`. `reminder` is reserved for M10 (NT-02). Person mentions (ED-I09) will
 * use the same node with `kind=person`.
 *
 * This file is the schema only (no React): the chip UI is attached in `editorExtensions`.
 */
export interface MentionAttrs {
  kind: 'page' | 'date'
  viewId: string | null
  date: string | null
  reminder: string | null
}

/** Plain-text label for copy / export; set by the editor once the workspace is available. */
let labelOf: (attrs: MentionAttrs) => string = (a) => (a.kind === 'date' ? (a.date ?? '') : '')
export function setMentionLabeler(fn: (attrs: MentionAttrs) => string) {
  labelOf = fn
}

export const Mention = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    const data = (attr: string) => ({
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute(attr),
      renderHTML: () => ({}), // written together in renderHTML below
    })
    return {
      kind: { default: 'page', parseHTML: (el) => el.getAttribute('data-kind') ?? 'page', renderHTML: () => ({}) },
      viewId: data('data-view-id'),
      date: data('data-date'),
      reminder: data('data-reminder'),
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-mention]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as MentionAttrs
    const label = labelOf(attrs)
    const dom: Record<string, string> = { 'data-mention': '', class: 'mention', 'data-kind': attrs.kind }
    if (attrs.viewId) dom['data-view-id'] = attrs.viewId
    if (attrs.date) dom['data-date'] = attrs.date
    if (attrs.reminder) dom['data-reminder'] = attrs.reminder
    return ['span', mergeAttributes(HTMLAttributes, dom), attrs.kind === 'page' ? `@${label}` : label]
  },
  renderText({ node }) {
    const attrs = node.attrs as MentionAttrs
    return attrs.kind === 'page' ? `@${labelOf(attrs)}` : labelOf(attrs)
  },
})
