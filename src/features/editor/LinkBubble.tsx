import type { Editor as TEditor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Check, Copy, ExternalLink, Pencil, Unlink } from 'lucide-react'
import { TextSelection } from '@tiptap/pm/state'
import { useState } from 'react'
import { t } from '@/core/i18n'
import { Menu, promptDialog, toast } from '@/ui'
import { normalizeUrl, openHref as open } from './link'

/**
 * Sets (or with an empty address removes) the link on the selection or the link under
 * the caret, then puts the caret right after the link with the selection collapsed —
 * so typing continues after it instead of replacing the linked text, and doesn't extend
 * the link. With nothing selected and no link under the caret, the address itself is
 * inserted as linked text.
 */
export function applyLink(editor: TEditor, value: string) {
  const url = normalizeUrl(value)
  const { empty } = editor.state.selection
  const chain = editor.chain().focus()
  if (!url) {
    chain.extendMarkRange('link').unsetLink().run()
    return
  }
  if (empty && !editor.isActive('link')) {
    chain.insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] })
  } else {
    chain.extendMarkRange('link').setLink({ href: url })
  }
  chain
    .command(({ tr, state }) => {
      tr.setSelection(TextSelection.create(tr.doc, tr.selection.to))
      tr.removeStoredMark(state.schema.marks.link!)
      return true
    })
    .run()
}

const linkHref = (e: TEditor) => (e.getAttributes('link').href as string | undefined) ?? ''
const copy = (href: string) =>
  void navigator.clipboard?.writeText(href).then(
    () => toast(t('page.linkCopied')),
    () => toast(t('page.linkCopyFailed'), { tone: 'error' }),
  )

/** Desktop: floating bar on a link under the caret — open, copy, edit, remove (ED-I02). */
export function LinkBubble({ editor }: { editor: TEditor }) {
  const href = useEditorState({ editor, selector: ({ editor: e }) => (e.isActive('link') ? linkHref(e) : '') })
  const [editing, setEditing] = useState<string | null>(null)
  const apply = (value: string) => {
    applyLink(editor, value)
    setEditing(null)
  }
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="linkBubble"
      className="bubble link-bubble"
      shouldShow={({ editor: e, from, to }) => (from === to && e.isActive('link')) || editing !== null}
    >
      {editing !== null ? (
        <form
          className="link-edit"
          onSubmit={(e) => {
            e.preventDefault()
            apply(editing)
          }}
        >
          <input
            autoFocus
            aria-label={t('link.url')}
            value={editing}
            placeholder="https://"
            onChange={(e) => setEditing(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditing(null)
                editor.commands.focus()
              }
            }}
          />
          <button type="submit" className="fmt-btn" aria-label={t('common.save')}>
            <Check size={16} />
          </button>
        </form>
      ) : (
        <>
          <a
            className="link-href"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onMouseDown={(e) => e.preventDefault()}
          >
            {href}
          </a>
          <button
            type="button"
            className="fmt-btn"
            aria-label={t('link.open')}
            title={t('link.open')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => open(href)}
          >
            <ExternalLink size={16} />
          </button>
          <button
            type="button"
            className="fmt-btn"
            aria-label={t('link.copy')}
            title={t('link.copy')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => copy(href)}
          >
            <Copy size={16} />
          </button>
          <button
            type="button"
            className="fmt-btn"
            aria-label={t('link.edit')}
            title={t('link.edit')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setEditing(href)}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="fmt-btn"
            aria-label={t('link.remove')}
            title={t('link.remove')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
          >
            <Unlink size={16} />
          </button>
        </>
      )}
    </BubbleMenu>
  )
}

/** Asks for a URL and links the selection (bubble / toolbar "link" button). */
export async function promptLink(editor: TEditor) {
  const current = editor.isActive('link') ? linkHref(editor) : ''
  const value = await promptDialog({ title: t('link.add'), label: t('link.url'), value: current })
  if (value !== null) applyLink(editor, value)
}

/** Phone: tapping a link while editing opens this sheet (MB-25). */
export function LinkSheet({
  editor,
  href,
  anchor,
  onClose,
}: {
  editor: TEditor
  href: string
  anchor: HTMLElement
  onClose: () => void
}) {
  return (
    <Menu
      anchor={anchor}
      title={href}
      onClose={onClose}
      items={[
        { label: t('link.open'), icon: ExternalLink, onSelect: () => open(href) },
        { label: t('link.edit'), icon: Pencil, onSelect: () => void promptLink(editor) },
        { label: t('link.copy'), icon: Copy, onSelect: () => copy(href) },
        {
          label: t('link.remove'),
          icon: Unlink,
          danger: true,
          onSelect: () => editor.chain().focus().extendMarkRange('link').unsetLink().run(),
        },
      ]}
    />
  )
}
