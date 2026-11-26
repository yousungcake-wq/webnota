import { Mark, mergeAttributes } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import { colorAttrs, elementColor, pastedColor } from './colors'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textColor: {
      /** Sets the text color of the selection; null removes it. */
      setTextColor: (color: string | null) => ReturnType
    }
    highlightColor: {
      /** Sets the background color of the selection; null removes it. */
      setHighlightColor: (color: string | null) => ReturnType
    }
  }
}

/**
 * Text color (ED-I03). The mark is named `textStyle` like Tiptap's so other inline
 * style attributes can join it later without a new mark type (spec/02 §6).
 */
export const TextColor = Mark.create({
  name: 'textStyle',
  priority: 101, // outside other marks, like Tiptap's TextStyle
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el) => elementColor(el, 'text'),
        renderHTML: () => ({}),
      },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (el) => (elementColor(el, 'text') ? {} : false),
      },
      {
        tag: 'font[color]',
        getAttrs: (el) => {
          const color = pastedColor(el.getAttribute('color'))
          return color ? { color } : false
        },
      },
    ]
  },
  renderHTML({ HTMLAttributes, mark }) {
    return ['span', mergeAttributes(HTMLAttributes, colorAttrs('text', mark.attrs.color as string | null)), 0]
  },
  addCommands() {
    return {
      setTextColor:
        (color) =>
        ({ commands }) =>
          color ? commands.setMark(this.name, { color }) : commands.unsetMark(this.name),
    }
  },
})

/** Highlight with a palette/custom background color (null = the classic yellow marker). */
export const HighlightColor = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el) => elementColor(el, 'bg'),
        renderHTML: () => ({}),
      },
    }
  },
  parseHTML() {
    return [
      { tag: 'mark' },
      {
        tag: 'span',
        getAttrs: (el) => {
          const color = elementColor(el, 'bg')
          return color ? { color } : false
        },
      },
    ]
  },
  renderHTML({ HTMLAttributes, mark }) {
    return ['mark', mergeAttributes(HTMLAttributes, colorAttrs('bg', mark.attrs.color as string | null)), 0]
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setHighlightColor:
        (color) =>
        ({ commands }) =>
          color ? commands.setMark(this.name, { color }) : commands.unsetMark(this.name),
    }
  },
})
