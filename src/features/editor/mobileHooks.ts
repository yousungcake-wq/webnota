import type { Editor as TEditor } from '@tiptap/react'
import { useEffect, type RefObject } from 'react'
import { haptic } from '@/platform/haptics'

/** Space kept between the caret and the keyboard toolbar (px). */
const CARET_MARGIN = 24

/**
 * MB-24: keeps the caret above the on-screen keyboard and its toolbar. iOS doesn't
 * resize the layout viewport for the keyboard, so the browser's own scrolling can leave
 * the caret under it; we scroll the page container ourselves.
 */
export function useCaretAutoScroll(editor: TEditor | null, enabled: boolean) {
  useEffect(() => {
    if (!editor || !enabled) return
    let frame = 0
    const check = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!editor.isFocused || editor.isDestroyed) return
        const { head } = editor.state.selection
        let caret: { top: number; bottom: number }
        try {
          caret = editor.view.coordsAtPos(head)
        } catch {
          return
        }
        const vv = window.visualViewport
        const viewTop = vv?.offsetTop ?? 0
        const viewBottom = viewTop + (vv?.height ?? window.innerHeight)
        const toolbar = document.querySelector<HTMLElement>('.kb-toolbar')?.offsetHeight ?? 0
        const visibleBottom = viewBottom - toolbar - CARET_MARGIN
        const scroller = editor.view.dom.closest<HTMLElement>('.page-scroll')
        if (!scroller) return
        if (caret.bottom > visibleBottom) scroller.scrollBy({ top: caret.bottom - visibleBottom })
        else if (caret.top < viewTop + CARET_MARGIN + 48)
          scroller.scrollBy({ top: caret.top - viewTop - CARET_MARGIN - 48 })
      })
    }
    editor.on('selectionUpdate', check)
    editor.on('focus', check)
    window.visualViewport?.addEventListener('resize', check)
    return () => {
      cancelAnimationFrame(frame)
      editor.off('selectionUpdate', check)
      editor.off('focus', check)
      window.visualViewport?.removeEventListener('resize', check)
    }
  }, [editor, enabled])
}

const LONG_PRESS = 500
const SLOP = 8

/**
 * MB-23: a long press on a block (touch, while not typing) opens its block menu. While
 * the editor is focused, a long press is left to the OS for text selection; the
 * keyboard toolbar has a block menu button instead.
 */
export function useLongPressBlock(
  editor: TEditor | null,
  wrapRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  open: (pos: number, anchor: HTMLElement) => void,
) {
  useEffect(() => {
    const wrap = wrapRef.current
    if (!editor || !wrap || !enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let fired = false
    const cancel = () => clearTimeout(timer)
    const onDown = (e: PointerEvent) => {
      fired = false
      if (e.pointerType === 'mouse' || editor.isFocused || !editor.isEditable) return
      const target = e.target as HTMLElement
      if (!target.closest('.wn-editor') || target.closest('button, a, input')) return
      const x = e.clientX
      const y = e.clientY
      const move = (ev: PointerEvent) => {
        if (Math.hypot(ev.clientX - x, ev.clientY - y) > SLOP) cancel()
      }
      wrap.addEventListener('pointermove', move)
      timer = setTimeout(() => {
        wrap.removeEventListener('pointermove', move)
        const hit = editor.view.posAtCoords({ left: x, top: y })
        if (!hit) return
        const $pos = editor.state.doc.resolve(hit.pos)
        if ($pos.depth < 1) return
        const blockPos = $pos.before(1)
        const dom = editor.view.nodeDOM(blockPos)
        fired = true
        haptic()
        window.getSelection()?.removeAllRanges()
        open(blockPos, dom instanceof HTMLElement ? dom : wrap)
      }, LONG_PRESS)
      const up = () => {
        cancel()
        wrap.removeEventListener('pointermove', move)
      }
      wrap.addEventListener('pointerup', up, { once: true })
      wrap.addEventListener('pointercancel', up, { once: true })
    }
    // the OS menu / selection that a long press would bring up
    const onContextMenu = (e: Event) => {
      if (fired) e.preventDefault()
    }
    const onClick = (e: MouseEvent) => {
      if (fired) {
        e.preventDefault()
        e.stopPropagation()
        fired = false
      }
    }
    wrap.addEventListener('pointerdown', onDown)
    wrap.addEventListener('contextmenu', onContextMenu)
    wrap.addEventListener('click', onClick, true)
    return () => {
      cancel()
      wrap.removeEventListener('pointerdown', onDown)
      wrap.removeEventListener('contextmenu', onContextMenu)
      wrap.removeEventListener('click', onClick, true)
    }
  }, [editor, wrapRef, enabled, open])
}

/** MB-16: a tick when a task checkbox is toggled by touch. */
export function useCheckboxHaptic(wrapRef: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !enabled) return
    const onChange = (e: Event) => {
      if ((e.target as HTMLElement).matches('input[type="checkbox"]')) haptic()
    }
    wrap.addEventListener('change', onChange)
    return () => wrap.removeEventListener('change', onChange)
  }, [wrapRef, enabled])
}
