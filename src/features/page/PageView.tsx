import type { Editor as TEditor } from '@tiptap/react'
import { ChevronLeft, Lock, MoreHorizontal, PanelLeft, SmilePlus, Star } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'
import { openDoc, pageDocName, retainDoc } from '@/core/docs/registry'
import { ws } from '@/core/docs/workspace'
import { ancestorsOf, updateView, type ViewMeta } from '@/core/model/views'
import { displayTitle } from './titles'
import { openIconPicker } from './overlays'
import { renameStore } from './rename'
import { ViewIcon } from './ViewIcon'
import { useViews } from '@/core/store/views'
import { schemaStore } from '@/core/schema'
import { useStore } from '@/core/store/useStore'
import { goBack, href } from '@/core/store/router'
import { loadEditor } from '@/features/editor'
import { SyncBadge } from '@/features/sync'
import { useLayout } from '@/platform/layout'
import { EmptyState, ErrorBoundary, IconButton, LinkButton, Skeleton } from '@/ui'
import { toggleFavorite } from './actions'
import { PageMenu } from './LazyPageMenu'
import './page.css'
import { t } from '@/core/i18n'

// The editor (Tiptap + ProseMirror) is the biggest chunk; load it only when a page opens.
const Editor = lazy(() => loadEditor().then((m) => ({ default: m.Editor })))

export function PageView({
  id,
  sidebarOpen,
  onToggleSidebar,
}: {
  id: string
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
}) {
  const pages = useViews()
  const page = pages.find((p) => p.id === id)
  const phone = useLayout().layout === 'phone'
  const [loaded, setLoaded] = useState<{ id: string; doc: Y.Doc } | null>(null)
  const doc = loaded?.id === id ? loaded.doc : null
  const editorRef = useRef<TEditor | null>(null)
  const onReady = useCallback((e: TEditor) => {
    editorRef.current = e
  }, [])

  useEffect(() => {
    let alive = true
    const release = retainDoc(pageDocName(id)) // keep it loaded while visible (SY-01 LRU)
    void openDoc(pageDocName(id)).then((d) => alive && setLoaded({ id, doc: d }))
    return () => {
      alive = false
      release()
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
                  {c.icon && (
                    <span>
                      <ViewIcon icon={c.icon} />
                    </span>
                  )}
                  {displayTitle(c.title)}
                </a>
                <span className="crumb-sep">/</span>
              </span>
            ))}
          <span className="crumb is-current">
            {page.icon && (
              <span>
                <ViewIcon icon={page.icon} />
              </span>
            )}
            {displayTitle(page.title)}
          </span>
        </nav>
        <div className="topbar-actions">
          <SyncBadge compact={phone} />
          {page.locked && (
            <IconButton
              icon={Lock}
              label={t('page.unlock')}
              onClick={() => updateView(ws(), page.id, { locked: false })}
            />
          )}
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
      {menuAnchor && <PageMenu page={page} anchor={menuAnchor} where="page" onClose={() => setMenuAnchor(null)} />}

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
              <ErrorBoundary key={id} title={t('error.editor')}>
                <Editor key={id} doc={doc} onReady={onReady} locked={page.locked} />
              </ErrorBoundary>
            </Suspense>
          ) : (
            <Skeleton className="editor-loading" />
          )}
        </div>
      </div>
    </div>
  )
}

function PageHead({ page, onEnter }: { page: ViewMeta; onEnter: () => void }) {
  const [title, setTitle] = useState(page.title)
  const focused = useRef(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const readOnly = useStore(schemaStore).readOnly || page.locked
  const renaming = useStore(renameStore, (r) => r?.id === page.id && r.where === 'page')
  useEffect(() => {
    if (!renaming) return
    renameStore.set(null)
    taRef.current?.focus()
    taRef.current?.select()
  }, [renaming])

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
          disabled={readOnly}
          onClick={(e) => openIconPicker(page.id, e.currentTarget)}
        >
          <ViewIcon icon={page.icon} size={48} />
        </button>
      ) : (
        !readOnly && (
          <button type="button" className="add-icon" onClick={(e) => openIconPicker(page.id, e.currentTarget)}>
            <SmilePlus size={16} /> {t('page.addIcon')}
          </button>
        )
      )}
      <textarea
        ref={taRef}
        className="page-title"
        rows={1}
        placeholder={t('common.untitled')}
        value={title}
        aria-label={t('page.titleLabel')}
        readOnly={readOnly}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false
        }}
        onChange={(e) => {
          const v = e.target.value.replace(/\n/g, '')
          setTitle(v)
          updateView(ws(), page.id, { title: v })
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            onEnter()
          }
        }}
      />
    </div>
  )
}
