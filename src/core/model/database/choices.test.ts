import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { addChoice, deleteChoice, moveChoice, nextColor, updateChoice } from './choices'
import { choicesOf, selectedIds } from './cells'
import { addField, createDatabase, getField, type DbDocs } from './model'
import { SHARD_COUNT } from './shard'

function setup() {
  const db: DbDocs = { schema: new Y.Doc(), shards: Array.from({ length: SHARD_COUNT }, () => new Y.Doc()) }
  createDatabase(new Y.Doc(), db, { dbId: 'd', primaryName: 'Name' })
  return { db, f: addField(db, { name: 'S', type: 'select' }) }
}

describe('select options (spec/05 §3.2)', () => {
  it('adds (deduping names, cycling colours), renames, recolours, reorders and deletes', () => {
    const { db, f } = setup()
    const a = addChoice(db, f, 'Todo')
    const b = addChoice(db, f, 'Done')
    expect(addChoice(db, f, 'Todo')).toBe(a)
    expect(choicesOf(getField(db, f)!).map((c) => c.color)).toEqual(['purple', 'pink'])
    updateChoice(db, f, a, { name: 'To do', color: 'blue' })
    moveChoice(db, f, b, 0)
    expect(choicesOf(getField(db, f)!)).toEqual([
      { id: b, name: 'Done', color: 'pink' },
      { id: a, name: 'To do', color: 'blue' },
    ])
    deleteChoice(db, f, b)
    expect(selectedIds(getField(db, f)!, b)).toEqual([])
    expect(nextColor(new Array(10).fill({}))).toBe('purple')
  })
})
