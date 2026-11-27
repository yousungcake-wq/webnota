import { markDirty } from '../docs/registry'
import { FILES_DIRTY, FILE_ID } from '../sync/engine'
import { allFiles, deleteFiles, getFile, putFile, type StoredFile } from './db'

/**
 * Adding binary files to the workspace (SY-04). A file is stored under its content hash
 * (`files/<sha256>.<ext>`), so the same bytes added twice are one file. It waits in the
 * `pending` store until the next sync commit uploads it (offline: until online again).
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024

export class FileTooLargeError extends Error {
  constructor(public size: number) {
    super(`file is larger than ${MAX_FILE_BYTES / 1024 / 1024}MB`)
  }
}

export interface FileRef {
  /** `<sha256>.<ext>` */
  id: string
  name: string
  size: number
  mime: string
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'text/plain': 'txt',
}

/** Lowercase extension for the stored path: from the name, else the MIME type, else `bin`. */
export function extFor(name: string, mime: string): string {
  const fromName = /\.([A-Za-z0-9]{1,10})$/.exec(name)?.[1]?.toLowerCase()
  return fromName ?? MIME_EXT[mime] ?? 'bin'
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Stores a file for upload and returns its reference (what blocks save). */
export async function addFile(blob: Blob, name = (blob as File).name ?? ''): Promise<FileRef> {
  if (blob.size > MAX_FILE_BYTES) throw new FileTooLargeError(blob.size)
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const mime = blob.type || 'application/octet-stream'
  const id = `${await sha256Hex(bytes)}.${extFor(name, mime)}`
  const ref: FileRef = { id, name: name || id, size: bytes.length, mime }
  const stored: StoredFile = { ...ref, bytes, at: Date.now() }
  // Kept in the display cache too, so it shows at once and offline (M3-02).
  await putFile('cache', stored)
  if (!(await getFile('pending', id))) {
    await putFile('pending', stored)
    markDirty(FILES_DIRTY)
  }
  return ref
}

export const isFileId = (id: string) => FILE_ID.test(id)

/** For the sync engine (LocalStore.pendingFiles). */
export async function pendingFiles(): Promise<{ id: string; bytes: Uint8Array }[]> {
  return (await allFiles('pending')).map(({ id, bytes }) => ({ id, bytes }))
}

/** For the sync engine (LocalStore.filesUploaded). */
export function filesUploaded(ids: string[]): Promise<void> {
  return deleteFiles('pending', ids)
}

export async function pendingCount(): Promise<number> {
  return (await allFiles('pending')).length
}
