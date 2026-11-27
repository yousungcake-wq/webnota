import type { Editor as TEditor } from '@tiptap/react'
import { useEffect, useState, type RefObject } from 'react'

/** Top-level block index holding `pos`. */
const blockIndex = (editor: TEditor, pos: number) =>
  editor.state.doc.resolve(Math.min(Math.max(pos, 0), editor.state.doc.content.size)).index(0)

/**
 * "Grabbed" block (feedback 13): pressing a block's handle or dropping a dragged block
 * highlights that block (block mode) until the user clicks anywhere else — inside the
 * editor (selection moves), outside it, or presses Esc.
 */
export function grabBlock(editor: TEditor, pos: number) {
  // a block inside a column: select just that block (not the whole columns)
  if (editor.state.doc.resolve(Math.min(pos, editor.state.doc.content.size)).depth > 0) {
    editor.commands.setNodeSelection(pos)
    return
  }
  const i = blockIndex(editor, pos)
  editor.commands.selectBlocks(i, i)
}

export function useBlockGrab(editor: TEditor | null, wrapRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const dom = wrapRef.current
    if (!editor || !dom) return
    // after a handle drag the dropped block stays highlighted
    const onDrop = () =>
      setTimeout(() => {
        if (!editor.isDestroyed) grabBlock(editor, editor.state.selection.from)
      })
    // a press outside the editor (page margin, sidebar, a menu's backdrop) lets go
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || wrapRef.current?.contains(t)) return
      if (t.closest('.popover, .sheet, .dialog, [role="menu"]')) return
      if (!editor.isDestroyed) editor.commands.exitBlockSelection()
    }
    dom.addEventListener('drop', onDrop)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      dom.removeEventListener('drop', onDrop)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [editor, wrapRef])
}

/**
 * Touch screens (feedback 1): a block handle beside the block holding the caret, inside
 * the page's left padding where it can be seen and tapped (no "+": blocks are added from
 * the keyboard toolbar). Returns its top offset in the editor wrapper, or null when hidden.
 */
export function usePhoneHandle(editor: TEditor | null, wrapRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const [at, setAt] = useState<{ top: number; pos: number } | null>(null)
  useEffect(() => {
    if (!editor || !enabled) return
    const update = () => {
      const wrap = wrapRef.current
      const { $from } = editor.state.selection
      if (!wrap || (!editor.isFocused && wrap.querySelector('.wn-editor.block-mode') === null) || $from.depth < 1) {
        setAt(null)
        return
      }
      // inside a column the handle is for the block in the column (feedback 3)
      let depth = 1
      for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'column') depth = d + 1
      if ($from.depth < depth) depth = 1
      const pos = $from.before(depth)
      const node = editor.view.nodeDOM(pos) as HTMLElement | null
      if (!node?.getBoundingClientRect) return setAt(null)
      const top = node.getBoundingClientRect().top - wrap.getBoundingClientRect().top
      setAt((cur) => (cur && cur.top === top && cur.pos === pos ? cur : { top, pos }))
    }
    const later = () => setTimeout(update, 0)
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    editor.on('focus', update)
    editor.on('blur', later)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
      editor.off('focus', update)
      editor.off('blur', later)
    }
  }, [editor, wrapRef, enabled])
  return enabled ? at : null
}
