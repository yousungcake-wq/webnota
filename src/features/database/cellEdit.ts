import {
  asNumber,
  asText,
  formatMinutes,
  normalizeUrl,
  parseDuration,
  parseNumber,
  type CellValue,
  type FieldMeta,
} from '@/core/model/database'

/** Field types edited as text in place (desktop) or in a sheet (phone). */
export const TEXT_EDITED = new Set(['text', 'number', 'url', 'time'])

/** Text shown in the editor when it opens on a cell. */
export function editText(field: FieldMeta, v: unknown): string {
  switch (field.type) {
    case 'number': {
      const n = asNumber(v)
      if (n === null) return ''
      return String(field.options.format === 'percent' ? Math.round(n * 1e10) / 1e8 : n)
    }
    case 'time': {
      const n = asNumber(v)
      return n === null ? '' : formatMinutes(n)
    }
    default:
      return asText(v)
  }
}

/**
 * The value to store for typed text. `undefined` = not understood (keep the old value);
 * `null` = clear the cell.
 */
export function parseEdit(field: FieldMeta, text: string): CellValue | undefined {
  if (text.trim() === '') return null
  switch (field.type) {
    case 'number':
      return parseNumber(text, field.options) ?? undefined
    case 'time':
      return parseDuration(text) ?? undefined
    case 'url':
      return normalizeUrl(text)
    case 'text':
      return text
    default:
      return undefined
  }
}
