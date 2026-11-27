import { openDatabase } from '@/core/docs/database'
import { ws } from '@/core/docs/workspace'
import {
  addField,
  addRows,
  createDatabase,
  readDbMeta,
  type CellValue,
  type FieldType,
  type FieldOptions,
} from '@/core/model/database'
import { newId } from '@/core/model/views'

/**
 * QA (`webnota:debug=seed-db` / `seed-db-10k`): once, a "QA database" grid with every M4
 * field type (`rows` rows; `wide` adds fields up to 20 for the 10k benchmark, spec/05 §11).
 * Values are deterministic so screenshots and benchmarks repeat.
 */
export async function seedQaDatabase(opts: { rows: number; wide?: boolean; title: string }): Promise<string> {
  const dbId = newId()
  const { docs, release } = await openDatabase(dbId)
  try {
    const { viewId } = createDatabase(ws(), docs, { dbId, primaryName: 'Name', title: opts.title })
    const choices = ['Todo', 'Doing', 'Done', 'Blocked'].map((name, i) => ({
      id: `o${i}`,
      name,
      color: ['gray', 'blue', 'green', 'red'][i]!,
    }))
    const defs: [string, FieldType, FieldOptions?][] = [
      ['Amount', 'number', { format: 'currency', currency: 'KRW' }],
      ['Done', 'checkbox'],
      ['Status', 'select', { choices }],
      ['Tags', 'multiSelect', { choices }],
      ['Due', 'date'],
      ['Link', 'url'],
      ['Estimate', 'time'],
      ['Tasks', 'checklist'],
      ['Created', 'createdTime'],
      ['Updated', 'updatedTime'],
    ]
    if (opts.wide) for (let i = defs.length; i < 19; i++) defs.push([`Extra ${i}`, i % 2 ? 'number' : 'text'])
    const ids = defs.map(([name, type, options]) => addField(docs, { name, type, options, viewId }))
    const primary = readDbMeta(docs).primaryFieldId
    let seed = 7
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const day0 = new Date(2026, 10, 1).getTime()
    const rows: Record<string, CellValue>[] = []
    for (let r = 0; r < opts.rows; r++) {
      const cells: Record<string, CellValue> = { [primary]: `Item ${r + 1}` }
      defs.forEach(([, type], k) => {
        const id = ids[k]!
        if (rand() < 0.15) return // some empty cells
        if (type === 'number') cells[id] = Math.round(rand() * 100000)
        else if (type === 'checkbox') cells[id] = rand() < 0.4
        else if (type === 'select') cells[id] = `o${Math.floor(rand() * 4)}`
        else if (type === 'multiSelect') cells[id] = ['o0', 'o1', 'o2', 'o3'].filter(() => rand() < 0.4)
        else if (type === 'date') cells[id] = { start: day0 + Math.floor(rand() * 60) * 86_400_000, includeTime: false }
        else if (type === 'url') cells[id] = `https://example.com/${r}`
        else if (type === 'time') cells[id] = Math.round(rand() * 480)
        else if (type === 'checklist')
          cells[id] = [1, 2, 3].map((n) => ({ id: `c${n}`, name: `Step ${n}`, done: rand() < 0.5 }))
        else if (type === 'text') cells[id] = `Note ${Math.floor(rand() * 1000)}`
      })
      rows.push(cells)
    }
    for (let i = 0; i < rows.length; i += 1000) addRows(docs, rows.slice(i, i + 1000))
    return viewId
  } finally {
    release()
  }
}
