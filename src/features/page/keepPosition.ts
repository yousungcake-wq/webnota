import type { Editor as TEditor } from '@tiptap/react'

/**
 * Keeps the reading position when the page screen is rebuilt by a layout switch (MB-18,
 * M7-08) — a tablet's split screen crossing into the phone layout, a foldable folding:
 * the scroll offset, the selection and whether the editor had focus come back if the same
 * page opens again within a few seconds.
 */
const RECENT_MS = 4000
let kept: { id: string; top: number; from: number; to: number; focused: boolean; at: number } | null = null

export function keepPosition(id: string, scroller: HTMLElement | null, editor: TEditor | null) {
  if (!scroller) return
  const sel = editor && !editor.isDestroyed ? editor.state.selection : null
  kept = {
    id,
    top: scroller.scrollTop,
    from: sel?.from ?? 0,
    to: sel?.to ?? 0,
    focused: !!editor && !editor.isDestroyed && editor.isFocused,
    at: Date.now(),
  }
}

/** Restores a kept position for page `id` (call once the editor is ready). */
export function restorePosition(id: string, scroller: HTMLElement | null, editor: TEditor | null) {
  const k = kept
  if (!k || k.id !== id || Date.now() - k.at > RECENT_MS || !scroller) return
  kept = null
  if (editor && !editor.isDestroyed && k.to > 0) {
    const max = editor.state.doc.content.size
    const from = Math.min(k.from, max)
    const to = Math.min(k.to, max)
    editor.chain().setTextSelection({ from, to }).run()
    if (k.focused) editor.view.focus()
  }
  requestAnimationFrame(() => (scroller.scrollTop = k.top))
}
