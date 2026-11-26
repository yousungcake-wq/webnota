import type * as Y from 'yjs'
import { readCover, readPageStyle, type CoverValue, type PageStyle } from '@/core/model/page'
import { useY } from '@/core/store/useY'

interface PageMeta {
  style: PageStyle
  cover: CoverValue | null
}
const select = (doc: Y.Doc): PageMeta => ({ style: readPageStyle(doc), cover: readCover(doc) })
const same = (a: PageMeta, b: PageMeta) => JSON.stringify(a) === JSON.stringify(b)

/** Style (ED-F10) and cover (ED-F11) of a page document, re-rendering only when they change. */
export const usePageMeta = (doc: Y.Doc): PageMeta => useY(doc, select, same)

/** Gradient cover presets (colors live in tokens.css as --cover-g1…). */
export const COVER_GRADIENTS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'] as const

/** CSS background for a color / gradient cover. */
export function coverBackground(cover: CoverValue): string | undefined {
  if (cover.type === 'color') return `var(--c-${cover.value}-text)`
  if (cover.type === 'gradient') return `var(--cover-${cover.value})`
  return undefined
}
