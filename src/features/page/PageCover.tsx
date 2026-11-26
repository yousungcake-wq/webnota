import { Image, MoveVertical, Trash2 } from 'lucide-react'
import { lazy, Suspense, useRef, useState } from 'react'
import type * as Y from 'yjs'
import { t } from '@/core/i18n'
import { setCover, type CoverValue } from '@/core/model/page'
import { coverBackground } from './pageMeta'

const CoverPicker = lazy(() => import('./pageStyleViews').then((m) => ({ default: m.CoverPicker })))

/** Page cover (ED-F11): color, gradient or image URL; change, reposition (drag), remove. */
export function PageCover({ doc, cover, readOnly }: { doc: Y.Doc; cover: CoverValue; readOnly: boolean }) {
  const [picker, setPicker] = useState<HTMLElement | null>(null)
  const [moving, setMoving] = useState<number | null>(null) // offsetY while repositioning
  const box = useRef<HTMLDivElement>(null)
  const offsetY = moving ?? cover.offsetY
  const image = cover.type === 'url' || cover.type === 'file'

  const onPointerDown = (e: React.PointerEvent) => {
    if (moving === null || !box.current) return
    if ((e.target as HTMLElement).closest('.cover-actions')) return // the save / cancel buttons
    e.preventDefault()
    const el = box.current
    el.setPointerCapture(e.pointerId)
    const startY = e.clientY
    const start = moving
    const height = el.getBoundingClientRect().height
    const onMove = (ev: PointerEvent) =>
      setMoving(Math.min(100, Math.max(0, start - ((ev.clientY - startY) / height) * 100)))
    const onUp = () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={box}
      className={`page-cover${moving !== null ? ' is-moving' : ''}`}
      style={{ background: coverBackground(cover) }}
      onPointerDown={onPointerDown}
    >
      {image && (
        <img
          src={cover.value}
          alt=""
          draggable={false}
          style={{ objectPosition: `50% ${offsetY}%` }}
          decoding="async"
        />
      )}
      {!readOnly && (
        <div className="cover-actions">
          {moving !== null ? (
            <>
              <button
                type="button"
                className="cover-btn"
                onClick={() => {
                  setCover(doc, { ...cover, offsetY: moving })
                  setMoving(null)
                }}
              >
                {t('cover.savePosition')}
              </button>
              <button type="button" className="cover-btn" onClick={() => setMoving(null)}>
                {t('common.cancel')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="cover-btn" onClick={(e) => setPicker(e.currentTarget)}>
                <Image size={14} /> {t('cover.change')}
              </button>
              {image && (
                <button type="button" className="cover-btn" onClick={() => setMoving(cover.offsetY)}>
                  <MoveVertical size={14} /> {t('cover.reposition')}
                </button>
              )}
              <button
                type="button"
                className="cover-btn"
                aria-label={t('cover.remove')}
                title={t('cover.remove')}
                onClick={() => setCover(doc, null)}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      )}
      {picker && (
        <Suspense fallback={null}>
          <CoverPicker doc={doc} anchor={picker} onClose={() => setPicker(null)} />
        </Suspense>
      )}
    </div>
  )
}
