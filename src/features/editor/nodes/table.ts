import { callOrReturn, getExtensionField, mergeAttributes, Node, type JSONContent } from '@tiptap/core'
import { colorAttrs, elementColor } from './colors'

/**
 * Simple table (ED-B16): header row/column, column widths, cell background and
 * alignment. Node specs only — prosemirror-tables (editing, column resizing, row and
 * column commands) is loaded on demand from `table/kit.ts`, keeping it out of the
 * editor chunk. Names and attributes match Tiptap's table so either can read the data.
 */

declare module '@tiptap/core' {
  interface NodeConfig {
    /** prosemirror-tables role (table, row, cell, header_cell). */
    tableRole?: string
  }
  interface Commands<ReturnType> {
    simpleTable: {
      /** Inserts a rows × cols table with a header row. */
      insertTable: (opts?: { rows?: number; cols?: number }) => ReturnType
    }
  }
}

const ALIGN = ['left', 'center', 'right']

function cellAttributes() {
  return {
    colspan: {
      default: 1,
      parseHTML: (el: HTMLElement) => Number(el.getAttribute('colspan') ?? 1) || 1,
    },
    rowspan: {
      default: 1,
      parseHTML: (el: HTMLElement) => Number(el.getAttribute('rowspan') ?? 1) || 1,
    },
    colwidth: {
      default: null,
      parseHTML: (el: HTMLElement) => {
        const w = el.getAttribute('data-colwidth')
        const list = w ? w.split(',').map((x) => Number(x)) : null
        return list?.every((n) => n > 0) ? list : null
      },
      renderHTML: (a: Record<string, unknown>) =>
        Array.isArray(a.colwidth) ? { 'data-colwidth': (a.colwidth as number[]).join(',') } : {},
    },
    background: {
      default: null,
      parseHTML: (el: HTMLElement) => elementColor(el, 'bg'),
      renderHTML: (a: Record<string, unknown>) => colorAttrs('bg', (a.background as string | null) ?? null),
    },
    align: {
      default: null,
      parseHTML: (el: HTMLElement) => {
        const v = el.style.textAlign || el.getAttribute('align')
        return v && ALIGN.includes(v) ? v : null
      },
      renderHTML: (a: Record<string, unknown>) => (a.align ? { 'data-align': a.align as string } : {}),
    },
  }
}

function spans(HTMLAttributes: Record<string, unknown>) {
  const out = { ...HTMLAttributes }
  if (out.colspan === 1) delete out.colspan
  if (out.rowspan === 1) delete out.rowspan
  return out
}

export const TableCell = Node.create({
  name: 'tableCell',
  content: 'block+',
  tableRole: 'cell',
  isolating: true,
  addAttributes: cellAttributes,
  parseHTML() {
    return [{ tag: 'td' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['td', spans(HTMLAttributes), 0]
  },
})

export const TableHeader = Node.create({
  name: 'tableHeader',
  content: 'block+',
  tableRole: 'header_cell',
  isolating: true,
  addAttributes: cellAttributes,
  parseHTML() {
    return [{ tag: 'th' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['th', spans(HTMLAttributes), 0]
  },
})

export const TableRow = Node.create({
  name: 'tableRow',
  content: '(tableCell | tableHeader)*',
  tableRole: 'row',
  parseHTML() {
    return [{ tag: 'tr' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['tr', HTMLAttributes, 0]
  },
})

export const Table = Node.create({
  name: 'table',
  group: 'block',
  content: 'tableRow+',
  tableRole: 'table',
  isolating: true,
  parseHTML() {
    return [{ tag: 'table' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    // Column widths from the first row (prosemirror-tables' TableView keeps them live once loaded).
    const cols: ['col', Record<string, string>][] = []
    node.firstChild?.forEach((cell) => {
      const widths = (cell.attrs.colwidth as number[] | null) ?? []
      for (let i = 0; i < ((cell.attrs.colspan as number) || 1); i++)
        cols.push(['col', widths[i] ? { style: `width: ${widths[i]}px` } : {}])
    })
    return [
      'div',
      { class: 'tableWrapper' },
      ['table', mergeAttributes(HTMLAttributes), ['colgroup', ...cols], ['tbody', 0]],
    ]
  },
  extendNodeSchema(extension) {
    const context = { name: extension.name, options: extension.options, storage: extension.storage }
    return { tableRole: callOrReturn(getExtensionField(extension, 'tableRole', context)) }
  },
  addCommands() {
    return {
      insertTable:
        ({ rows = 3, cols = 3 } = {}) =>
        ({ commands }) => {
          const cell = (header: boolean): JSONContent => ({
            type: header ? 'tableHeader' : 'tableCell',
            content: [{ type: 'paragraph' }],
          })
          const content: JSONContent = {
            type: 'table',
            content: Array.from({ length: rows }, (_, r) => ({
              type: 'tableRow',
              content: Array.from({ length: cols }, () => cell(r === 0)),
            })),
          }
          return commands.insertContent(content)
        },
    }
  },
})

export const TABLE_NODES = [Table, TableRow, TableHeader, TableCell]
