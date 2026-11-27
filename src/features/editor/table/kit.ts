// Loaded on demand (ED-B16): prosemirror-tables editing, column resizing and commands.
import { keymap } from '@tiptap/pm/keymap'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Command, Plugin } from '@tiptap/pm/state'
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  columnResizing,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  setCellAttr,
  TableView,
  tableEditing,
  toggleHeader,
} from '@tiptap/pm/tables'

/** prosemirror-tables' view plus the table `layout` (left / center / right / full) on its wrapper. */
class LayoutTableView extends TableView {
  constructor(node: PMNode, cellMinWidth: number) {
    super(node, cellMinWidth)
    this.applyLayout(node)
  }
  override update(node: PMNode) {
    const ok = super.update(node)
    if (ok) this.applyLayout(node)
    return ok
  }
  private applyLayout(node: PMNode) {
    const layout = node.attrs.layout as string | null
    if (layout) this.dom.dataset.layout = layout
    else delete this.dom.dataset.layout
  }
}

export function tablePlugins(): Plugin[] {
  return [
    columnResizing({ handleWidth: 5, cellMinWidth: 60, View: LayoutTableView, lastColumnResizable: true }),
    tableEditing({ allowTableNodeSelection: false }),
    keymap({ Tab: goToNextCell(1), 'Shift-Tab': goToNextCell(-1) }),
  ]
}

export const tableCommands: Record<string, Command> = {
  addRowBefore,
  addRowAfter,
  addColumnBefore,
  addColumnAfter,
  deleteRow,
  deleteColumn,
  deleteTable,
  toggleHeaderRow: toggleHeader('row'),
  toggleHeaderColumn: toggleHeader('column'),
}

export const setCell = (name: 'background' | 'align', value: string | null): Command => setCellAttr(name, value)
