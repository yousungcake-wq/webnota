import DragHandle from '@tiptap/extension-drag-handle-react'
import type { Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'
import { EditorContent, useEditor, useEditorState, type Editor as TEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import {
  Baseline,
  Bold,
  Code,
  GripVertical,
  Highlighter,
  Italic,
  Link,
  Plus,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { schemaStore } from '@/core/schema'
import { useStore } from '@/core/store/useStore'
import type * as Y from 'yjs'
import { debugCrash } from '@/platform/debug'
import { useLayout } from '@/platform/layout'
import { docSchema, editorExtensions } from './extensions'
import { findUnknownContent } from './unknown'
import { CalloutPicker } from './CalloutPicker'
import { KeyboardToolbar } from './KeyboardToolbar'
import type { MathEditRequest } from './mathNodes'
import { ColorPicker } from './ColorPicker'
import { LinkBubble, LinkSheet, promptLink } from './LinkBubble'
import { openHref } from './link'
import { useCaretAutoScroll, useLongPressBlock } from './mobileHooks'
import { findBlock } from './blockOps'
import { blockRangeOf, blockRangePositions, selectedBlockPositions } from './blockSelection'
import { hasTable, isCellSelection, loadTableKit, TableMenu } from './TableMenu'
import './editor.css'
import { t } from '@/core/i18n'

// LaTeX editor for math nodes: loads with the first formula edit.
const MathEditor = lazy(() => import('./MathEditor'))
// Opened by a click or shortcut: not part of the editor chunk (spec/10 §1.1).
const BlockMenu = lazy(() => import('./BlockMenu').then((m) => ({ default: m.BlockMenu })))
const FindBar = lazy(() => import('./FindBar').then((m) => ({ default: m.FindBar })))

interface Props {
  doc: Y.Doc
  /** The page's view id (parent of sub-page blocks). */
  pageId?: string
  /** Block to scroll to and flash (block link, ED-F15). */
  focusBlock?: string
  /** Locked page (WS-13): read-only until unlocked. */
  locked?: boolean
  onReady?: (editor: TEditor) => void
}

export function Editor({ doc, pageId, focusBlock, onReady, locked = false }: Props) {
  debugCrash('editor')
  const coarse = useLayout().isTouch
  const schemaReadOnly = useStore(schemaStore, selectReadOnly)
  // Content from a newer app version (ED-B23): kept as is, page opens read-only.
  const [unknown, setUnknown] = useState<string[] | null>(null)
  const readOnly = schemaReadOnly || unknown !== null || locked
  const editor = useEditor(
    {
      extensions: editorExtensions(doc, {
        pageId,
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
    [doc, pageId],
  )

  useEffect(() => {
    if (editor) onReady?.(editor)
  }, [editor, onReady])

  // Callout icon clicks (nodes/callout.ts) open the picker.
  const [calloutPick, setCalloutPick] = useState<{ pos: number; anchor: HTMLElement } | null>(null)
  // Links: read-only → open on click; phone editing → link sheet (MB-25); desktop uses LinkBubble.
  const [linkTap, setLinkTap] = useState<{ href: string; anchor: HTMLElement } | null>(null)
  // Text/background color picker (ED-I03), opened from the format bubble or the keyboard toolbar.
  const [colorPick, setColorPick] = useState(false)
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !editor) return
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('.wn-editor a[href]')
      if (!a) return
      e.preventDefault()
      if (!editor.isEditable || e.metaKey || e.ctrlKey) openHref(a.getAttribute('href') ?? '')
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

  // Math node clicks and new math nodes (mathNodes.ts) open the LaTeX editor.
  const [mathEdit, setMathEdit] = useState<MathEditRequest | null>(null)
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !editor) return
    const onEdit = (e: Event) => editor.isEditable && setMathEdit((e as CustomEvent<MathEditRequest>).detail)
    wrap.addEventListener('wn-math-edit', onEdit)
    return () => wrap.removeEventListener('wn-math-edit', onEdit)
  }, [editor])

  // Block link target (ED-F15): scroll to it and flash it. y-sync fills the editor a tick
  // after creation, so keep looking on updates until the block shows up.
  useEffect(() => {
    if (!editor || !focusBlock) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const tryFocus = () => {
      const pos = findBlock(editor.state.doc, focusBlock)
      const dom = pos >= 0 ? editor.view.nodeDOM(pos) : null
      if (!(dom instanceof HTMLElement)) return
      editor.off('update', tryFocus)
      dom.scrollIntoView({ block: 'center' })
      editor.commands.flashBlock(focusBlock)
      timer = setTimeout(() => !editor.isDestroyed && editor.commands.flashBlock(null), 2000)
    }
    editor.on('update', tryFocus)
    tryFocus()
    return () => {
      editor.off('update', tryFocus)
      clearTimeout(timer)
    }
  }, [editor, focusBlock])

  // Find & replace (ED-F07): ⌘F while this page is shown, or the page menu (phones).
  const [finding, setFinding] = useState(false)
  useEffect(() => {
    const open = () => setFinding(true)
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'f') {
        const active = document.activeElement
        if (active && active !== document.body && !wrapRef.current?.closest('.page')?.contains(active)) return
        e.preventDefault()
        setFinding(true)
      }
    }
    window.addEventListener('webnota:find', open)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('webnota:find', open)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // Block menu (ED-F03): the drag handle's grip opens it for the hovered block.
  const [blockMenu, setBlockMenu] = useState<{
    pos: number
    anchor: HTMLElement
    selection?: { positions: number[]; from: number; to: number }
  } | null>(null)
  const openBlockMenu = (pos: number, anchor: HTMLElement) => {
    if (!editor) return
    // a click on one of several selected blocks acts on all of them (ED-F04)
    const positions = selectedBlockPositions(editor.state)
    const range = blockRangeOf(editor.state)
    const selection =
      range && positions.length > 1 && positions.includes(pos)
        ? { positions, ...blockRangePositions(editor.state.doc, range) }
        : undefined
    setBlockMenu({ pos, anchor, selection })
  }

  // Phones: long press on a block (not while typing) opens its menu (MB-23); keep the caret
  // above the keyboard (MB-24).
  useLongPressBlock(editor, wrapRef, coarse && !readOnly, openBlockMenu)
  useCaretAutoScroll(editor, coarse)
  const blockMenuAtCaret = (anchor: HTMLElement) => {
    if (!editor) return
    const { $from } = editor.state.selection
    if ($from.depth >= 1) openBlockMenu($from.before(1), anchor)
  }

  // Dragging in the page margin (outside the text) selects whole blocks (ED-F04).
  useEffect(() => {
    const body = wrapRef.current?.closest<HTMLElement>('.page-body')
    if (!body || !editor || coarse) return
    const indexAtY = (y: number) => {
      const rect = editor.view.dom.getBoundingClientRect()
      const top = Math.min(Math.max(y, rect.top + 1), rect.bottom - 1)
      const hit = editor.view.posAtCoords({ left: rect.left + rect.width / 2, top })
      return hit ? editor.state.doc.resolve(hit.pos).index(0) : null
    }
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (e.button !== 0 || !editor.isEditable) return
      if (target.closest('.wn-editor, .page-head, button, input, a, .block-actions, [role="dialog"]')) return
      const rect = editor.view.dom.getBoundingClientRect()
      if (e.clientY < rect.top) return
      const anchor = indexAtY(e.clientY)
      if (anchor === null) return
      e.preventDefault()
      editor.view.focus()
      editor.commands.selectBlocks(anchor, anchor)
      const onMove = (ev: MouseEvent) => {
        const head = indexAtY(ev.clientY)
        const r = blockRangeOf(editor.state)
        if (head !== null && r && head !== r.head) editor.commands.selectBlocks(anchor, head)
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }
    body.addEventListener('mousedown', onDown)
    return () => body.removeEventListener('mousedown', onDown)
  }, [editor, coarse])

  // Table editing (ED-B16) loads with the first table on the page, then stays registered.
  useEffect(() => {
    if (!editor) return
    let loaded = false
    const check = () => {
      if (loaded || !hasTable(editor.state.doc)) return
      loaded = true
      void loadTableKit().then((kit) => {
        const register = () => {
          if (editor.isDestroyed) return
          // before the other plugins so Tab moves between cells
          for (const p of kit.tablePlugins().reverse()) editor.registerPlugin(p, (pl, list) => [pl, ...list])
        }
        // reconfiguring the editor mid-composition would commit the IME's partial syllable (ㅎ한글)
        if (editor.view.composing) editor.view.dom.addEventListener('compositionend', register, { once: true })
        else register()
      })
    }
    check()
    editor.on('update', check)
    return () => {
      editor.off('update', check)
    }
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
            <button
              type="button"
              className="block-btn grip"
              title={t('editor.dragToMove')}
              aria-label={t('blockMenu.title')}
              onClick={(e) => {
                const { pos } = hovered.current
                if (pos >= 0) openBlockMenu(pos, e.currentTarget)
              }}
            >
              <GripVertical size={16} />
            </button>
          </div>
        </DragHandle>
      )}
      {!coarse && !readOnly && <FormatBubble editor={editor} onColor={() => setColorPick(true)} />}
      {!coarse && !readOnly && <LinkBubble editor={editor} />}
      {!readOnly && <TableMenu editor={editor} />}
      {finding && (
        <Suspense fallback={null}>
          <FindBar editor={editor} onClose={() => setFinding(false)} />
        </Suspense>
      )}
      {blockMenu && (
        <Suspense fallback={null}>
          <BlockMenu
            editor={editor}
            pos={blockMenu.pos}
            pageId={pageId}
            anchor={blockMenu.anchor}
            selection={blockMenu.selection}
            onClose={() => setBlockMenu(null)}
          />
        </Suspense>
      )}
      {colorPick && (
        <ColorPicker editor={editor} anchor={selectionAnchor(editor)} onClose={() => setColorPick(false)} />
      )}
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
      {mathEdit && (
        <Suspense fallback={null}>
          <MathEditor
            key={mathEdit.pos}
            editor={editor}
            pos={mathEdit.pos}
            anchor={mathEdit.anchor}
            onClose={() => setMathEdit(null)}
          />
        </Suspense>
      )}
      {coarse && focused && !readOnly && (
        <KeyboardToolbar editor={editor} onColor={() => setColorPick(true)} onBlockMenu={blockMenuAtCaret} />
      )}
    </div>
  )
}

const selectReadOnly = (s: { readOnly: boolean }) => s.readOnly

/** Element holding the end of the selection: a stable anchor once the bubble menu hides. */
function selectionAnchor(editor: TEditor): HTMLElement | null {
  const { node } = editor.view.domAtPos(editor.state.selection.to)
  return node instanceof HTMLElement ? node : node.parentElement
}

function FormatBubble({ editor, onColor }: { editor: TEditor; onColor: () => void }) {
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
      color: e.isActive('textStyle'),
      sup: e.isActive('superscript'),
      sub: e.isActive('subscript'),
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
      shouldShow={({ editor: e, state, from, to }) =>
        from !== to &&
        !e.isActive('codeBlock') &&
        !isCellSelection(state) &&
        !(state.selection instanceof NodeSelection)
      }
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
      {btn(s.color, t('color.title'), onColor, <Baseline size={16} />)}
      {btn(
        s.sup,
        t('editor.superscript'),
        () => editor.chain().focus().toggleSuperscript().run(),
        <Superscript size={16} />,
      )}
      {btn(s.sub, t('editor.subscript'), () => editor.chain().focus().toggleSubscript().run(), <Subscript size={16} />)}
    </BubbleMenu>
  )
}
