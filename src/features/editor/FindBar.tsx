import { useEditorState, type Editor as TEditor } from '@tiptap/react'
import { CaseSensitive, ChevronDown, ChevronUp, Replace, X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { t } from '@/core/i18n'
import { findStateOf } from './findReplace'

/** Find & replace bar (ED-F07): ⌘F on desktop, page menu on phones. */
export function FindBar({ editor, onClose }: { editor: TEditor; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [replacing, setReplacing] = useState(false)
  const [replacement, setReplacement] = useState('')
  const f = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const s = findStateOf(e.state)
      return { query: s.query, caseSensitive: s.caseSensitive, count: s.matches.length, current: s.current }
    },
  })
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])
  const close = () => {
    editor.commands.clearFind()
    onClose()
    editor.commands.focus()
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      editor.commands.findStep(e.shiftKey ? -1 : 1)
    }
  }
  return (
    <div className="find-bar" role="search" aria-label={t('find.title')}>
      <div className="find-row">
        <input
          ref={inputRef}
          className="find-input"
          aria-label={t('find.query')}
          placeholder={t('find.query')}
          defaultValue={f.query}
          onChange={(e) => editor.commands.setFind({ query: e.target.value })}
          onKeyDown={onKey}
        />
        <span className="find-count" aria-live="polite">
          {f.query ? (f.count ? `${f.current + 1}/${f.count}` : t('find.none')) : ''}
        </span>
        <button
          type="button"
          className={`find-btn${f.caseSensitive ? ' is-active' : ''}`}
          aria-pressed={f.caseSensitive}
          aria-label={t('find.caseSensitive')}
          title={t('find.caseSensitive')}
          onClick={() => editor.commands.setFind({ caseSensitive: !f.caseSensitive })}
        >
          <CaseSensitive size={18} />
        </button>
        <button
          type="button"
          className="find-btn"
          aria-label={t('find.prev')}
          title={t('find.prev')}
          disabled={!f.count}
          onClick={() => editor.commands.findStep(-1)}
        >
          <ChevronUp size={18} />
        </button>
        <button
          type="button"
          className="find-btn"
          aria-label={t('find.next')}
          title={t('find.next')}
          disabled={!f.count}
          onClick={() => editor.commands.findStep(1)}
        >
          <ChevronDown size={18} />
        </button>
        <button
          type="button"
          className={`find-btn${replacing ? ' is-active' : ''}`}
          aria-pressed={replacing}
          aria-label={t('find.replaceToggle')}
          title={t('find.replaceToggle')}
          disabled={!editor.isEditable}
          onClick={() => setReplacing(!replacing)}
        >
          <Replace size={18} />
        </button>
        <button type="button" className="find-btn" aria-label={t('common.close')} onClick={close}>
          <X size={18} />
        </button>
      </div>
      {replacing && editor.isEditable && (
        <div className="find-row">
          <input
            className="find-input"
            aria-label={t('find.replaceWith')}
            placeholder={t('find.replaceWith')}
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                editor.commands.replaceCurrent(replacement)
              } else if (e.key === 'Escape') close()
            }}
          />
          <button
            type="button"
            className="btn find-action"
            disabled={!f.count}
            onClick={() => editor.commands.replaceCurrent(replacement)}
          >
            {t('find.replace')}
          </button>
          <button
            type="button"
            className="btn find-action"
            disabled={!f.count}
            onClick={() => editor.commands.replaceAll(replacement)}
          >
            {t('find.replaceAll')}
          </button>
        </div>
      )}
    </div>
  )
}
