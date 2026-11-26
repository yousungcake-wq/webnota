// Loaded on demand (ED-B16): prosemirror-tables editing, column resizing and commands.
import { keymap } from '@tiptap/pm/keymap'
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

export function tablePlugins(): Plugin[] {
  return [
    columnResizing({ handleWidth: 5, cellMinWidth: 60, View: TableView, lastColumnResizable: true }),
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
