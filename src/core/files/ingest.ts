import { getImageOriginal } from '../store/prefs'
import { prepareImage } from './image'
import { addFile, MAX_FILE_BYTES, type FileRef } from './upload'

/**
 * Turning a picked, pasted or dropped file into a stored workspace file (SY-04). Images
 * are preprocessed first (M3-03) unless "keep original" is on. Dynamically imported by
 * the editor and the cover/icon pickers when a file is added — never at boot.
 */
export interface Ingested extends FileRef {
  width?: number
  height?: number
}

export { FileTooLargeError, MAX_FILE_BYTES } from './upload'
export const MAX_FILE_MB = MAX_FILE_BYTES / 1024 / 1024

export async function ingestFile(file: Blob, name = (file as File).name ?? ''): Promise<Ingested> {
  if (!file.type.startsWith('image/')) return addFile(file, name)
  const img = await prepareImage(file, name, { original: getImageOriginal() })
  const ref = await addFile(img.blob, img.name)
  return { ...ref, width: img.width || undefined, height: img.height || undefined }
}

export { addFile, isPending } from './upload'
