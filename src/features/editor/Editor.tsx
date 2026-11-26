import DragHandle from '@tiptap/extension-drag-handle-react'
import type { Node as PMNode } from '@tiptap/pm/model'
import { EditorContent, useEditor, useEditorState, type Editor as TEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Bold, Code, GripVertical, Highlighter, Italic, Link, Plus, Strikethrough, Underline } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { schemaStore } from '@/core/schema'
import { useStore } from '@/core/store/useStore'
import type * as Y from 'yjs'
import { debugCrash } from '@/platform/debug'
import { useLayout } from '@/platform/layout'
import { docSchema, editorExtensions } from './extensions'
import { findUnknownContent } from './unknown'
import { CalloutPicker } from './CalloutPicker'
import { LinkBubble, LinkSheet, promptLink } from './LinkBubble'
import { KeyboardToolbar } from './KeyboardToolbar'
import './editor.css'
import { t } from '@/core/i18n'

interface Props {
  doc: Y.Doc
  /** Locked page (WS-13): read-only until unlocked. */
  locked?: boolean
  onReady?: (editor: TEditor) => void
}

export function Editor({ doc, onReady, locked = false }: Props) {
  debugCrash('editor')
  const coarse = useLayout().isTouch
  const schemaReadOnly = useStore(schemaStore, selectReadOnly)
  // Content from a newer app version (ED-B23): kept as is, page opens read-only.
  const [unknown, setUnknown] = useState<string[] | null>(null)
  const readOnly = schemaReadOnly || unknown !== null || locked
  const editor = useEditor(
    {
      extensions: editorExtensions(doc, {
        onInvalidContent: () => {
          const found = findUnknownContent(doc.getXmlFragment('default'), docSchema())
          setUnknown([...found.nodes, ...found.marks])
        },
      }),
      editable: !readOnly,
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

  // Callout icon clicks (nodes/callout.ts) open the picker.
  const [calloutPick, setCalloutPick] = useState<{ pos: number; anchor: HTMLElement } | null>(null)
  // Links: read-only → open on click; phone editing → link sheet (MB-25); desktop uses LinkBubble.
  const [linkTap, setLinkTap] = useState<{ href: string; anchor: HTMLElement } | null>(null)
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !editor) return
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('.wn-editor a[href]')
      if (!a) return
      e.preventDefault()
      if (!editor.isEditable || e.metaKey || e.ctrlKey) window.open(a.href, '_blank', 'noopener')
      else if (coarse) setLinkTap({ href: a.getAttribute('href') ?? '', anchor: a })
    }
    wrap.addEventListener('click', onClick)
    return () => wrap.removeEventListener('click', onClick)
  }, [editor, coarse])
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !editor) return
    const onPick = (e: Event) => {
      if (!editor.isEditable) return
      setCalloutPick((e as CustomEvent<{ pos: number; anchor: HTMLElement }>).detail)
    }
    wrap.addEventListener('wn-callout-icon', onPick)
    return () => wrap.removeEventListener('wn-callout-icon', onPick)
  }, [editor])

  // Schema read-only gate (spec/02 §6) and unknown content (ED-B23): an older app must
  // not rewrite newer content.
  useEffect(() => {
    if (editor && editor.isEditable === readOnly) editor.setEditable(!readOnly)
  }, [editor, readOnly])

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
    <div className="editor-wrap" ref={wrapRef}>
      {!coarse && !readOnly && (
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
      {!coarse && !readOnly && <FormatBubble editor={editor} />}
      {!coarse && !readOnly && <LinkBubble editor={editor} />}
      {linkTap && (
        <LinkSheet editor={editor} href={linkTap.href} anchor={linkTap.anchor} onClose={() => setLinkTap(null)} />
      )}
      {unknown && (
        <p className="editor-unknown" role="note">
          {t('editor.unknownContent', { types: unknown.join(', ') || '?' })}
        </p>
      )}
      <EditorContent editor={editor} />
      {calloutPick && (
        <CalloutPicker
          editor={editor}
          pos={calloutPick.pos}
          anchor={calloutPick.anchor}
          onClose={() => setCalloutPick(null)}
        />
      )}
      {coarse && focused && !readOnly && <KeyboardToolbar editor={editor} />}
    </div>
  )
}

const selectReadOnly = (s: { readOnly: boolean }) => s.readOnly

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
      link: e.isActive('link'),
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
      {btn(s.link, t('link.add'), () => void promptLink(editor), <Link size={16} />)}
      {btn(
        s.highlight,
        t('editor.highlight'),
        () => editor.chain().focus().toggleHighlight().run(),
        <Highlighter size={16} />,
      )}
    </BubbleMenu>
  )
}
