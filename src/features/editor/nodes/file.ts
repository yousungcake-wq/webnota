import { mergeAttributes, Node } from '@tiptap/core'

const FILE_ID = /^[0-9a-f]{64}\.[a-z0-9]{1,10}$/

/**
 * File attachment block (ED-B14, schema v15). Schema only; the UI is `FileBlock.tsx` +
 * the lazy `FileView.tsx`.
 * - `fileId`: workspace file (`files/<id>`, SY-04); null = empty block asking for a file
 * - `name`: file name shown and used for downloads; `size`: bytes; `mime`: content type
 */
export const FileAttachment = Node.create({
  name: 'file',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      fileId: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute('data-file')
          return v && FILE_ID.test(v) ? v : null
        },
        renderHTML: (a) => (a.fileId ? { 'data-file': a.fileId as string } : {}),
      },
      name: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-name') ?? el.textContent ?? '',
        renderHTML: (a) => (a.name ? { 'data-name': a.name as string } : {}),
      },
      size: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-size')) || 0,
        renderHTML: (a) => (a.size ? { 'data-size': String(a.size) } : {}),
      },
      mime: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-mime') ?? '',
        renderHTML: (a) => (a.mime ? { 'data-mime': a.mime as string } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-file-block]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes({ 'data-file-block': '', class: 'file-block' }, HTMLAttributes),
      (node.attrs.name as string) || 'file',
    ]
  },
})

/** "1.2 MB" style size (binary units, one decimal under 10). */
export function formatSize(bytes: number): string {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${i === 0 ? v : v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}
