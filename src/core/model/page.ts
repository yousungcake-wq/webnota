import type * as Y from 'yjs'
import { assertWritable } from './guard'

/**
 * Page-level settings in each `doc/<viewId>` (spec/02 §3): style (ED-F10) and cover
 * (ED-F11) in the `page` map, one key per field so concurrent changes merge.
 */

export type PageFont = 'default' | 'serif' | 'mono'
export type PageFontSize = 'small' | 'normal' | 'large'
export type PageLineHeight = 'compact' | 'normal' | 'relaxed'
export interface PageStyle {
  font: PageFont
  fontSize: PageFontSize
  lineHeight: PageLineHeight
  fullWidth: boolean
}
export const DEFAULT_PAGE_STYLE: PageStyle = {
  font: 'default',
  fontSize: 'normal',
  lineHeight: 'normal',
  fullWidth: false,
}

const FONTS: PageFont[] = ['default', 'serif', 'mono']
const SIZES: PageFontSize[] = ['small', 'normal', 'large']
const LINES: PageLineHeight[] = ['compact', 'normal', 'relaxed']

/** Cover: a palette color id, a gradient preset id, or an image URL (uploads: M3); offsetY 0–100 (%). */
export interface CoverValue {
  type: 'color' | 'gradient' | 'url' | 'file'
  value: string
  offsetY: number
}

const pageMap = (doc: Y.Doc) => doc.getMap<unknown>('page')
const pick = <T>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback)

export function readPageStyle(doc: Y.Doc): PageStyle {
  const m = pageMap(doc)
  return {
    font: pick(m.get('font'), FONTS, DEFAULT_PAGE_STYLE.font),
    fontSize: pick(m.get('fontSize'), SIZES, DEFAULT_PAGE_STYLE.fontSize),
    lineHeight: pick(m.get('lineHeight'), LINES, DEFAULT_PAGE_STYLE.lineHeight),
    fullWidth: m.get('fullWidth') === true,
  }
}

export function setPageStyle(doc: Y.Doc, patch: Partial<PageStyle>) {
  assertWritable()
  const m = pageMap(doc)
  doc.transact(() => {
    for (const [k, v] of Object.entries(patch)) if (m.get(k) !== v) m.set(k, v)
  })
}

const clamp = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50)

export function readCover(doc: Y.Doc): CoverValue | null {
  const c = pageMap(doc).get('cover') as Partial<CoverValue> | null | undefined
  if (!c || typeof c.value !== 'string' || !['color', 'gradient', 'url', 'file'].includes(c.type as string)) return null
  return { type: c.type as CoverValue['type'], value: c.value, offsetY: clamp(c.offsetY) }
}

export function setCover(doc: Y.Doc, cover: (Omit<CoverValue, 'offsetY'> & { offsetY?: number }) | null) {
  assertWritable()
  pageMap(doc).set('cover', cover ? { type: cover.type, value: cover.value, offsetY: clamp(cover.offsetY) } : null)
}
