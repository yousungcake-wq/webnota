import { describe, expect, it } from 'vitest'
import { parseTSV, pasteValue, toTSV } from './tsv'
import type { FieldMeta, FieldType, SelectChoice } from './types'

const F = (type: FieldType, options = {}): FieldMeta => ({ id: 'f', name: 'f', type, options, createdAt: 0 })

describe('TSV (DB-G04)', () => {
  it('round-trips values with tabs, newlines and quotes', () => {
    const rows = [
      ['a', 'b\tc', 'line1\nline2'],
      ['"quoted"', '', 'x'],
    ]
    const text = toTSV(rows)
    expect(text).toBe('a\t"b\tc"\t"line1\nline2"\n"""quoted"""\t\tx')
    expect(parseTSV(text)).toEqual(rows)
  })
  it('reads Excel / Google Sheets clipboard text (CRLF, trailing newline)', () => {
    expect(parseTSV('1\t2\r\n3\t4\r\n')).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
    expect(parseTSV('only')).toEqual([['only']])
    expect(parseTSV('')).toEqual([])
  })
  it('parses pasted text per field type', () => {
    const choices: SelectChoice[] = [{ id: 'x', name: 'Todo', color: 'gray' }]
    expect(pasteValue(F('number'), '1,234', [])).toBe(1234)
    expect(pasteValue(F('select'), 'Todo', choices)).toBe('x')
    expect(pasteValue(F('select'), 'New', choices)).toBe(choices[1]!.id)
    expect(pasteValue(F('checkbox'), 'TRUE', [])).toBe(true)
    expect(pasteValue(F('checkbox'), 'FALSE', [])).toBeUndefined()
    expect(pasteValue(F('time'), '1h', [])).toBe(60)
    expect(pasteValue(F('date'), '2026-01-02', [])).toEqual({
      start: new Date(2026, 0, 2).getTime(),
      includeTime: false,
    })
    expect(pasteValue(F('checklist'), 'a, b', [])).toMatchObject([{ name: 'a' }, { name: 'b' }])
    expect(pasteValue(F('createdTime'), 'x', [])).toBe(false)
    expect(pasteValue(F('text'), '', [])).toBeUndefined()
  })
})
