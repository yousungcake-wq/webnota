import { useEditorState, type Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  CheckSquare,
  ChevronDown,
  Code,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link,
  List,
  Palette,
  Plus,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  Type,
  Underline,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { BLOCKS, type BlockItem } from './blocks'
import { promptLink } from './LinkBubble'
import { recordBlockUse } from './rank'
import { t } from '@/core/i18n'

/**
 * Toolbar pinned to the top of the on-screen keyboard (Android & iOS).
 * Android Chrome shrinks the layout viewport (interactive-widget=resizes-content);
 * iOS Safari doesn't, so we follow window.visualViewport instead.
 */
function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const bottom = window.innerHeight - (vv.height + vv.offsetTop)
      setInset(Math.max(0, Math.round(bottom)))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return inset
}

const keep = (e: React.SyntheticEvent) => e.preventDefault() // don't steal focus from the editor

function Btn({
  label,
  active,
  disabled,
  onPress,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onPress: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`kb-btn${active ? ' is-active' : ''}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={keep}
      onPointerDown={keep}
      onClick={onPress}
    >
      {children}
    </button>
  )
}

export function KeyboardToolbar({ editor, onColor }: { editor: Editor; onColor: () => void }) {
  const inset = useKeyboardInset()
  const [panel, setPanel] = useState<'none' | 'blocks' | 'style'>('none')
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      sup: e.isActive('superscript'),
      sub: e.isActive('subscript'),
      highlight: e.isActive('highlight'),
      link: e.isActive('link'),
      task: e.isActive('taskList'),
      bullet: e.isActive('bulletList'),
      inList: e.isActive('listItem') || e.isActive('taskItem'),
      align: (e.getAttributes('paragraph').textAlign ?? e.getAttributes('heading').textAlign ?? null) as string | null,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const itemType = editor.isActive('taskItem') ? 'taskItem' : 'listItem'
  const c = () => editor.chain().focus()
  const toggle = (p: 'blocks' | 'style') => setPanel(panel === p ? 'none' : p)

  /** `+` (MB-21): an empty line becomes the block; otherwise the block is added below. */
  const addBlock = (b: BlockItem) => {
    recordBlockUse(b.id)
    const { $from } = editor.state.selection
    const emptyLine = $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0
    let chain = c()
    if (!emptyLine && $from.depth >= 1) {
      const after = $from.after(1)
      chain = chain.command(({ tr, state }) => {
        tr.insert(after, state.schema.nodes.paragraph!.create())
        tr.setSelection(TextSelection.create(tr.doc, after + 1))
        return true
      })
    }
    b.run(chain).run()
    setPanel('none')
  }
  const turnInto = (id: string) => {
    const b = BLOCKS.find((x) => x.id === id)
    if (b) b.run(c()).run()
  }
  const align = (value: string | null) =>
    c().updateAttributes('paragraph', { textAlign: value }).updateAttributes('heading', { textAlign: value }).run()

  const style: [string, LucideIcon | null, boolean, () => void][][] = [
    [
      [t('editor.bold'), Bold, s.bold, () => c().toggleBold().run()],
      [t('editor.italic'), Italic, s.italic, () => c().toggleItalic().run()],
      [t('editor.underline'), Underline, s.underline, () => c().toggleUnderline().run()],
      [t('editor.strike'), Strikethrough, s.strike, () => c().toggleStrike().run()],
      [t('editor.inlineCode'), Code, s.code, () => c().toggleCode().run()],
      [t('editor.superscript'), Superscript, s.sup, () => c().toggleSuperscript().run()],
      [t('editor.subscript'), Subscript, s.sub, () => c().toggleSubscript().run()],
    ],
    [
      [t('block.paragraph'), null, BLOCKS.find((b) => b.id === 'text')!.isActive!(editor), () => turnInto('text')],
      [t('block.h1'), null, editor.isActive('heading', { level: 1 }), () => turnInto('h1')],
      [t('block.h2'), null, editor.isActive('heading', { level: 2 }), () => turnInto('h2')],
      [t('block.h3'), null, editor.isActive('heading', { level: 3 }), () => turnInto('h3')],
      [t('block.quote'), null, editor.isActive('blockquote'), () => turnInto('quote')],
    ],
    [
      [t('table.alignLeft'), AlignLeft, !s.align, () => align(null)],
      [t('table.alignCenter'), AlignCenter, s.align === 'center', () => align('center')],
      [t('table.alignRight'), AlignRight, s.align === 'right', () => align('right')],
      [t('editor.highlight'), Highlighter, s.highlight, () => c().toggleHighlight().run()],
      [t('color.title'), Palette, false, onColor],
    ],
  ]

  return (
    <div className="kb-toolbar" style={{ bottom: inset }} onMouseDown={keep}>
      {panel === 'blocks' && (
        <div className="kb-panel" role="menu" aria-label={t('editor.addBlock')}>
          {BLOCKS.map((b) => {
            const Icon = b.icon
            return (
              <button
                key={b.id}
                type="button"
                className="kb-block"
                onMouseDown={keep}
                onPointerDown={keep}
                onClick={() => addBlock(b)}
              >
                <Icon size={20} />
                <span>{b.title}</span>
              </button>
            )
          })}
        </div>
      )}
      {panel === 'style' && (
        <div className="kb-style" role="group" aria-label={t('editor.textStyle')}>
          {style.map((row, i) => (
            <div key={i} className="kb-style-row">
              {row.map(([label, Icon, active, run]) => (
                <button
                  key={label}
                  type="button"
                  className={`kb-style-btn${active ? ' is-active' : ''}${Icon ? '' : ' is-text'}`}
                  aria-label={label}
                  aria-pressed={active}
                  title={label}
                  onMouseDown={keep}
                  onPointerDown={keep}
                  onClick={run}
                >
                  {Icon ? <Icon size={20} /> : label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="kb-row">
        <Btn
          label={panel === 'blocks' ? t('common.close') : t('editor.addBlock')}
          active={panel === 'blocks'}
          onPress={() => toggle('blocks')}
        >
          {panel === 'blocks' ? <X size={20} /> : <Plus size={20} />}
        </Btn>
        <Btn label={t('editor.textStyle')} active={panel === 'style'} onPress={() => toggle('style')}>
          <Type size={20} />
        </Btn>
        <span className="kb-sep" />
        <Btn label={t('block.todo')} active={s.task} onPress={() => c().toggleTaskList().run()}>
          <CheckSquare size={20} />
        </Btn>
        <Btn label={t('block.bullet')} active={s.bullet} onPress={() => c().toggleBulletList().run()}>
          <List size={20} />
        </Btn>
        <Btn label={t('link.add')} active={s.link} onPress={() => void promptLink(editor)}>
          <Link size={20} />
        </Btn>
        <Btn
          label={t('editor.indent')}
          onPress={() => (s.inList ? c().sinkListItem(itemType).run() : c().indentBlock().run())}
        >
          <IndentIncrease size={20} />
        </Btn>
        <Btn label={t('editor.outdent')} onPress={() => c().liftListItem(itemType).run() || c().outdentBlock().run()}>
          <IndentDecrease size={20} />
        </Btn>
        <span className="kb-sep" />
        <Btn label={t('editor.moveUp')} onPress={() => c().moveBlockUp().run()}>
          <ArrowUp size={20} />
        </Btn>
        <Btn label={t('editor.moveDown')} onPress={() => c().moveBlockDown().run()}>
          <ArrowDown size={20} />
        </Btn>
        <span className="kb-sep" />
        <Btn label={t('editor.undo')} disabled={!s.canUndo} onPress={() => c().undo().run()}>
          <Undo2 size={20} />
        </Btn>
        <Btn label={t('editor.redo')} disabled={!s.canRedo} onPress={() => c().redo().run()}>
          <Redo2 size={20} />
        </Btn>
        <Btn label={t('editor.hideKeyboard')} onPress={() => editor.commands.blur()}>
          <ChevronDown size={20} />
        </Btn>
      </div>
    </div>
  )
}
