import { Extension } from '@tiptap/core'
import { colorAttrs, elementColor } from './colors'

/**
 * Block-level attributes (ED-F03, ED-F15), schema v11:
 * - `blockId`: target of block links; assigned only when a link is copied, and not kept
 *   when a block is split (the second half is a new block).
 * - `textColor` / `bgColor`: whole-block colors (palette id or `#rrggbb`, like the marks).
 * - `textAlign`: left (null) / center / right for paragraphs and headings.
 */
export const LINKABLE = [
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'bulletList',
  'orderedList',
  'taskList',
  'listItem',
  'taskItem',
  'toggle',
  'callout',
  'table',
  'columns',
  'outline',
  'subPage',
  'horizontalRule',
]
export const COLORABLE = ['paragraph', 'heading', 'blockquote', 'listItem', 'taskItem']
export const ALIGNABLE = ['paragraph', 'heading']

export const BlockAttrs = Extension.create({
  name: 'blockAttrs',
  addGlobalAttributes() {
    return [
      {
        types: LINKABLE,
        attributes: {
          blockId: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute('data-block-id'),
            renderHTML: (a) => (a.blockId ? { 'data-block-id': a.blockId as string } : {}),
          },
        },
      },
      {
        types: COLORABLE,
        attributes: {
          textColor: {
            default: null,
            parseHTML: (el) => (el.hasAttribute('data-block-color') ? elementColor(el, 'text') : null),
            renderHTML: (a) =>
              a.textColor ? { ...colorAttrs('text', a.textColor as string), 'data-block-color': '' } : {},
          },
          bgColor: {
            default: null,
            parseHTML: (el) => (el.hasAttribute('data-block-bg') ? elementColor(el, 'bg') : null),
            renderHTML: (a) => (a.bgColor ? { ...colorAttrs('bg', a.bgColor as string), 'data-block-bg': '' } : {}),
          },
        },
      },
      {
        types: ALIGNABLE,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (el) => {
              const v = el.style.textAlign
              return v === 'center' || v === 'right' ? v : null
            },
            renderHTML: (a) => (a.textAlign ? { style: `text-align: ${a.textAlign as string}` } : {}),
          },
        },
      },
    ]
  },
})
