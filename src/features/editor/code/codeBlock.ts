import CodeBlock from '@tiptap/extension-code-block'
import type * as HighlighterNs from './highlighter'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { t } from '@/core/i18n'
import { LANGUAGES } from './languages'

/**
 * Code block (ED-B10): language picker, line wrap toggle, copy button, and syntax
 * highlighting that loads only when a document has a code block with a language
 * (lowlight core + that language's grammar, spec/10 §1.1). Node name stays `codeBlock`;
 * `wrap` is a new attr with a default (spec/02 §6 rule 3).
 */
type Highlighter = typeof HighlighterNs
let hl: Highlighter | null = null
let hlLoading: Promise<Highlighter> | null = null
const loadHighlighter = () => (hlLoading ??= import('./highlighter').then((m) => (hl = m)))

const key = new PluginKey<DecorationSet>('codeHighlight')

function decorations(doc: PMNode): DecorationSet {
  if (!hl) return DecorationSet.empty
  const decos: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock') return true
    const lang = node.attrs.language as string | null
    if (!lang || lang === 'plaintext') return false
    for (const s of hl!.highlight(node.textContent, lang))
      decos.push(Decoration.inline(pos + 1 + s.from, pos + 1 + s.to, { class: s.className }))
    return false
  })
  return DecorationSet.create(doc, decos)
}

/** Loads the highlighter and any grammar a code block needs, then redraws. */
function ensure(view: EditorView) {
  const langs = new Set<string>()
  view.state.doc.descendants((node) => {
    if (node.type.name === 'codeBlock' && node.attrs.language && node.attrs.language !== 'plaintext')
      langs.add(node.attrs.language as string)
    return node.type.name !== 'codeBlock'
  })
  if (!langs.size) return
  void loadHighlighter().then(async (m) => {
    const fresh = (await Promise.all([...langs].map((l) => m.ensureLanguage(l)))).some(Boolean)
    if (fresh && !view.isDestroyed) view.dispatch(view.state.tr.setMeta(key, 'redraw'))
  })
}

export const CodeBlockPlus = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      wrap: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-wrap') === 'true',
        renderHTML: (a) => (a.wrap ? { 'data-wrap': 'true' } : {}),
      },
    }
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node
      const dom = document.createElement('div')
      dom.className = 'code-block'
      const head = document.createElement('div')
      head.className = 'code-head'
      head.contentEditable = 'false'
      const select = document.createElement('select')
      select.className = 'code-lang'
      select.setAttribute('aria-label', t('code.language'))
      for (const l of LANGUAGES) select.add(new Option(l.label, l.id))
      const wrapBtn = document.createElement('button')
      wrapBtn.type = 'button'
      wrapBtn.className = 'code-btn'
      wrapBtn.textContent = t('code.wrap')
      const copyBtn = document.createElement('button')
      copyBtn.type = 'button'
      copyBtn.className = 'code-btn'
      copyBtn.textContent = t('code.copy')
      head.append(select, wrapBtn, copyBtn)
      const pre = document.createElement('pre')
      const code = document.createElement('code')
      pre.append(code)
      dom.append(head, pre)

      const setAttrs = (attrs: Record<string, unknown>) => {
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (pos === undefined || !editor.isEditable) return
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, ...attrs }))
      }
      const apply = () => {
        select.value = (current.attrs.language as string) || 'plaintext'
        select.disabled = !editor.isEditable
        wrapBtn.setAttribute('aria-pressed', String(Boolean(current.attrs.wrap)))
        dom.classList.toggle('is-wrapped', Boolean(current.attrs.wrap))
      }
      select.addEventListener('change', () =>
        setAttrs({ language: select.value === 'plaintext' ? null : select.value }),
      )
      wrapBtn.addEventListener('mousedown', (e) => e.preventDefault())
      wrapBtn.addEventListener('click', () => setAttrs({ wrap: !current.attrs.wrap }))
      copyBtn.addEventListener('mousedown', (e) => e.preventDefault())
      copyBtn.addEventListener('click', () => {
        void navigator.clipboard?.writeText(current.textContent).then(() => {
          copyBtn.textContent = t('code.copied')
          setTimeout(() => (copyBtn.textContent = t('code.copy')), 1200)
        })
      })
      apply()
      return {
        dom,
        contentDOM: code,
        update: (n) => {
          if (n.type !== current.type) return false
          current = n
          apply()
          return true
        },
        ignoreMutation: (m) => head.contains(m.target as globalThis.Node),
        stopEvent: (e) => head.contains(e.target as globalThis.Node),
      }
    }
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => decorations(state.doc),
          apply: (tr, old, _o, state) => (tr.docChanged || tr.getMeta(key) ? decorations(state.doc) : old),
        },
        props: { decorations: (state) => key.getState(state) },
        view: (view) => {
          ensure(view)
          return {
            update: (v, prev) => {
              if (v.state.doc !== prev.doc) ensure(v)
            },
          }
        },
      }),
    ]
  },
})
