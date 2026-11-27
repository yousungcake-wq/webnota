/**
 * CSV (RFC 4180) for database import/export (IO-03, IO-13, IO-04): comma-separated,
 * quoted fields may hold commas, quotes ("") and line breaks; a UTF-8 BOM is ignored.
 */
export function parseCSV(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let i = 0
  while (i < s.length) {
    const ch = s[i]!
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        quoted = false
      } else cell += ch
      i++
      continue
    }
    if (ch === '"' && cell === '') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      if (ch === '\r' && s[i + 1] === '\n') i++
    } else cell += ch
    i++
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

export function toCSV(rows: string[][]): string {
  const q = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  // BOM: Excel opens UTF-8 (Korean) correctly
  return '\uFEFF' + rows.map((r) => r.map(q).join(',')).join('\r\n') + '\r\n'
}
