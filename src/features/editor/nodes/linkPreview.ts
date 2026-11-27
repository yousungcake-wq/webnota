import { mergeAttributes, Node } from '@tiptap/core'

const isHttp = (s: string | null | undefined): s is string => !!s && /^https?:\/\/\S+$/i.test(s)

/**
 * Link preview / bookmark block (ED-B21, schema v18). `url` is the link; `title`,
 * `description`, `image` and `siteName` are a cache of the page's metadata (worker
 * `/unfurl`), filled once and refreshable — empty title = not fetched yet. Schema only;
 * the card UI is `LinkPreviewBlock.tsx` + the lazy `LinkPreviewView.tsx`.
 */
export const LinkPreview = Node.create({
  name: 'linkPreview',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    const text = (name: string) => ({
      default: '',
      parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) ?? '',
      renderHTML: () => ({}),
    })
    return {
      url: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute('data-url') ?? el.querySelector('a')?.getAttribute('href')
          return isHttp(v) ? v : null
        },
        renderHTML: (a) => (a.url ? { 'data-url': a.url as string } : {}),
      },
      title: text('title'),
      description: text('description'),
      siteName: text('site'),
      image: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute('data-image')
          return isHttp(v) ? v : null
        },
        renderHTML: () => ({}),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-link-preview]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    const { url, title, description, siteName, image } = node.attrs as Record<string, string | null>
    // copy/paste between pages keeps the cached metadata
    return [
      'div',
      mergeAttributes(
        {
          'data-link-preview': '',
          class: 'link-preview',
          'data-title': title ?? '',
          'data-description': description ?? '',
          'data-site': siteName ?? '',
          ...(image ? { 'data-image': image } : {}),
        },
        HTMLAttributes,
      ),
      ['a', { href: url ?? '' }, title || url || ''],
    ]
  },
})
