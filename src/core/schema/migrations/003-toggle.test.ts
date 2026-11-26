import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { migrateDoc } from '../migrate'
import { getSchemaVersion } from '../version'
import { v2Views } from './002-views'
import { v3Toggle } from './003-toggle'
import { v4Callout } from './004-callout'

describe('migrations 003/004: new node types only stamp the version', () => {
  it('only stamps the version (no data change beyond v2)', () => {
    const doc = new Y.Doc()
    doc.getMap('meta').set('schemaVersion', 2)
    doc.getMap('views').set('x', new Y.Map())
    const before = doc.getMap('views').toJSON()
    expect(migrateDoc(doc, { migrations: [v2Views, v3Toggle, v4Callout], appVersion: 4 }).applied).toEqual([3, 4])
    expect(getSchemaVersion(doc)).toBe(4)
    expect(doc.getMap('views').toJSON()).toEqual(before)
  })
})
