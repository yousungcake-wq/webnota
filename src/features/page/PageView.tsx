import type { Editor as TEditor } from '@tiptap/react'
import { ChevronLeft, MoreHorizontal, PanelLeft, SmilePlus, Star } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'
import { openDoc, pageDocName } from '@/core/docs/registry'
import { ws } from '@/core/docs/workspace'
import { ancestorsOf, updatePage, type PageMeta } from '@/core/model/pages'
import { displayTitle } from './titles'
import { usePages } from '@/core/store/pages'
import { goBack, href } from '@/core/store/router'
import { loadEditor } from '@/features/editor'
import { SyncBadge } from '@/features/sync'
import { useMedia } from '@/platform/media'
import { Button, EmptyState, IconButton, LinkButton, Overlay, Skeleton } from '@/ui'
import { toggleFavorite } from './actions'
import { PageMenu } from './PageMenu'
import './page.css'
import { t } from '@/core/i18n'

// The editor (Tiptap + ProseMirror) is the biggest chunk; load it only when a page opens.
const Editor = lazy(() => loadEditor().then((m) => ({ default: m.Editor })))

const EMOJIS = '📄📝📌📎📚📖🗂️📁🗓️✅☑️💡🔥⭐️🎯🚀🧠💼🏠🛒✈️🍳🎵🎮📷🎨🧪💻🔧📊📈💰❤️🌱☕️🐶😀👋🙌🎉'
const emojiList = Array.from(new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(EMOJIS), (s) => s.segment)

export function PageView({
  id,
  sidebarOpen,
  onToggleSidebar,
}: {
  id: string
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
}) {
  const pages = usePages()
  const page = pages.find((p) => p.id === id)
  const phone = useMedia('(max-width: 767px)')
  const [loaded, setLoaded] = useState<{ id: string; doc: Y.Doc } | null>(null)
  const doc = loaded?.id === id ? loaded.doc : null
  const editorRef = useRef<TEditor | null>(null)
  const onReady = useCallback((e: TEditor) => {
    editorRef.current = e
  }, [])

  useEffect(() => {
    let alive = true
    void openDoc(pageDocName(id)).then((d) => alive && setLoaded({ id, doc: d }))
    return () => {
      alive = false
    }
  }, [id])

  const parentId = page?.parentId ?? null
  const crumbs = ancestorsOf(pages, parentId) // O(n), cheap; recomputed per render

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  if (!page) {
    return (
      <EmptyState
        title={t('page.notFound')}
        description={t('page.notFoundHint')}
        action={<LinkButton href={href({ name: 'home' })}>{t('page.goHome')}</LinkButton>}
      />
    )
  }

  return (
    <div className="page">
      <header className="topbar">
        {phone ? (
          <IconButton icon={ChevronLeft} iconSize={22} label={t('common.back')} onClick={goBack} />
        ) : (
          !sidebarOpen && <IconButton icon={PanelLeft} label={t('sidebar.open')} onClick={onToggleSidebar} />
        )}
        <nav className="crumbs" aria-label={t('page.breadcrumbs')}>
          {!phone &&
            crumbs.map((c) => (
              <span key={c.id} className="crumb">
                <a href={href({ name: 'page', id: c.id })}>
                  {c.icon && <span>{c.icon}</span>}
                  {displayTitle(c.title)}
                </a>
                <span className="crumb-sep">/</span>
              </span>
            ))}
          <span className="crumb is-current">
            {page.icon && <span>{page.icon}</span>}
            {displayTitle(page.title)}
          </span>
        </nav>
        <div className="topbar-actions">
          <SyncBadge compact={phone} />
          <IconButton
            icon={Star}
            tone="star"
            active={page.favorite}
            filled={page.favorite}
            label={page.favorite ? t('page.favoriteRemove') : t('page.favoriteAdd')}
            onClick={() => toggleFavorite(page.id)}
          />
          <IconButton icon={MoreHorizontal} label={t('common.more')} onClick={(e) => setMenuAnchor(e.currentTarget)} />
        </div>
      </header>
      {menuAnchor && (
        <PageMenu page={page} anchor={menuAnchor} currentId={page.id} onClose={() => setMenuAnchor(null)} />
      )}

      <div className="page-scroll">
        {/* Keyed by page so the whole subtree (editor DOM managed by ProseMirror included) is replaced in one piece. */}
        <div className="page-body" key={id}>
          <PageHead
            key={page.id}
            page={page}
            onEnter={() => {
              const ed = editorRef.current
              if (!ed) return
              // Focus synchronously (inside the key/tap gesture) so mobile keyboards stay open
              // and no keystrokes land in the title; then place the caret.
              ed.view.dom.focus({ preventScroll: true })
              ed.commands.focus('start')
            }}
          />
          {doc ? (
            <Suspense fallback={<Skeleton className="editor-loading" />}>
              <Editor key={id} doc={doc} onReady={onReady} />
            </Suspense>
          ) : (
            <Skeleton className="editor-loading" />
          )}
        </div>
      </div>
    </div>
  )
}

function PageHead({ page, onEnter }: { page: PageMeta; onEnter: () => void }) {
  const [title, setTitle] = useState(page.title)
  const focused = useRef(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [picker, setPicker] = useState<HTMLElement | null>(null)
  const phone = useMedia('(max-width: 767px)')

  // Follow remote/other-tab title changes unless the user is typing here.
  useEffect(() => {
    if (!focused.current) setTitle(page.title)
  }, [page.title])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [title])

  return (
    <div className="page-head">
      {page.icon ? (
        <button
          type="button"
          className="page-icon"
          aria-label={t('page.changeIcon')}
          onClick={(e) => setPicker(e.currentTarget)}
        >
          {page.icon}
        </button>
      ) : (
        <button type="button" className="add-icon" onClick={(e) => setPicker(e.currentTarget)}>
          <SmilePlus size={16} /> {t('page.addIcon')}
        </button>
      )}
      <textarea
        ref={taRef}
        className="page-title"
        rows={1}
        placeholder={t('common.untitled')}
        value={title}
        aria-label={t('page.titleLabel')}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false
        }}
        onChange={(e) => {
          const v = e.target.value.replace(/\n/g, '')
          setTitle(v)
          updatePage(ws(), page.id, { title: v })
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            onEnter()
          }
        }}
      />
      {picker && (
        <Overlay anchor={picker} title={t('common.icon')} sheet={phone} onClose={() => setPicker(null)}>
          <div className="emoji-grid">
            {emojiList.map((em) => (
              <button
                key={em}
                type="button"
                className="emoji-btn"
                onClick={() => {
                  updatePage(ws(), page.id, { icon: em })
                  setPicker(null)
                }}
              >
                {em}
              </button>
            ))}
          </div>
          {page.icon && (
            <Button
              variant="ghost"
              full
              onClick={() => {
                updatePage(ws(), page.id, { icon: '' })
                setPicker(null)
              }}
            >
              {t('page.removeIcon')}
            </Button>
          )}
        </Overlay>
      )}
    </div>
  )
}
