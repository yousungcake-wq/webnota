import { describe, expect, it } from 'vitest'
import { parseCSV, toCSV } from './csv'

describe('CSV', () => {
  it('round-trips commas, quotes, line breaks and Korean', () => {
    const rows = [
      ['이름', '메모', '태그'],
      ['가, 나', 'say "hi"', 'line1\nline2'],
      ['', 'x', ''],
    ]
    expect(parseCSV(toCSV(rows))).toEqual(rows)
  })
  it('reads Notion exports (BOM, CRLF, trailing newline)', () => {
    expect(parseCSV('﻿Name,Tags\r\nA,"x, y"\r\nB,\r\n')).toEqual([
      ['Name', 'Tags'],
      ['A', 'x, y'],
      ['B', ''],
    ])
  })
})
