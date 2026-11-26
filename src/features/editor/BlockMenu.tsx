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
  PaintBucket,
  Repeat,
  Trash2,
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
  setBlockAttr,
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
}: {
  editor: TEditor
  pos: number
  pageId?: string
  anchor: HTMLElement | null
  onClose: () => void
}) {
  const node = editor.state.doc.nodeAt(pos)
  if (!node) return null
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
  if (node.type.name === 'columns') {
    items.push(
      'separator',
      {
        label: t('blockMenu.addColumn'),
        icon: Columns2,
        disabled: node.childCount >= MAX_COLUMNS,
        onSelect: () => apply(addColumn(editor.state, pos)),
      },
      {
        label: t('blockMenu.mergeColumn'),
        icon: Merge,
        disabled: node.childCount <= MIN_COLUMNS,
        onSelect: () => apply(mergeLastColumn(editor.state, pos)),
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
