import { mergeAttributes, Node } from '@tiptap/core'

export type ImageAlign = 'left' | 'center' | 'right'

/** Caption alignment (schema v20): left (default), center or right — independent of the media. */
export const captionAlignAttr = () => ({
  default: 'left',
  parseHTML: (el: HTMLElement) => {
    const v = el.getAttribute('data-caption-align')
    return v === 'center' || v === 'right' ? v : 'left'
  },
  renderHTML: (a: Record<string, unknown>) =>
    a.captionAlign && a.captionAlign !== 'left' ? { 'data-caption-align': a.captionAlign as string } : {},
})

/** Accepted `src` values: a workspace file id (`<sha256>.<ext>`) or an http(s) URL. */
export const isImageSrc = (src: unknown): src is string =>
  typeof src === 'string' && (/^[0-9a-f]{64}\.[a-z0-9]{1,10}$/.test(src) || /^https?:\/\/\S+$/i.test(src))

/**
 * Image block (ED-B12, schema v14). Schema only; the UI (upload, resize, align, caption)
 * is `ImageBlock.tsx` + the lazy `ImageView.tsx`.
 * - `src`: file id (stored in the repository, SY-04) or an external URL; null = empty block
 * - `width`: percent of the text column (10–100), null = natural size (capped at 100%)
 * - `naturalWidth`/`naturalHeight`: pixel size, to reserve the box before the image loads
 */
export const Image = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el) => {
          const s =
            el.getAttribute('data-file') ?? el.querySelector('img')?.getAttribute('src') ?? el.getAttribute('src')
          return isImageSrc(s) ? s : null
        },
        renderHTML: (a) => (a.src ? { 'data-file': a.src as string } : {}),
      },
      width: {
        default: null,
        parseHTML: (el) => {
          const w = Number(el.getAttribute('data-width'))
          return w >= 10 && w <= 100 ? w : null
        },
        renderHTML: (a) => (a.width ? { 'data-width': String(a.width) } : {}),
      },
      align: {
        default: 'center',
        parseHTML: (el) => {
          const v = el.getAttribute('data-align')
          return v === 'left' || v === 'right' ? v : 'center'
        },
        renderHTML: (a) => (a.align !== 'center' ? { 'data-align': a.align as string } : {}),
      },
      caption: {
        default: '',
        parseHTML: (el) => el.querySelector('figcaption')?.textContent ?? el.getAttribute('alt') ?? '',
        renderHTML: () => ({}),
      },
      // v20 (feedback 4): the caption aligns on its own, not with the image
      captionAlign: captionAlignAttr(),
      naturalWidth: {
        default: null,
        parseHTML: (el) => Number(el.getAttribute('data-nw')) || null,
        renderHTML: (a) => (a.naturalWidth ? { 'data-nw': String(a.naturalWidth) } : {}),
      },
      naturalHeight: {
        default: null,
        parseHTML: (el) => Number(el.getAttribute('data-nh')) || null,
        renderHTML: (a) => (a.naturalHeight ? { 'data-nh': String(a.naturalHeight) } : {}),
      },
    }
  },
  parseHTML() {
    return [
      { tag: 'figure[data-image]' },
      // pasted HTML: external images only (a file id never appears in other apps' HTML)
      { tag: 'img[src]', getAttrs: (el) => (/^https?:/i.test(el.getAttribute('src') ?? '') ? {} : false) },
    ]
  },
  renderHTML({ HTMLAttributes, node }) {
    const src = node.attrs.src as string | null
    const caption = node.attrs.caption as string
    // Copy/paste and export: external URLs keep working; file ids need the app (data-file)
    const img = ['img', { src: src && /^https?:/i.test(src) ? src : '', alt: caption }]
    return [
      'figure',
      mergeAttributes({ 'data-image': '', class: 'image-block' }, HTMLAttributes),
      img,
      ...(caption ? [['figcaption', {}, caption]] : []),
    ]
  },
})
