/**
 * Stand-in for prosemirror-tables' `CellSelection` in @tiptap/extension-bubble-menu only
 * (M7-00, vite.config.ts): the bubble menu just asks `selection instanceof CellSelection`,
 * and importing the real class pulled all of prosemirror-tables (~20KB gzip) into the
 * editor chunk. A cell selection is recognised by its anchor / head cells; the real
 * library still loads with the table kit (`table/kit.ts`).
 */
export class CellSelection {
  static [Symbol.hasInstance](x: unknown): boolean {
    return !!x && typeof x === 'object' && '$anchorCell' in x && '$headCell' in x
  }
}
