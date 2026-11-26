import DragHandle from '@tiptap/extension-drag-handle-react'
import type { Node as PMNode } from '@tiptap/pm/model'
import { EditorContent, useEditor, useEditorState, type Editor as TEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Bold, Code, GripVertical, Highlighter, Italic, Plus, Strikethrough, Underline } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'
import { useMedia } from '@/platform/media'
import { editorExtensions } from './extensions'
import { KeyboardToolbar } from './KeyboardToolbar'
import './editor.css'
import { t } from '@/core/i18n'

interface Props {
  doc: Y.Doc
  onReady?: (editor: TEditor) => void
}

export function Editor({ doc, onReady }: Props) {
  const coarse = useMedia('(pointer: coarse)')
  const editor = useEditor(
    {
      extensions: editorExtensions(doc),
      editorProps: {
        attributes: {
          class: 'wn-editor',
          spellcheck: 'false',
          autocapitalize: 'sentences',
          'aria-label': t('editor.body'),
        },
      },
    },
    [doc],
  )

  useEffect(() => {
    if (editor) onReady?.(editor)
  }, [editor, onReady])

  const hovered = useRef<{ node: PMNode | null; pos: number }>({ node: null, pos: -1 })
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!editor) return
    // Hide the keyboard toolbar slightly after blur so taps on it still land.
    let t: ReturnType<typeof setTimeout> | undefined
    const onFocus = () => {
      clearTimeout(t)
      setFocused(true)
    }
    const onBlur = () => {
      clearTimeout(t)
      t = setTimeout(() => setFocused(editor.isFocused), 150)
    }
    editor.on('focus', onFocus)
    editor.on('blur', onBlur)
    return () => {
      clearTimeout(t)
      editor.off('focus', onFocus)
      editor.off('blur', onBlur)
    }
  }, [editor])

  if (!editor) return null

  /** AppFlowy-style "+" next to the drag handle: insert an empty block below and open the slash menu. */
  const addBlockBelow = () => {
    const { node, pos } = hovered.current
    if (!node || pos < 0) return
    const at = pos + node.nodeSize
    editor
      .chain()
      .insertContentAt(at, { type: 'paragraph' })
      .focus(at + 1)
      .insertContent('/')
      .run()
  }

  return (
    <div className="editor-wrap">
      {!coarse && (
        <DragHandle
          editor={editor}
          onNodeChange={({ node, pos }) => {
            hovered.current = { node, pos }
          }}
        >
          <div className="block-actions">
            <button type="button" className="block-btn" title={t('editor.addBelow')} onClick={addBlockBelow}>
              <Plus size={16} />
            </button>
            <div className="block-btn grip" title={t('editor.dragToMove')}>
              <GripVertical size={16} />
            </div>
          </div>
        </DragHandle>
      )}
      {!coarse && <FormatBubble editor={editor} />}
      <EditorContent editor={editor} />
      {coarse && focused && <KeyboardToolbar editor={editor} />}
    </div>
  )
}

function FormatBubble({ editor }: { editor: TEditor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      highlight: e.isActive('highlight'),
    }),
  })
  const btn = (active: boolean, label: string, onClick: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      className={`fmt-btn${active ? ' is-active' : ''}`}
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {icon}
    </button>
  )
  return (
    <BubbleMenu
      editor={editor}
      className="bubble"
      shouldShow={({ editor: e, from, to }) => from !== to && !e.isActive('codeBlock')}
    >
      {btn(s.bold, t('editor.bold'), () => editor.chain().focus().toggleBold().run(), <Bold size={16} />)}
      {btn(s.italic, t('editor.italic'), () => editor.chain().focus().toggleItalic().run(), <Italic size={16} />)}
      {btn(
        s.underline,
        t('editor.underline'),
        () => editor.chain().focus().toggleUnderline().run(),
        <Underline size={16} />,
      )}
      {btn(
        s.strike,
        t('editor.strike'),
        () => editor.chain().focus().toggleStrike().run(),
        <Strikethrough size={16} />,
      )}
      {btn(s.code, t('editor.inlineCode'), () => editor.chain().focus().toggleCode().run(), <Code size={16} />)}
      {btn(
        s.highlight,
        t('editor.highlight'),
        () => editor.chain().focus().toggleHighlight().run(),
        <Highlighter size={16} />,
      )}
    </BubbleMenu>
  )
}
