import { TextSelection, type Transaction } from '@tiptap/pm/state'
import type { Editor as TEditor } from '@tiptap/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Baseline,
  Columns2,
  Copy,
  Link2,
  Merge,
  Languages,
  PaintBucket,
  Repeat,
  Trash2,
  Plus,
} from 'lucide-react'
import { t, type MessageKey } from '@/core/i18n'
import { newId } from '@/core/model/views'
import { href } from '@/core/store/router'
import { Menu, toast, type MenuEntry } from '@/ui'
import {
  addColumn,
  deleteBlock,
  duplicateBlock,
  ensureBlockId,
  mergeLastColumn,
  duplicateRange,
  setBlockAttr,
  setRangeAttr,
  supportsAttr,
} from './blockOps'
import { BLOCKS } from './blocks'
import { PALETTE } from './nodes/colors'
import { MAX_COLUMNS, MIN_COLUMNS } from './nodes/columns'
import { recordBlockUse } from './rank'

/** Link to a block of a page (ED-F15). */
export function blockLink(pageId: string, blockId: string): string {
  return location.href.split('#')[0] + href({ name: 'page', id: pageId, block: blockId })
}

/** Block menu (ED-F03) for the block at `pos`: from the drag handle (desktop) or a long press (phone, M2-20). */
export function BlockMenu({
  editor,
  pos,
  pageId,
  anchor,
  onClose,
  selection,
  onAddBelow,
}: {
  editor: TEditor
  /** "+" (insert a block below and open the slash menu): first item where the "+" button is hidden (feedback 2-8). */
  onAddBelow?: () => void
  pos: number
  pageId?: string
  anchor: HTMLElement | null
  onClose: () => void
  /** Several selected blocks (ED-F04): start positions, and the [from, to) range they cover. */
  selection?: { positions: number[]; from: number; to: number }
}) {
  const node = editor.state.doc.nodeAt(pos)
  if (!node) return null
  if (selection && selection.positions.length > 1)
    return <MultiBlockMenu editor={editor} selection={selection} anchor={anchor} onClose={onClose} />
  const apply = (tr: Transaction | null) => {
    if (tr) editor.view.dispatch(tr.scrollIntoView())
    editor.commands.focus()
  }
  const selectInside = () => {
    const { state } = editor
    editor.view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(pos + 1))))
  }
  const colorItems = (attr: 'textColor' | 'bgColor'): MenuEntry[] =>
    [null, ...PALETTE].map((c) => ({
      label: c ? t(`color.${c}` as MessageKey) : t('emoji.defaultColor'),
      checked: (node.attrs[attr] ?? null) === c,
      onSelect: () => apply(setBlockAttr(editor.state, pos, attr, c)),
    }))
  const align = (value: string | null, label: MessageKey, icon: typeof AlignLeft) => ({
    label: t(label),
    icon,
    checked: (node.attrs.textAlign ?? null) === value,
    onSelect: () => apply(setBlockAttr(editor.state, pos, 'textAlign', value)),
  })

  const items: MenuEntry[] = [
    ...(onAddBelow ? [{ label: t('editor.addBelow'), icon: Plus, onSelect: onAddBelow }, 'separator' as const] : []),
    {
      label: t('blockMenu.turnInto'),
      icon: Repeat,
      disabled:
        !node.isTextblock &&
        !['bulletList', 'orderedList', 'taskList', 'blockquote', 'toggle', 'callout'].includes(node.type.name),
      children: BLOCKS.filter((b) => b.turnInto).map((b) => ({
        label: b.title,
        icon: b.icon,
        onSelect: () => {
          selectInside()
          recordBlockUse(b.id)
          b.run(editor.chain().focus()).run()
        },
      })),
    },
    {
      label: t('blockMenu.color'),
      icon: Baseline,
      disabled: !supportsAttr(node, 'textColor'),
      children: colorItems('textColor'),
    },
    {
      label: t('blockMenu.background'),
      icon: PaintBucket,
      disabled: !supportsAttr(node, 'bgColor'),
      children: colorItems('bgColor'),
    },
    {
      label: t('table.align'),
      icon: AlignLeft,
      disabled: !supportsAttr(node, 'textAlign'),
      children: [
        align(null, 'table.alignLeft', AlignLeft),
        align('center', 'table.alignCenter', AlignCenter),
        align('right', 'table.alignRight', AlignRight),
      ],
    },
    {
      label: t('blockMenu.direction'),
      icon: Languages,
      disabled: !supportsAttr(node, 'dir'),
      children: (
        [
          [null, 'blockMenu.dirDefault'],
          ['auto', 'blockMenu.dirAuto'],
          ['ltr', 'blockMenu.dirLtr'],
          ['rtl', 'blockMenu.dirRtl'],
        ] as const
      ).map(([value, label]) => ({
        label: t(label),
        checked: (node.attrs.dir ?? null) === value,
        onSelect: () => apply(setBlockAttr(editor.state, pos, 'dir', value)),
      })),
    },
    'separator',
    {
      label: t('blockMenu.copyLink'),
      icon: Link2,
      disabled: !pageId || !('blockId' in node.attrs),
      onSelect: () => {
        const res = ensureBlockId(editor.state, pos, newId)
        if (!res || !pageId) return
        if (res.tr) editor.view.dispatch(res.tr)
        void navigator.clipboard
          .writeText(blockLink(pageId, res.id))
          .then(() => toast(t('blockMenu.linkCopied')))
          .catch(() => toast(t('page.linkCopyFailed'), { tone: 'error' }))
      },
    },
    { label: t('blockMenu.duplicate'), icon: Copy, onSelect: () => apply(duplicateBlock(editor.state, pos)) },
    {
      label: t('editor.moveUp'),
      icon: ArrowUp,
      onSelect: () => {
        selectInside()
        editor.chain().focus().moveBlockUp().run()
      },
    },
    {
      label: t('editor.moveDown'),
      icon: ArrowDown,
      onSelect: () => {
        selectInside()
        editor.chain().focus().moveBlockDown().run()
      },
    },
  ]
  // the columns block itself, or the columns around a block in a column
  const $pos = editor.state.doc.resolve(pos)
  const columnsPos =
    node.type.name === 'columns'
      ? pos
      : $pos.parent.type.name === 'column' && $pos.depth >= 2
        ? $pos.before($pos.depth - 1)
        : null
  const columns = columnsPos === null ? null : editor.state.doc.nodeAt(columnsPos)
  if (columns && columnsPos !== null) {
    items.push(
      'separator',
      {
        label: t('blockMenu.addColumn'),
        icon: Columns2,
        disabled: columns.childCount >= MAX_COLUMNS,
        onSelect: () => apply(addColumn(editor.state, columnsPos)),
      },
      {
        label: t('blockMenu.mergeColumn'),
        icon: Merge,
        disabled: columns.childCount <= MIN_COLUMNS,
        onSelect: () => apply(mergeLastColumn(editor.state, columnsPos)),
      },
    )
  }
  items.push('separator', {
    label: t('blockMenu.delete'),
    icon: Trash2,
    danger: true,
    onSelect: () => apply(deleteBlock(editor.state, pos)),
  })
  return <Menu anchor={anchor} title={t('blockMenu.title')} items={items} onClose={onClose} />
}

/** Block menu for several selected blocks: turn into, colors, duplicate, delete. */
function MultiBlockMenu({
  editor,
  selection,
  anchor,
  onClose,
}: {
  editor: TEditor
  selection: { positions: number[]; from: number; to: number }
  anchor: HTMLElement | null
  onClose: () => void
}) {
  const { positions, from, to } = selection
  const apply = (tr: Transaction | null) => {
    if (tr) editor.view.dispatch(tr.scrollIntoView())
    editor.commands.focus()
  }
  const colorItems = (attr: 'textColor' | 'bgColor'): MenuEntry[] =>
    [null, ...PALETTE].map((c) => ({
      label: c ? t(`color.${c}` as MessageKey) : t('emoji.defaultColor'),
      onSelect: () => apply(setRangeAttr(editor.state, positions, attr, c)),
    }))
  const items: MenuEntry[] = [
    {
      label: t('blockMenu.turnInto'),
      icon: Repeat,
      children: BLOCKS.filter((b) => b.turnInto && !b.id.startsWith('toggle') && b.id !== 'callout').map((b) => ({
        label: b.title,
        icon: b.icon,
        onSelect: () => {
          recordBlockUse(b.id)
          b.run(
            editor
              .chain()
              .focus()
              .setTextSelection({ from: from + 1, to: to - 1 }),
          ).run()
        },
      })),
    },
    { label: t('blockMenu.color'), icon: Baseline, children: colorItems('textColor') },
    { label: t('blockMenu.background'), icon: PaintBucket, children: colorItems('bgColor') },
    'separator',
    { label: t('blockMenu.duplicate'), icon: Copy, onSelect: () => apply(duplicateRange(editor.state, from, to)) },
    {
      label: t('blockMenu.delete'),
      icon: Trash2,
      danger: true,
      onSelect: () => apply(editor.state.tr.delete(from, to)),
    },
  ]
  return (
    <Menu anchor={anchor} title={t('blockMenu.titleMany', { n: positions.length })} items={items} onClose={onClose} />
  )
}
