import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { addField, addRow, createDatabase, setCell, SHARD_COUNT, updateRow, type DbDocs } from '../model/database'
import { fileRefsInDoc, fileRefsInRows, fileRefsInWorkspace, orphanFiles, rowsWithBody } from './refs'

const id = (c: string, ext = 'png') => `${c.repeat(64)}.${ext}`

function el(name: string, attrs: Record<string, unknown>, children: Y.XmlElement[] = []) {
  const e = new Y.XmlElement(name)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v as string)
  if (children.length) e.insert(0, children)
  return e
}

describe('file references (SY-04 cleanup, M3-10)', () => {
  it('finds image, file and video blocks at any depth, and the cover', () => {
    const doc = new Y.Doc()
    doc.getXmlFragment('default').insert(0, [
      el('image', { src: id('a') }),
      el('image', { src: 'https://example.com/x.png' }), // external: not a file
      el('toggle', {}, [el('toggleContent', {}, [el('file', { fileId: id('b', 'pdf') })])]),
      el('video', { src: id('c', 'mp4') }),
      el('paragraph', {}),
    ])
    doc.getMap('page').set('cover', { type: 'file', value: id('d'), offsetY: 50 })
    expect([...fileRefsInDoc(doc)].sort()).toEqual([id('a'), id('b', 'pdf'), id('c', 'mp4'), id('d')])
  })
  it('finds view and space icons', () => {
    const ws = new Y.Doc()
    const v = new Y.Map()
    v.set('icon', { type: 'file', value: id('e') })
    ws.getMap('views').set('v1', v)
    const v2 = new Y.Map()
    v2.set('icon', { type: 'emoji', value: '📄' })
    ws.getMap('views').set('v2', v2)
    const s = new Y.Map()
    s.set('icon', { type: 'file', value: id('f') })
    ws.getMap('spaces').set('s1', s)
    expect([...fileRefsInWorkspace(ws)].sort()).toEqual([id('e'), id('f')])
  })
  it('finds database media cells and row icons/covers in the shards (M4-07)', () => {
    const db: DbDocs = { schema: new Y.Doc(), shards: Array.from({ length: SHARD_COUNT }, () => new Y.Doc()) }
    createDatabase(new Y.Doc(), db, { dbId: 'd', primaryName: 'Name' })
    const media = addField(db, { name: 'M', type: 'media' })
    const r1 = addRow(db)
    const r2 = addRow(db)
    setCell(db, r1, media, [
      { fileId: id('a'), name: 'a.png', mime: 'image/png', size: 1 },
      { fileId: 'bad', name: '', mime: '', size: 0 },
    ])
    updateRow(db, r2, { cover: { type: 'file', value: id('b') }, icon: { type: 'file', value: id('c') } })
    const refs = new Set<string>()
    db.shards.forEach((s) => fileRefsInRows(s, refs))
    expect([...refs].sort()).toEqual([id('a'), id('b'), id('c')])
    // rows with a row page body (M5-08): their docs are scanned by the cleanup too
    updateRow(db, r1, { hasDoc: true })
    expect(db.shards.flatMap((s) => rowsWithBody(s))).toEqual([r1])
  })

  it('orphans: unreferenced WebNota files only (data and foreign names are kept)', () => {
    const repo = ['data/workspace.yjs', `files/${id('a')}`, `files/${id('9')}`, 'files/readme.txt', 'files/x/y.png']
    expect(orphanFiles(repo, new Set([id('a')]))).toEqual([`files/${id('9')}`])
  })
})
