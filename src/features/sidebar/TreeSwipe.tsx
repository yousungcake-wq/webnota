import { Star, StarOff, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '@/core/i18n'
import { useViews } from '@/core/store/views'
import { moveToTrash, toggleFavorite } from '@/features/page'
import { haptic } from '@/platform/haptics'

const ACTION_W = 64
const WIDTH = ACTION_W * 2
const START = 10

interface Swiped {
  id: string
  li: HTMLElement
}

/**
 * Swipe a tree row left on phones (MB-13, M7-04, like AppFlowy's page item): favorite and
 * delete buttons appear behind it. A tap anywhere, a scroll or another swipe closes it.
 * Loaded on phones only (its own chunk); the gesture moves the row through the DOM and
 * React only renders the buttons.
 */
export default function TreeSwipe({ listRef }: { listRef: React.RefObject<HTMLElement | null> }) {
  const [open, setOpen] = useState<Swiped | null>(null)
  const views = useViews()

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    let current: Swiped | null = null // the open (or opening) row
    const rowOf = (s: Swiped | null) => s?.li.querySelector<HTMLElement>(':scope > .tree-row') ?? null
    const place = (s: Swiped | null, x: number, animate: boolean) => {
      const row = rowOf(s)
      if (!row) return
      row.style.transition = animate ? '' : 'none'
      row.style.transform = x ? `translateX(${x}px)` : ''
      row.classList.toggle('is-swiped', x !== 0)
    }
    const close = () => {
      if (!current) return
      place(current, 0, true)
      current = null
      setOpen(null)
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      const target = e.target as HTMLElement
      if (target.closest('.tree-swipe-actions')) return
      const li = target.closest<HTMLElement>('li[data-id]')
      if (!li || !list.contains(li) || target.closest('input')) return
      const x0 = e.clientX
      const y0 = e.clientY
      const wasOpen = current?.li === li
      const base = wasOpen ? -WIDTH : 0
      if (current && !wasOpen) close()
      let swiping = false
      let dx = 0
      const move = (ev: PointerEvent) => {
        dx = ev.clientX - x0
        const dy = ev.clientY - y0
        if (!swiping) {
          if (Math.abs(dy) > START && Math.abs(dy) > Math.abs(dx)) return stop() // a scroll
          if (Math.abs(dx) < START || Math.abs(dx) < Math.abs(dy) * 1.5) return
          swiping = true
          current = { id: li.dataset.id!, li }
          setOpen(current)
        }
        const x = Math.min(0, base + dx)
        // past the buttons the row resists
        place(current, x < -WIDTH ? -WIDTH + (x + WIDTH) / 3 : x, false)
      }
      const up = () => {
        stop()
        if (!swiping) {
          if (wasOpen) swallowClick() // a tap on the open row closes it
          if (wasOpen) close()
          return
        }
        swallowClick()
        if (base + dx < -WIDTH / 2) {
          if (!wasOpen) haptic()
          place(current, -WIDTH, true)
        } else close()
      }
      const stop = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', cancel)
      }
      const cancel = () => {
        stop()
        if (swiping) close()
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', cancel)
    }
    // a tap outside the list or a scroll closes the open row
    const onOutside = (e: PointerEvent) => {
      if (current && !list.contains(e.target as Node)) close()
    }
    const onScroll = () => close()
    list.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerdown', onOutside, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      list.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerdown', onOutside, true)
      window.removeEventListener('scroll', onScroll, true)
      place(current, 0, false)
    }
  }, [listRef])

  if (!open || !open.li.isConnected) return null
  const view = views.find((v) => v.id === open.id)
  if (!view) return null
  const done = () => {
    const row = open.li.querySelector<HTMLElement>(':scope > .tree-row')
    if (row) {
      row.style.transform = ''
      row.classList.remove('is-swiped')
    }
    setOpen(null)
  }
  return createPortal(
    <div className="tree-swipe-actions" style={{ width: WIDTH }}>
      <button
        type="button"
        className="tree-swipe-btn"
        aria-label={view.favorite ? t('page.favoriteRemove') : t('page.favoriteAdd')}
        {...press(() => {
          toggleFavorite(view.id)
          done()
        })}
      >
        {view.favorite ? <StarOff size={20} aria-hidden /> : <Star size={20} aria-hidden />}
      </button>
      <button
        type="button"
        className="tree-swipe-btn is-danger"
        aria-label={t('page.moveToTrash')}
        {...press(() => {
          done()
          moveToTrash(view.id)
        })}
      >
        <Trash2 size={20} aria-hidden />
      </button>
    </div>,
    open.li,
  )
}

/**
 * Acts on the finger's release: Chrome drops the click of a tap that follows a swipe
 * quickly (it reads it as stopping a fling). Keyboard clicks (detail 0) still work.
 */
const press = (run: () => void) => ({
  onPointerUp: (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') run()
  },
  onClick: (e: React.MouseEvent) => {
    if (e.detail === 0 || (e.nativeEvent as PointerEvent).pointerType === 'mouse') run()
  },
})

/** The release of a swipe must not open the page. */
function swallowClick() {
  const swallow = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const off = () => {
    window.removeEventListener('click', swallow, { capture: true })
    window.removeEventListener('pointerdown', off, { capture: true })
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  // only the click that follows this release: the next press is a new tap
  window.addEventListener('pointerdown', off, { capture: true, once: true })
  setTimeout(off, 400)
}
