import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDirty, clearDirty } from '../docs/registry'
import { FILES_DIRTY } from '../sync/engine'
import { getFile, resetFilesDb } from './db'
import {
  addFile,
  extFor,
  filesUploaded,
  FileTooLargeError,
  isFileId,
  MAX_FILE_BYTES,
  pendingCount,
  pendingFiles,
} from './upload'

beforeEach(async () => {
  resetFilesDb()
  indexedDB.deleteDatabase((await import('../docs/slots')).idbName('$files'))
  const gen = getDirty()[FILES_DIRTY]
  if (gen !== undefined) clearDirty(FILES_DIRTY, gen)
})

const png = (n: number) => new Blob([new Uint8Array([137, 80, 78, 71, n])], { type: 'image/png' })

describe('file store (SY-04, M3-01)', () => {
  it('names a file by its SHA-256 and extension, queues it and marks the queue dirty', async () => {
    const ref = await addFile(png(1), 'Photo.PNG')
    expect(isFileId(ref.id)).toBe(true)
    expect(ref.id).toMatch(/^[0-9a-f]{64}\.png$/)
    expect(ref).toMatchObject({ name: 'Photo.PNG', size: 5, mime: 'image/png' })
    expect(await pendingCount()).toBe(1)
    expect(getDirty()[FILES_DIRTY]).toBe(1)
    expect((await getFile('cache', ref.id))?.bytes).toEqual(new Uint8Array([137, 80, 78, 71, 1]))
  })
  it('the same bytes are one file (deduplicated), different bytes are another', async () => {
    const a = await addFile(png(1), 'a.png')
    const b = await addFile(png(1), 'b.png')
    const c = await addFile(png(2), 'c.png')
    expect(b.id).toBe(a.id)
    expect(c.id).not.toBe(a.id)
    expect(await pendingCount()).toBe(2)
    expect(getDirty()[FILES_DIRTY]).toBe(2) // the duplicate did not bump it
  })
  it('uploaded files leave the queue', async () => {
    const a = await addFile(png(3), 'a.png')
    expect((await pendingFiles()).map((f) => f.id)).toEqual([a.id])
    await filesUploaded([a.id])
    expect(await pendingFiles()).toEqual([])
    expect(await getFile('cache', a.id)).toBeDefined() // still displayable
  })
  it('rejects files over 25MB', async () => {
    const big = { size: MAX_FILE_BYTES + 1, type: 'video/mp4', name: 'big.mp4' } as unknown as Blob
    await expect(addFile(big)).rejects.toBeInstanceOf(FileTooLargeError)
    expect(await pendingCount()).toBe(0)
  })
  it('extension from the name, else the MIME type, else bin', () => {
    expect(extFor('report.final.PDF', 'application/pdf')).toBe('pdf')
    expect(extFor('clipboard', 'image/jpeg')).toBe('jpg')
    expect(extFor('', 'application/x-unknown')).toBe('bin')
    expect(extFor('weird.ext-with-dash', 'image/png')).toBe('png')
  })
})
