import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { migrateDoc, type Migration } from './migrate'

describe('migrateDoc: leftovers of already-applied migrations', () => {
  const fix: Migration = {
    version: 2,
    name: 'move-legacy',
    up(doc) {
      const legacy = doc.getMap('legacy')
      legacy.forEach((v, k) => doc.getMap('modern').set(k, v))
      legacy.forEach((_v, k) => legacy.delete(k))
    },
    leftover: (doc) => doc.getMap('legacy').size > 0,
  }

  it('re-runs an applied migration whose leftover() reports old data, atomically', () => {
    const doc = new Y.Doc()
    doc.getMap('meta').set('schemaVersion', 2)
    doc.getMap('legacy').set('k', 'v')
    const r = migrateDoc(doc, { migrations: [fix], appVersion: 2 })
    expect(r).toMatchObject({ status: 'migrated', applied: [2] })
    expect(doc.getMap('modern').get('k')).toBe('v')
    expect(migrateDoc(doc, { migrations: [fix], appVersion: 2 }).status).toBe('current')
  })

  it('never re-runs leftovers while the doc is newer than the app', () => {
    const doc = new Y.Doc()
    doc.getMap('meta').set('schemaVersion', 3)
    doc.getMap('legacy').set('k', 'v')
    expect(migrateDoc(doc, { migrations: [fix], appVersion: 2 }).status).toBe('newer')
    expect(doc.getMap('legacy').get('k')).toBe('v')
  })
})
