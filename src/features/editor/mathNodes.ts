import { InputRule, type Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { t } from '@/core/i18n'
import { loadKatex, renderMath } from './math/katex'
import { INLINE_MATH_INPUT, InlineMath, MathBlock } from './nodes/math'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    math: {
      /** Inserts a math block and opens its editor (ED-B15). */
      insertMathBlock: (latex?: string) => ReturnType
      /** Inserts inline math (the selected text becomes its LaTeX) and opens its editor (ED-I06). */
      insertInlineMath: () => ReturnType
      /** Sets the LaTeX of the math node at `pos`; empty removes it. */
      setMath: (pos: number, latex: string) => ReturnType
    }
  }
}

export interface MathEditRequest {
  pos: number
  anchor: HTMLElement
}

/** Asks the editor (Editor.tsx) to open the math editor for the node at `pos`. */
export function openMathEditor(editor: Editor, pos: number) {
  requestAnimationFrame(() => {
    if (editor.isDestroyed || !editor.isEditable) return
    const dom = editor.view.nodeDOM(pos)
    if (dom instanceof HTMLElement)
      dom.dispatchEvent(
        new CustomEvent<MathEditRequest>('wn-math-edit', { bubbles: true, detail: { pos, anchor: dom } }),
      )
  })
}

/** DOM node view: KaTeX output (lazy) or the source while it loads; a click opens the editor. */
function mathView(display: boolean) {
  return ({ node, getPos, editor }: { node: PMNode; getPos: (() => number | undefined) | boolean; editor: Editor }) => {
    let current = node
    const dom = document.createElement(display ? 'div' : 'span')
    dom.className = display ? 'math-block' : 'inline-math'
    dom.contentEditable = 'false'
    const draw = () => {
      const latex = current.attrs.latex as string
      dom.classList.toggle('is-empty', !latex)
      dom.title = display ? '' : latex
      if (!latex) {
        dom.textContent = t(display ? 'math.emptyBlock' : 'math.emptyInline')
        return
      }
      if (renderMath(dom, latex, display)) return
      dom.textContent = display ? latex : `$${latex}$`
      void loadKatex().then(() => !editor.isDestroyed && renderMath(dom, current.attrs.latex as string, display))
    }
    dom.addEventListener('click', () => {
      const pos = typeof getPos === 'function' ? getPos() : undefined
      if (pos === undefined || !editor.isEditable) return
      dom.dispatchEvent(
        new CustomEvent<MathEditRequest>('wn-math-edit', { bubbles: true, detail: { pos, anchor: dom } }),
      )
    })
    draw()
    return {
      dom,
      update: (n: PMNode) => {
        if (n.type !== current.type) return false
        if (n.attrs.latex !== current.attrs.latex) {
          current = n
          draw()
        }
        return true
      },
      ignoreMutation: () => true,
    }
  }
}

export const MathBlockWithView = MathBlock.extend({
  addNodeView() {
    return mathView(true)
  },
  addCommands() {
    return {
      insertMathBlock:
        (latex = '') =>
        ({ editor, tr, commands }) => {
          if (!commands.insertContent({ type: 'mathBlock', attrs: { latex } })) return false
          // the new block sits just before the selection insertContent leaves behind (in `tr`)
          const pos = findBefore(tr.doc, tr.selection.to, 'mathBlock')
          if (pos !== null) openMathEditor(editor, pos)
          return true
        },
      insertInlineMath:
        () =>
        ({ editor, state, commands }) => {
          const { from, to } = state.selection
          const latex = state.doc.textBetween(from, to, ' ')
          const ok = commands.insertContent({ type: 'inlineMath', attrs: { latex } })
          if (ok) openMathEditor(editor, from)
          return ok
        },
      setMath:
        (pos, latex) =>
        ({ tr, state, dispatch }) => {
          const node = state.doc.nodeAt(pos)
          if (!node || (node.type.name !== 'mathBlock' && node.type.name !== 'inlineMath')) return false
          if (dispatch) {
            if (latex) tr.setNodeMarkup(pos, undefined, { ...node.attrs, latex })
            else tr.delete(pos, pos + node.nodeSize)
          }
          return true
        },
    }
  },
  addInputRules() {
    return [
      // `$$` + space at the start of an empty line: a math block (ED-B15)
      new InputRule({
        find: /^\$\$\s$/,
        handler: ({ state, range }) => {
          const $from = state.doc.resolve(range.from)
          if ($from.parent.type.name !== 'paragraph' || $from.parent.textContent.trim() !== '$$') return null
          const start = $from.before()
          state.tr.replaceWith(start, $from.after(), this.type.create({ latex: '' }))
          openMathEditor(this.editor, start)
        },
      }),
    ]
  },
})

/** Position of the last `type` node that ends at or before `pos`. */
function findBefore(doc: PMNode, pos: number, type: string): number | null {
  let found: number | null = null
  doc.descendants((n, p) => {
    if (p >= pos) return false
    if (n.type.name === type && p + n.nodeSize <= pos) found = p
    return !n.isTextblock
  })
  return found
}

export const InlineMathWithView = InlineMath.extend({
  addNodeView() {
    return mathView(false)
  },
  addInputRules() {
    return [
      // `$x^2$`: inline math (ED-I06)
      new InputRule({
        find: INLINE_MATH_INPUT,
        handler: ({ state, range, match }) => {
          const latex = match[1]
          if (!latex) return null
          const from = range.from + match[0].indexOf('$')
          state.tr.replaceWith(from, range.to, this.type.create({ latex }))
        },
      }),
    ]
  },
})
