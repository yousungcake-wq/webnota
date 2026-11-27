import type { Editor as TEditor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import { t } from '@/core/i18n'
import { useLayout } from '@/platform/layout'
import { Button, Overlay } from '@/ui'
import { loadKatex, renderMath } from './math/katex'
import './math.css'

/**
 * LaTeX editor for math nodes (ED-B15, ED-I06): popover on desktop, bottom sheet on
 * phones, with a live preview. Inline: Enter finishes. Block: Ctrl/⌘+Enter finishes
 * (Enter is a new line). Closing with an empty formula removes the node.
 */
export default function MathEditor({
  editor,
  pos,
  anchor,
  onClose,
}: {
  editor: TEditor
  pos: number
  anchor: HTMLElement
  onClose: () => void
}) {
  const phone = useLayout().layout === 'phone'
  const node = editor.state.doc.nodeAt(pos)
  const display = node?.type.name === 'mathBlock'
  const [latex, setLatex] = useState((node?.attrs.latex as string) ?? '')
  const preview = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void loadKatex().then(() => setReady(true))
  }, [])
  useEffect(() => {
    const el = preview.current
    if (!el || !ready) return
    if (latex.trim()) renderMath(el, latex, display)
    else el.textContent = t('math.previewEmpty')
  }, [latex, ready, display])

  if (!node || (node.type.name !== 'mathBlock' && node.type.name !== 'inlineMath')) return null

  const finish = () => {
    // the node may have moved while editing (remote edits): find it again by identity
    const at = editor.state.doc.nodeAt(pos) === node ? pos : findNode(editor, node)
    if (at !== null) editor.chain().setMath(at, latex.trim()).run()
    onClose()
    editor.commands.focus()
  }

  return (
    <Overlay anchor={anchor} title={t(display ? 'math.blockTitle' : 'math.inlineTitle')} sheet={phone} onClose={finish}>
      <div className="math-editor">
        <textarea
          className="math-input"
          value={latex}
          rows={display ? 4 : 2}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoFocus
          aria-label={t('math.latex')}
          placeholder={display ? 'E = mc^2' : 'x^2'}
          onChange={(e) => setLatex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
            if (!display || e.metaKey || e.ctrlKey) {
              e.preventDefault()
              finish()
            }
          }}
        />
        <div className="math-preview" ref={preview} aria-live="polite" />
        <div className="math-actions">
          <span className="math-tip">{t(display ? 'math.tipBlock' : 'math.tipInline')}</span>
          <Button size="sm" variant="primary" onClick={finish}>
            {t('common.done')}
          </Button>
        </div>
      </div>
    </Overlay>
  )
}

function findNode(editor: TEditor, target: NonNullable<ReturnType<TEditor['state']['doc']['nodeAt']>>) {
  let found: number | null = null
  editor.state.doc.descendants((n, p) => {
    if (n === target) found = p
    return found === null
  })
  return found
}
