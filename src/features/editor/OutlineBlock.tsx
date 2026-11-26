import { TextSelection } from '@tiptap/pm/state'
import { NodeViewWrapper, ReactNodeViewRenderer, useEditorState, type ReactNodeViewProps } from '@tiptap/react'
import { t } from '@/core/i18n'
import { headingsOf, Outline, type Heading } from './nodes/outline'

const sameHeadings = (a: Heading[], b: Heading[] | null) =>
  !!b &&
  a.length === b.length &&
  a.every((h, i) => h.pos === b[i]!.pos && h.level === b[i]!.level && h.text === b[i]!.text)

function OutlineView({ editor, selected }: ReactNodeViewProps) {
  const headings = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? headingsOf(e.state.doc) : []),
    equalityFn: sameHeadings,
  })
  const top = Math.min(...headings.map((h) => h.level))
  const go = (pos: number) => {
    const { state, view } = editor
    const sel = TextSelection.near(state.doc.resolve(pos + 1))
    view.dispatch(state.tr.setSelection(sel))
    view.focus()
    const dom = view.nodeDOM(pos)
    if (dom instanceof HTMLElement) dom.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <NodeViewWrapper as="nav" className={`outline${selected ? ' is-selected' : ''}`} aria-label={t('block.outline')}>
      <div className="outline-title" contentEditable={false}>
        {t('block.outline')}
      </div>
      {headings.length === 0 ? (
        <p className="outline-empty">{t('outline.empty')}</p>
      ) : (
        <ul contentEditable={false}>
          {headings.map((h) => (
            <li key={h.pos} style={{ paddingLeft: `${(h.level - top) * 16}px` }}>
              <button type="button" onClick={() => go(h.pos)}>
                {h.text.trim() || t('common.untitled')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </NodeViewWrapper>
  )
}

export const OutlineWithView = Outline.extend({
  addNodeView() {
    return ReactNodeViewRenderer(OutlineView)
  },
})
