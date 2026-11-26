import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { checkRegistry, MIGRATION_ORIGIN, migrateDoc, type Migration } from './migrate'
import { MIGRATIONS } from './migrations'
import { getSchemaVersion, LEGACY_VERSION, SCHEMA_VERSION } from './version'

/** A v1 (PoC) workspace: `pages` map, no `meta`. */
function legacyWorkspace() {
  const doc = new Y.Doc()
  const m = new Y.Map<unknown>()
  m.set('title', 'Hello')
  doc.getMap('pages').set('p1', m)
  return doc
}

const setVersion = (doc: Y.Doc, v: unknown) => doc.getMap('meta').set('schemaVersion', v)

// Test migrations: v2 renames pages[*].title → name, v3 adds a flag.
const v2: Migration = {
  version: 2,
  name: 'rename-title',
  up(doc) {
    doc.getMap<Y.Map<unknown>>('pages').forEach((m) => {
      if (m.has('title')) {
        m.set('name', m.get('title'))
        m.delete('title')
      }
    })
  },
}
const v3: Migration = {
  version: 3,
  name: 'add-flag',
  up(doc) {
    doc.getMap('meta').set('flag', true)
  },
}

describe('getSchemaVersion', () => {
  it('treats a doc without meta.schemaVersion as the legacy PoC version', () => {
    expect(getSchemaVersion(legacyWorkspace())).toBe(LEGACY_VERSION)
    expect(getSchemaVersion(new Y.Doc())).toBe(LEGACY_VERSION)
  })

  it('returns NaN for values that are not a positive integer', () => {
    for (const bad of ['2', 0, -1, 1.5, null, true]) {
      const doc = new Y.Doc()
      setVersion(doc, bad)
      expect(getSchemaVersion(doc)).toBeNaN()
    }
  })
})

describe('checkRegistry', () => {
  it('accepts the app registry', () => {
    expect(() => checkRegistry(MIGRATIONS, SCHEMA_VERSION)).not.toThrow()
  })

  it('requires one migration per version from 2 up to the app version, in order', () => {
    expect(() => checkRegistry([v2, v3], 3)).not.toThrow()
    expect(() => checkRegistry([v3], 3)).toThrow(/version 2/)
    expect(() => checkRegistry([v3, v2], 3)).toThrow()
    expect(() => checkRegistry([v2], 3)).toThrow(/version 3/)
    expect(() => checkRegistry([v2, v3], 2)).toThrow(/newer than the app/)
  })
})

describe('migrateDoc', () => {
  it('leaves a current doc untouched', () => {
    const doc = legacyWorkspace()
    const before = Y.encodeStateAsUpdate(doc)
    const r = migrateDoc(doc, { migrations: [], appVersion: 1 })
    expect(r).toEqual({ status: 'current', docVersion: 1, appVersion: 1, applied: [] })
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
  })

  it('runs pending migrations in order and stamps each version', () => {
    const doc = legacyWorkspace()
    const r = migrateDoc(doc, { migrations: [v2, v3], appVersion: 3 })
    expect(r).toEqual({ status: 'migrated', docVersion: 1, appVersion: 3, applied: [2, 3] })
    expect(getSchemaVersion(doc)).toBe(3)
    const page = doc.getMap<Y.Map<unknown>>('pages').get('p1')!
    expect(page.get('name')).toBe('Hello')
    expect(page.has('title')).toBe(false)
    expect(doc.getMap('meta').get('flag')).toBe(true)
  })

  it('only runs migrations above the doc version', () => {
    const doc = legacyWorkspace()
    setVersion(doc, 2)
    const r = migrateDoc(doc, { migrations: [v2, v3], appVersion: 3 })
    expect(r.applied).toEqual([3])
    expect(doc.getMap<Y.Map<unknown>>('pages').get('p1')!.get('title')).toBe('Hello')
  })

  it('applies changes with the migration origin, one transaction per migration', () => {
    const doc = legacyWorkspace()
    const origins: unknown[] = []
    doc.on('update', (_u: Uint8Array, origin: unknown) => origins.push(origin))
    migrateDoc(doc, { migrations: [v2, v3], appVersion: 3 })
    expect(origins).toEqual([MIGRATION_ORIGIN, MIGRATION_ORIGIN])
  })

  it('opens a newer doc read-only without writing anything', () => {
    const doc = legacyWorkspace()
    setVersion(doc, 5)
    const before = Y.encodeStateAsUpdate(doc)
    const r = migrateDoc(doc, { migrations: [v2, v3], appVersion: 3 })
    expect(r).toEqual({ status: 'newer', docVersion: 5, appVersion: 3, applied: [] })
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
  })

  it('treats an unreadable version as newer (read-only, no writes)', () => {
    const doc = legacyWorkspace()
    setVersion(doc, 'garbage')
    const before = Y.encodeStateAsUpdate(doc)
    expect(migrateDoc(doc, { migrations: [v2, v3], appVersion: 3 }).status).toBe('newer')
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
  })

  it('is atomic: a throwing migration leaves the doc exactly as it was before that step', () => {
    const doc = legacyWorkspace()
    const broken: Migration = {
      version: 3,
      name: 'broken',
      up(d) {
        d.getMap('meta').set('half', 'done')
        d.getMap('pages').delete('p1')
        throw new Error('boom')
      },
    }
    const r = migrateDoc(doc, { migrations: [v2, broken], appVersion: 3 })
    expect(r.status).toBe('failed')
    expect(r.applied).toEqual([2])
    expect(r.error).toBeInstanceOf(Error)
    expect(getSchemaVersion(doc)).toBe(2) // v2 committed, v3 not
    expect(doc.getMap('meta').has('half')).toBe(false)
    expect(doc.getMap('pages').has('p1')).toBe(true)
  })

  it('migrated changes merge into another replica like any edit', () => {
    const a = legacyWorkspace()
    const b = new Y.Doc()
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    migrateDoc(a, { migrations: [v2], appVersion: 2 })
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    expect(getSchemaVersion(b)).toBe(2)
    expect(b.getMap<Y.Map<unknown>>('pages').get('p1')!.get('name')).toBe('Hello')
  })

  it('a second run is a no-op', () => {
    const doc = legacyWorkspace()
    migrateDoc(doc, { migrations: [v2, v3], appVersion: 3 })
    const before = Y.encodeStateAsUpdate(doc)
    expect(migrateDoc(doc, { migrations: [v2, v3], appVersion: 3 }).status).toBe('current')
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
  })
})
