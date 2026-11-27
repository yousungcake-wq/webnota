import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'
import { useEditorState, type Editor as TEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignHorizontalSpaceAround,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Paintbrush,
  Table2,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { t, type MessageKey } from '@/core/i18n'
import { Menu, type MenuEntry } from '@/ui'
import { PALETTE } from './nodes/colors'
import { TABLE_LAYOUTS, type TableLayout } from './nodes/table'

export const loadTableKit = () => import('./table/kit')

/** Whether a document contains a table (to load the table kit only when needed). */
export function hasTable(doc: PMNode): boolean {
  let found = false
  doc.descendants((n) => {
    if (found) return false
    if (n.type.name === 'table') found = true
    return !found && !n.isTextblock
  })
  return found
}

/** The table around the selection and whether its first row / column are headers. */
function tableInfo(state: EditorState) {
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type.name !== 'table') continue
    const isHeader = (n: PMNode | null | undefined) => n?.type.name === 'tableHeader'
    let row = true
    node.firstChild?.forEach((c) => (row &&= isHeader(c)))
    let col = true
    node.forEach((r) => (col &&= isHeader(r.firstChild)))
    return {
      headerRow: row,
      headerColumn: col,
      pos: $from.before(d),
      layout: (node.attrs.layout as TableLayout) ?? null,
    }
  }
  return null
}

const LAYOUT_LABEL = {
  left: 'table.posLeft',
  center: 'table.posCenter',
  right: 'table.posRight',
  full: 'table.posFull',
} as const

const isCellSelection = (state: EditorState) => '$anchorCell' in state.selection

/** Floating table button (ED-B16) → menu with rows, columns, headers, cell color and alignment. */
export function TableMenu({ editor }: { editor: TEditor }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const info = useEditorState({ editor, selector: ({ editor: e }) => (e ? tableInfo(e.state) : null) })
  const run = (fn: (kit: Awaited<ReturnType<typeof loadTableKit>>) => void) => {
    void loadTableKit().then((kit) => {
      fn(kit)
      editor.commands.focus()
    })
  }
  const cmd = (name: string) => () => run((kit) => kit.tableCommands[name]?.(editor.state, editor.view.dispatch))
  const cell = (attr: 'background' | 'align', value: string | null) => () =>
    run((kit) => kit.setCell(attr, value)(editor.state, editor.view.dispatch))

  const items: MenuEntry[] = [
    { label: t('table.rowAbove'), icon: ArrowUpToLine, onSelect: cmd('addRowBefore') },
    { label: t('table.rowBelow'), icon: ArrowDownToLine, onSelect: cmd('addRowAfter') },
    { label: t('table.colLeft'), icon: ArrowLeftToLine, onSelect: cmd('addColumnBefore') },
    { label: t('table.colRight'), icon: ArrowRightToLine, onSelect: cmd('addColumnAfter') },
    'separator',
    { label: t('table.headerRow'), checked: !!info?.headerRow, onSelect: cmd('toggleHeaderRow') },
    { label: t('table.headerColumn'), checked: !!info?.headerColumn, onSelect: cmd('toggleHeaderColumn') },
    {
      label: t('table.cellColor'),
      icon: Paintbrush,
      children: [null, ...PALETTE].map((c) => ({
        label: c ? t(`color.${c}` as MessageKey) : t('emoji.defaultColor'),
        onSelect: cell('background', c),
      })),
    },
    {
      label: t('table.align'),
      icon: AlignLeft,
      children: [
        { label: t('table.alignLeft'), icon: AlignLeft, onSelect: cell('align', null) },
        { label: t('table.alignCenter'), icon: AlignCenter, onSelect: cell('align', 'center') },
        { label: t('table.alignRight'), icon: AlignRight, onSelect: cell('align', 'right') },
      ],
    },
    {
      label: t('table.position'),
      icon: AlignHorizontalSpaceAround,
      children: TABLE_LAYOUTS.map((layout) => ({
        label: t(LAYOUT_LABEL[layout ?? 'left']),
        checked: (info?.layout ?? null) === layout,
        onSelect: () => {
          if (!info) return
          editor.view.dispatch(editor.state.tr.setNodeAttribute(info.pos, 'layout', layout))
          editor.commands.focus()
        },
      })),
    },
    'separator',
    { label: t('table.deleteRow'), icon: Trash2, danger: true, onSelect: cmd('deleteRow') },
    { label: t('table.deleteColumn'), icon: Trash2, danger: true, onSelect: cmd('deleteColumn') },
    { label: t('table.delete'), icon: Trash2, danger: true, onSelect: cmd('deleteTable') },
  ]

  return (
    <>
      <BubbleMenu
        editor={editor}
        pluginKey="tableMenu"
        className="bubble table-bubble"
        options={{ placement: 'top-start' }}
        shouldShow={({ editor: e, state }) =>
          e.isEditable && e.isActive('table') && (state.selection.empty || isCellSelection(state))
        }
      >
        <button
          type="button"
          className="fmt-btn"
          aria-label={t('table.menu')}
          title={t('table.menu')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          <Table2 size={16} />
        </button>
      </BubbleMenu>
      {anchor && <Menu anchor={anchor} title={t('table.menu')} items={items} onClose={() => setAnchor(null)} />}
    </>
  )
}

export { isCellSelection }
