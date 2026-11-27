/**
 * Image preprocessing before upload (SY-04, M3-03): the long side is reduced to 2560px,
 * re-encoded as WebP where the browser can encode it (JPEG otherwise; PNG stays PNG so
 * transparency survives), and EXIF orientation is applied by decoding with
 * `imageOrientation: 'from-image'`. Small images are kept as they are (no quality loss),
 * and "keep original" skips all of it. Loaded with the upload code, never at boot.
 */
export const MAX_IMAGE_SIDE = 2560
/** Below this, an image that needs no resizing is uploaded untouched. */
export const KEEP_BELOW_BYTES = 1024 * 1024
const QUALITY = 0.85

/** Raster formats we decode and may re-encode. GIF (animation) and SVG (vector) are kept. */
export const isProcessable = (mime: string) => /^image\/(png|jpeg|webp|avif|bmp|heic|heif)$/.test(mime)

export function fitSize(w: number, h: number, max = MAX_IMAGE_SIDE): { w: number; h: number; resized: boolean } {
  const long = Math.max(w, h)
  if (long <= max) return { w, h, resized: false }
  const k = max / long
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), resized: true }
}

/** Output type: WebP when encodable; else JPEG for photos, PNG for PNG (alpha). */
export function outputType(input: string, webp: boolean): string {
  if (webp) return 'image/webp'
  return input === 'image/png' ? 'image/png' : 'image/jpeg'
}

/** Keep the original when processing would not help: small enough, or the result is bigger. */
export function keepOriginal(o: { size: number; resized: boolean; outSize?: number; orientation?: boolean }) {
  if (o.outSize !== undefined) return !o.resized && !o.orientation && o.outSize >= o.size
  return !o.resized && !o.orientation && o.size <= KEEP_BELOW_BYTES
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }
export const renameFor = (name: string, mime: string) => {
  const ext = EXT[mime] ?? 'img'
  const base = name.replace(/\.[A-Za-z0-9]{1,10}$/, '') || 'image'
  return `${base}.${ext}`
}

/** EXIF orientation (1–8) of a JPEG, or 1. Reads only the first 64KB. */
export function jpegOrientation(bytes: Uint8Array): number {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return 1
  let off = 2
  while (off + 4 < v.byteLength) {
    const marker = v.getUint16(off)
    const len = v.getUint16(off + 2)
    if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966 /* "Exif" */) {
      const tiff = off + 10
      if (tiff + 8 > v.byteLength) return 1
      const little = v.getUint16(tiff) === 0x4949
      const u16 = (p: number) => v.getUint16(p, little)
      const u32 = (p: number) => v.getUint32(p, little)
      const ifd = tiff + u32(tiff + 4)
      if (ifd + 2 > v.byteLength) return 1
      const count = u16(ifd)
      for (let i = 0; i < count; i++) {
        const e = ifd + 2 + i * 12
        if (e + 10 > v.byteLength) return 1
        if (u16(e) === 0x0112) {
          const o = u16(e + 8)
          return o >= 1 && o <= 8 ? o : 1
        }
      }
      return 1
    }
    if ((marker & 0xff00) !== 0xff00) return 1
    off += 2 + len
  }
  return 1
}

export interface PreparedImage {
  blob: Blob
  name: string
  width: number
  height: number
}

/** Decodes, resizes and re-encodes an image for upload (see module comment). */
export async function prepareImage(
  file: Blob,
  name: string,
  opts: { original?: boolean } = {},
): Promise<PreparedImage> {
  const asIs = async (): Promise<PreparedImage> => {
    const dims = await imageSize(file).catch(() => ({ width: 0, height: 0 }))
    return { blob: file, name, ...dims }
  }
  if (opts.original || !isProcessable(file.type) || typeof createImageBitmap !== 'function') return asIs()
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return asIs() // a format this browser cannot decode (e.g. HEIC outside Safari): upload as is
  }
  const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer())
  const orientation = file.type === 'image/jpeg' && jpegOrientation(head) > 1
  const fit = fitSize(bitmap.width, bitmap.height)
  if (keepOriginal({ size: file.size, resized: fit.resized, orientation })) {
    bitmap.close()
    return { blob: file, name, width: fit.w, height: fit.h }
  }
  const out = await encode(bitmap, fit.w, fit.h, file.type)
  bitmap.close()
  if (!out || keepOriginal({ size: file.size, resized: fit.resized, orientation, outSize: out.size }))
    return { blob: file, name, width: fit.w, height: fit.h }
  return { blob: out, name: renameFor(name, out.type), width: fit.w, height: fit.h }
}

async function encode(bitmap: ImageBitmap, w: number, h: number, input: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  const toBlob = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, QUALITY))
  const webp = await toBlob('image/webp')
  // browsers that cannot encode WebP silently return PNG
  if (webp?.type === 'image/webp') return webp
  return toBlob(outputType(input, false))
}

/** Natural size of an image blob (0×0 if it cannot be decoded). */
export async function imageSize(file: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function' && file.type !== 'image/svg+xml') {
    const b = await createImageBitmap(file)
    const size = { width: b.width, height: b.height }
    b.close()
    return size
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}
