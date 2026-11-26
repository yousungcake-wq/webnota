import { Extension, type JSONContent } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { isCodeEditorHtml, looksLikeMarkdown, singleUrl } from './paste/detect'

const inCode = (state: EditorState) => state.selection.$from.parent.type.spec.code === true

const paragraphs = (text: string): JSONContent[] =>
  text
    .split(/\r?\n/)
    .map((line) => (line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' }))

/**
 * Paste (ED-F06, text part): Markdown text becomes blocks (parser loaded on demand),
 * code-editor HTML is pasted as plain text, a bare URL on an empty selection becomes a
 * link (on a selection, the Link extension links the selected text). Other HTML uses the
 * schema's parse rules.
 */
export const PasteRules = Extension.create({
  name: 'pasteRules',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('pasteRules'),
        props: {
          handlePaste: (view, event) => {
            const data = event.clipboardData
            if (!data || inCode(view.state)) return false
            const text = data.getData('text/plain')
            const html = data.getData('text/html')
            if (!text) return false
            const { from, to, empty } = view.state.selection

            const url = singleUrl(text)
            if (url && empty) {
              editor
                .chain()
                .insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] })
                .unsetMark('link')
                .run()
              return true
            }
            if (url) return false // the Link extension links the selection

            const codeHtml = html ? isCodeEditorHtml(html) : false
            if (html && !codeHtml) return false
            if (looksLikeMarkdown(text)) {
              event.preventDefault()
              void import('./paste/markdown').then(({ markdownToHtml }) => {
                if (!editor.isDestroyed)
                  editor.chain().focus().insertContentAt({ from, to }, markdownToHtml(text)).run()
              })
              return true
            }
            if (codeHtml) {
              editor.chain().insertContentAt({ from, to }, paragraphs(text)).run()
              return true
            }
            return false
          },
        },
      }),
    ]
  },
})
