import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { migrateDoc } from '../migrate'
import { getSchemaVersion, SCHEMA_VERSION } from '../version'
import { MIGRATIONS } from './index'

describe('migrations 003+: new node / mark types and attributes only stamp the version', () => {
  it('leaves the data as v2 left it', () => {
    const doc = new Y.Doc()
    doc.getMap('meta').set('schemaVersion', 2)
    doc.getMap('views').set('x', new Y.Map())
    const before = doc.getMap('views').toJSON()
    const stampOnly = MIGRATIONS.filter((m) => m.version >= 3)
    expect(migrateDoc(doc, { migrations: MIGRATIONS, appVersion: SCHEMA_VERSION }).applied).toEqual(
      stampOnly.map((m) => m.version),
    )
    expect(getSchemaVersion(doc)).toBe(SCHEMA_VERSION)
    expect(doc.getMap('views').toJSON()).toEqual(before)
  })
})
