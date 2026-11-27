import { describe, expect, it } from 'vitest'
import { fitSize, isProcessable, jpegOrientation, keepOriginal, outputType, renameFor } from './image'

/** Minimal JPEG: SOI + APP1 Exif with one IFD entry (orientation). */
function jpegWithOrientation(o: number, little = false) {
  const tiff = little
    ? [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0, 0, 0, o, 0, 0, 0]
    : [0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0, 0, 0, 1, 0, o, 0, 0]
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]
  const len = exif.length + 2
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 0xff, ...exif, 0xff, 0xd9])
}

describe('image preprocessing (SY-04, M3-03)', () => {
  it('fits the long side to 2560px, keeping the aspect ratio', () => {
    expect(fitSize(4032, 3024)).toEqual({ w: 2560, h: 1920, resized: true })
    expect(fitSize(1080, 5000)).toEqual({ w: 553, h: 2560, resized: true })
    expect(fitSize(2560, 100)).toEqual({ w: 2560, h: 100, resized: false })
  })
  it('WebP when encodable; otherwise PNG stays PNG and photos become JPEG', () => {
    expect(outputType('image/png', true)).toBe('image/webp')
    expect(outputType('image/png', false)).toBe('image/png')
    expect(outputType('image/heic', false)).toBe('image/jpeg')
  })
  it('keeps small, upright images untouched and never uploads a bigger re-encode', () => {
    expect(keepOriginal({ size: 500_000, resized: false })).toBe(true)
    expect(keepOriginal({ size: 3_000_000, resized: false })).toBe(false)
    expect(keepOriginal({ size: 500_000, resized: false, orientation: true })).toBe(false)
    expect(keepOriginal({ size: 3_000_000, resized: false, outSize: 3_200_000 })).toBe(true)
    expect(keepOriginal({ size: 3_000_000, resized: true, outSize: 3_200_000 })).toBe(false)
  })
  it('GIF and SVG are not re-encoded', () => {
    expect(isProcessable('image/gif')).toBe(false)
    expect(isProcessable('image/svg+xml')).toBe(false)
    expect(isProcessable('image/jpeg')).toBe(true)
  })
  it('reads the EXIF orientation of JPEGs (both byte orders)', () => {
    expect(jpegOrientation(jpegWithOrientation(6))).toBe(6)
    expect(jpegOrientation(jpegWithOrientation(3, true))).toBe(3)
    expect(jpegOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(1)
    expect(jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe(1)
  })
  it('renames to the output extension', () => {
    expect(renameFor('IMG_0001.HEIC', 'image/webp')).toBe('IMG_0001.webp')
    expect(renameFor('', 'image/jpeg')).toBe('image.jpg')
  })
})
