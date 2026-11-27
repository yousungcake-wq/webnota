import { cellText } from './cells'
import { convertValue } from './convert'
import { parseDuration } from './format'
import { newId } from '../views'
import type { CellValue, ChecklistItem, FieldMeta, SelectChoice } from './types'

/**
 * Clipboard as TSV (DB-G04), compatible with Excel and Google Sheets: tab-separated,
 * CRLF/LF rows; a value containing a tab, newline or quote is quoted with doubled quotes.
 */
export function toTSV(rows: string[][]): string {
  const q = (v: string) => (/[\t\n\r"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return rows.map((r) => r.map(q).join('\t')).join('\n')
}

export function parseTSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let i = 0
  let quoted = false
  const s = text.replace(/\r\n?/g, '\n')
  while (i < s.length) {
    const ch = s[i]!
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"'
        i += 2
        continue
      }
      if (ch === '"') {
        quoted = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"' && cell === '') {
      quoted = true
      i++
    } else if (ch === '\t') {
      row.push(cell)
      cell = ''
      i++
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      i++
    } else {
      cell += ch
      i++
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/** Clipboard text of one cell. */
export const copyText = (field: FieldMeta, v: unknown) => cellText(field, v)

const TEXT: FieldMeta = { id: '', name: '', type: 'text', options: {}, createdAt: 0 }

/**
 * A pasted string as a value of `field` (same rules as converting text, spec/05 §3.4).
 * New select options are appended to `choices`. `undefined`: nothing to store (clear);
 * `null` is never returned — read-only types return `false` meaning "skip this cell".
 */
export function pasteValue(field: FieldMeta, text: string, choices: SelectChoice[]): CellValue | undefined | false {
  if (field.type === 'createdTime' || field.type === 'updatedTime' || field.type === 'rollup' || field.type === 'media')
    return false
  const s = text.trim()
  if (!s) return undefined
  switch (field.type) {
    case 'text':
      return text
    case 'time':
      return parseDuration(s) ?? undefined
    case 'checklist':
      return s
        .split(/\s*,\s*/)
        .filter(Boolean)
        .map((name): ChecklistItem => ({ id: newId(), name, done: false }))
    case 'checkbox':
      return convertValue(TEXT, 'checkbox', s, choices) // "FALSE" → unchecked (cleared)
    default:
      return convertValue(TEXT, field.type, s, choices)
  }
}
