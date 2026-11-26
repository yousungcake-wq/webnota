import { afterEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createPage, listPages, ReadOnlyError, updatePage } from '../model/pages'
import { v2Views } from './migrations/002-views'
import { initSchema, isReadOnly, resetSchemaGate, schemaStore } from './gate'

afterEach(() => resetSchemaGate())

describe('schema gate', () => {
  it('is writable for a current doc', () => {
    const doc = new Y.Doc()
    initSchema(doc, { migrations: [], appVersion: 1 })
    expect(schemaStore.get().status).toBe('current')
    expect(isReadOnly()).toBe(false)
    expect(() => createPage(doc, { title: 'ok' })).not.toThrow()
  })

  it('goes read-only for a newer doc and model mutations throw ReadOnlyError', () => {
    const doc = new Y.Doc()
    const id = createPage(doc, { title: 'before' })
    doc.getMap('meta').set('schemaVersion', 9)
    initSchema(doc, { migrations: [], appVersion: 1 })
    expect(schemaStore.get()).toMatchObject({ status: 'newer', readOnly: true, docVersion: 9, appVersion: 1 })
    expect(() => createPage(doc, { title: 'x' })).toThrow(ReadOnlyError)
    expect(() => updatePage(doc, id, { title: 'x' })).toThrow(ReadOnlyError)
  })

  it('switches to read-only when a newer version arrives from another device', () => {
    const doc = new Y.Doc()
    initSchema(doc, { migrations: [], appVersion: 1 })
    expect(isReadOnly()).toBe(false)

    const remote = new Y.Doc()
    remote.getMap('meta').set('schemaVersion', 2)
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote), 'remote')
    expect(isReadOnly()).toBe(true) // synchronously, before the sync engine pushes
    expect(schemaStore.get().docVersion).toBe(2)
  })

  it('goes read-only when a migration fails', () => {
    const doc = new Y.Doc()
    const broken = {
      version: 2,
      name: 'broken',
      up() {
        throw new Error('nope')
      },
    }
    initSchema(doc, { migrations: [broken], appVersion: 2 })
    expect(schemaStore.get()).toMatchObject({ status: 'failed', readOnly: true })
  })

  it('converts legacy data merged in after boot (new device, first sync)', async () => {
    const doc = new Y.Doc()
    initSchema(doc, { migrations: [v2Views], appVersion: 2 })
    const remote = new Y.Doc()
    const m = new Y.Map<unknown>()
    m.set('title', 'v1 page')
    remote.getMap('pages').set('old', m)
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote), 'remote')
    await Promise.resolve() // conversion is deferred to a microtask
    expect(listPages(doc).map((p) => p.title)).toEqual(['v1 page'])
    expect(isReadOnly()).toBe(false)
  })
})
