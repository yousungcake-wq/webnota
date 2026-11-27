import { mergeAttributes, Node } from '@tiptap/core'

/** Pasted HTML: keep http(s) addresses and video file ids; the view re-checks them (`embedUrls.ts`). */
const isMediaSrc = (s: string | null | undefined): s is string =>
  !!s && (/^https?:\/\/\S+$/i.test(s) || /^[0-9a-f]{64}\.[a-z0-9]{1,10}$/.test(s))

/**
 * Video (ED-B13) and embed (ED-B22) blocks, schema v16. Both store the URL the user gave
 * (`src`); the player/iframe address is derived when rendering (`embedUrls.ts`), so a
 * block can never point an iframe outside the allowlist (the view only renders what
 * `embedUrls.ts` accepts). Schema only; UI is `EmbedBlock.tsx`.
 * - video `width`: percent of the text column (null = 100)
 * - embed `height`: iframe height in px (null = the service default)
 */
export const Video = Node.create({
  name: 'video',
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
            el.getAttribute('data-src') ?? el.getAttribute('src') ?? el.querySelector('source')?.getAttribute('src')
          return isMediaSrc(s) ? s : null
        },
        renderHTML: (a) => (a.src ? { 'data-src': a.src as string } : {}),
      },
      width: {
        default: null,
        parseHTML: (el) => {
          const w = Number(el.getAttribute('data-width'))
          return w >= 10 && w <= 100 ? w : null
        },
        renderHTML: (a) => (a.width ? { 'data-width': String(a.width) } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-video]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    const src = node.attrs.src as string | null
    return ['div', mergeAttributes({ 'data-video': '', class: 'video-block' }, HTMLAttributes), src ?? '']
  },
})

export const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el) => {
          const s = el.getAttribute('data-src')
          return isMediaSrc(s) && s.startsWith('https:') ? s : null
        },
        renderHTML: (a) => (a.src ? { 'data-src': a.src as string } : {}),
      },
      height: {
        default: null,
        parseHTML: (el) => {
          const h = Number(el.getAttribute('data-height'))
          return h >= 100 && h <= 1200 ? h : null
        },
        renderHTML: (a) => (a.height ? { 'data-height': String(a.height) } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-embed]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes({ 'data-embed': '', class: 'embed-block' }, HTMLAttributes),
      (node.attrs.src as string) ?? '',
    ]
  },
})
