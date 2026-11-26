import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { migrateDoc } from '../migrate'
import { getSchemaVersion } from '../version'
import { v2Views } from './002-views'
import { v3Toggle } from './003-toggle'
import { v4Callout } from './004-callout'
import { v5TextColor } from './005-text-color'
import { v6Mention } from './006-mention'
import { v7Scripts } from './007-scripts'
import { v8SubPage } from './008-sub-page'

describe('migrations 003–008: new node types only stamp the version', () => {
  it('only stamps the version (no data change beyond v2)', () => {
    const doc = new Y.Doc()
    doc.getMap('meta').set('schemaVersion', 2)
    doc.getMap('views').set('x', new Y.Map())
    const before = doc.getMap('views').toJSON()
    const migrations = [v2Views, v3Toggle, v4Callout, v5TextColor, v6Mention, v7Scripts, v8SubPage]
    expect(migrateDoc(doc, { migrations, appVersion: 8 }).applied).toEqual([3, 4, 5, 6, 7, 8])
    expect(getSchemaVersion(doc)).toBe(8)
    expect(doc.getMap('views').toJSON()).toEqual(before)
  })
})
