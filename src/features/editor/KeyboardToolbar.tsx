import { useEditorState, type Editor } from '@tiptap/react'
import {
  ArrowDown,
  ArrowUp,
  Bold,
  CheckSquare,
  ChevronDown,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  Plus,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { BLOCKS } from './blocks'
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

export function KeyboardToolbar({ editor }: { editor: Editor }) {
  const inset = useKeyboardInset()
  const [panel, setPanel] = useState<'none' | 'blocks'>('none')
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      task: e.isActive('taskList'),
      bullet: e.isActive('bulletList'),
      inList: e.isActive('listItem') || e.isActive('taskItem'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const itemType = editor.isActive('taskItem') ? 'taskItem' : 'listItem'
  const c = () => editor.chain().focus()

  return (
    <div className="kb-toolbar" style={{ bottom: inset }} onMouseDown={keep}>
      {panel === 'blocks' && (
        <div className="kb-panel" role="menu">
          {BLOCKS.map((b) => {
            const Icon = b.icon
            return (
              <button
                key={b.id}
                type="button"
                className={`kb-block${b.isActive?.(editor) ? ' is-active' : ''}`}
                onMouseDown={keep}
                onPointerDown={keep}
                onClick={() => {
                  b.run(c()).run()
                  setPanel('none')
                }}
              >
                <Icon size={20} />
                <span>{b.title}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="kb-row">
        <Btn
          label={panel === 'blocks' ? t('common.close') : t('editor.changeBlock')}
          active={panel === 'blocks'}
          onPress={() => setPanel(panel === 'blocks' ? 'none' : 'blocks')}
        >
          {panel === 'blocks' ? <X size={20} /> : <Plus size={20} />}
        </Btn>
        <span className="kb-sep" />
        <Btn label={t('editor.bold')} active={s.bold} onPress={() => c().toggleBold().run()}>
          <Bold size={20} />
        </Btn>
        <Btn label={t('editor.italic')} active={s.italic} onPress={() => c().toggleItalic().run()}>
          <Italic size={20} />
        </Btn>
        <Btn label={t('editor.underline')} active={s.underline} onPress={() => c().toggleUnderline().run()}>
          <Underline size={20} />
        </Btn>
        <Btn label={t('editor.strike')} active={s.strike} onPress={() => c().toggleStrike().run()}>
          <Strikethrough size={20} />
        </Btn>
        <span className="kb-sep" />
        <Btn label={t('block.todo')} active={s.task} onPress={() => c().toggleTaskList().run()}>
          <CheckSquare size={20} />
        </Btn>
        <Btn label={t('block.bullet')} active={s.bullet} onPress={() => c().toggleBulletList().run()}>
          <List size={20} />
        </Btn>
        <Btn label={t('editor.indent')} disabled={!s.inList} onPress={() => c().sinkListItem(itemType).run()}>
          <IndentIncrease size={20} />
        </Btn>
        <Btn label={t('editor.outdent')} disabled={!s.inList} onPress={() => c().liftListItem(itemType).run()}>
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
