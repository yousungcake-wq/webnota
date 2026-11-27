import type { Editor as TEditor } from '@tiptap/react'
import { ChevronLeft, ImagePlus, Lock, MoreHorizontal, PanelLeft, SmilePlus, Star } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
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
import { goBack, href, navigate, useRoute } from '@/core/store/router'
import { loadEditor } from '@/features/editor'
import { loadDatabase } from '@/features/database'
import * as Y from 'yjs'
import { setCover } from '@/core/model/page'
import { coverBackground, usePageMeta } from './pageMeta'
import { SyncBadge } from '@/features/sync'
import { useLayout } from '@/platform/layout'
import { Button, confirmDialog, EmptyState, ErrorBoundary, IconButton, LinkButton, Menu, Skeleton } from '@/ui'
import { collapseCrumbs } from './crumbs'
import { deleteForever, restore, toggleFavorite } from './actions'
import { PageMenu } from './LazyPageMenu'
import './page.css'
import { t } from '@/core/i18n'

// The editor (Tiptap + ProseMirror) is the biggest chunk; load it only when a page opens.
const Editor = lazy(() => loadEditor().then((m) => ({ default: m.Editor })))
// Database views (spec/05) are their own lazy chunk.
const DatabaseView = lazy(() => loadDatabase().then((m) => ({ default: m.DatabaseView })))
const PageCover = lazy(() => import('./PageCover').then((m) => ({ default: m.PageCover })))
const PageStylePanel = lazy(() => import('./pageStyleViews').then((m) => ({ default: m.PageStylePanel })))
/** Stand-in until the page document is loaded (hooks need a doc). */
const NO_DOC = new Y.Doc()

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
  const route = useRoute()
  const block = route.name === 'page' && route.id === id ? route.block : undefined
  const phone = useLayout().layout === 'phone'
  const [loaded, setLoaded] = useState<{ id: string; doc: Y.Doc } | null>(null)
  const doc = loaded?.id === id ? loaded.doc : null
  const editorRef = useRef<TEditor | null>(null)
  const onReady = useCallback((e: TEditor) => {
    editorRef.current = e
  }, [])

  const isDb = page?.kind === 'database'
  useEffect(() => {
    if (isDb) return // a database keeps its data in db/<id> (spec/02 §4), not a page doc
    let alive = true
    const release = retainDoc(pageDocName(id)) // keep it loaded while visible (SY-01 LRU)
    void openDoc(pageDocName(id)).then((d) => alive && setLoaded({ id, doc: d }))
    return () => {
      alive = false
      release()
    }
  }, [id, isDb])

  const inTrash = page ? trashedSelfOrAncestor(pages, page) : false
  const parentId = page?.parentId ?? null
  const crumbs = ancestorsOf(pages, parentId) // O(n), cheap; recomputed per render

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [moreButton, setMoreButton] = useState<HTMLElement | null>(null)
  const { style, cover } = usePageMeta(doc ?? NO_DOC)
  // "Page style" in the page menu (ED-F10) opens the panel under the ⋯ button
  const [styleOpen, setStyleOpen] = useState(false)
  useEffect(() => {
    const open = () => setStyleOpen(true)
    window.addEventListener('webnota:page-style', open)
    return () => window.removeEventListener('webnota:page-style', open)
  }, [])
  const readOnly = useStore(schemaStore).readOnly || !!page?.locked || inTrash

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
          !sidebarOpen && (
            <IconButton icon={PanelLeft} label={t('sidebar.open')} onClick={onToggleSidebar} data-sidebar-peek />
          )
        )}
        <nav className="crumbs" aria-label={t('page.breadcrumbs')}>
          {!phone && <Crumbs crumbs={crumbs} />}
          <span className="crumb is-current">
            {page.icon && (
              <span>
                <ViewIcon icon={page.icon} layout={page.layout} />
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
          <IconButton
            icon={MoreHorizontal}
            label={t('common.more')}
            onClick={(e) => {
              setMoreButton(e.currentTarget)
              setMenuAnchor(e.currentTarget)
            }}
          />
        </div>
      </header>
      {menuAnchor && <PageMenu page={page} anchor={menuAnchor} where="page" onClose={() => setMenuAnchor(null)} />}
      {styleOpen && doc && (
        <Suspense fallback={null}>
          <PageStylePanel doc={doc} anchor={moreButton} readOnly={readOnly} onClose={() => setStyleOpen(false)} />
        </Suspense>
      )}
      {page.locked && !inTrash && (
        <div className="lock-banner" role="status">
          <Lock size={14} aria-hidden />
          <span>{t('page.lockedBanner')}</span>
          <Button size="sm" onClick={() => updateView(ws(), page.id, { locked: false })}>
            {t('page.unlock')}
          </Button>
        </div>
      )}

      {inTrash && (
        <div className="trash-banner" role="status">
          <span>{t('trash.inTrash')}</span>
          <Button size="sm" onClick={() => restoreWithAncestors(pages, page.id)}>
            {t('trash.restore')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() =>
              void confirmDialog({
                title: t('trash.deleteTitle'),
                message: t('trash.confirmDelete', { title: displayTitle(page.title) }),
                confirmLabel: t('trash.deleteForever'),
                danger: true,
              }).then((ok) => {
                if (!ok) return
                navigate({ name: 'home' }, { replace: true })
                void deleteForever(page.id)
              })
            }
          >
            {t('trash.deleteForever')}
          </Button>
        </div>
      )}
      <div className="page-scroll">
        {doc && cover && (
          // same box while the cover code loads: no layout shift
          <Suspense fallback={<div className="page-cover" style={{ background: coverBackground(cover) }} />}>
            <PageCover key={id} doc={doc} cover={cover} readOnly={readOnly} />
          </Suspense>
        )}
        {/* Keyed by page so the whole subtree (editor DOM managed by ProseMirror included) is replaced in one piece. */}
        <div
          className={`page-body${style.fullWidth || isDb ? ' is-full' : ''}`}
          key={id}
          data-font={style.font}
          data-size={style.fontSize}
          data-line={style.lineHeight}
        >
          <PageHead
            key={page.id}
            page={page}
            inTrash={inTrash}
            onAddCover={doc && !cover ? () => setCover(doc, { type: 'gradient', value: 'g1' }) : undefined}
            onEnter={() => {
              const ed = editorRef.current
              if (!ed) return
              // Focus synchronously (inside the key/tap gesture) so mobile keyboards stay open
              // and no keystrokes land in the title; then place the caret.
              ed.view.dom.focus({ preventScroll: true })
              ed.commands.focus('start')
            }}
          />
          {isDb ? (
            <Suspense fallback={<Skeleton className="editor-loading" />}>
              <ErrorBoundary key={id} title={t('error.database')}>
                <DatabaseView key={id} view={page} readOnly={readOnly} />
              </ErrorBoundary>
            </Suspense>
          ) : doc ? (
            <Suspense fallback={<Skeleton className="editor-loading" />}>
              <ErrorBoundary key={id} title={t('error.editor')}>
                <Editor
                  key={id}
                  doc={doc}
                  pageId={id}
                  focusBlock={block}
                  onReady={onReady}
                  locked={page.locked || inTrash}
                />
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

function PageHead({
  page,
  inTrash,
  onEnter,
  onAddCover,
}: {
  page: ViewMeta
  inTrash: boolean
  onEnter: () => void
  onAddCover?: () => void
}) {
  const [title, setTitle] = useState(page.title)
  const focused = useRef(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const readOnly = useStore(schemaStore).readOnly || page.locked || inTrash
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
      {!readOnly && onAddCover && (
        <button type="button" className="add-icon add-cover" onClick={onAddCover}>
          <ImagePlus size={16} /> {t('cover.add')}
        </button>
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

/** The view or one of its ancestors is in the trash (not merely detached from its space). */
function trashedSelfOrAncestor(views: ViewMeta[], view: ViewMeta) {
  return [view, ...ancestorsOf(views, view.parentId)].some((v) => v.deletedAt)
}

/** Restores the view and any trashed ancestor so it becomes visible again. */
function restoreWithAncestors(views: ViewMeta[], id: string) {
  const view = views.find((v) => v.id === id)
  if (!view) return
  for (const v of [...ancestorsOf(views, view.parentId), view]) if (v.deletedAt) restore(v.id)
}

function Crumb({ c }: { c: ViewMeta }) {
  return (
    <span className="crumb">
      <a href={href({ name: 'page', id: c.id })}>
        {c.icon && (
          <span>
            <ViewIcon icon={c.icon} layout={c.layout} />
          </span>
        )}
        {displayTitle(c.title)}
      </a>
      <span className="crumb-sep">/</span>
    </span>
  )
}

/** Ancestors, middle-collapsed into "…" (a menu) when the trail is long (WS-09). */
function Crumbs({ crumbs }: { crumbs: ViewMeta[] }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const { head, hidden, tail } = collapseCrumbs(crumbs)
  return (
    <>
      {head.map((c) => (
        <Crumb key={c.id} c={c} />
      ))}
      {hidden.length > 0 && (
        <span className="crumb">
          <button
            type="button"
            className="crumb-more"
            aria-label={t('page.breadcrumbsMore')}
            onClick={(e) => setAnchor(e.currentTarget)}
          >
            …
          </button>
          <span className="crumb-sep">/</span>
          {anchor && (
            <Menu
              anchor={anchor}
              title={t('page.breadcrumbs')}
              onClose={() => setAnchor(null)}
              items={hidden.map((c) => ({
                label: displayTitle(c.title),
                onSelect: () => navigate({ name: 'page', id: c.id }),
              }))}
            />
          )}
        </span>
      )}
      {tail.map((c) => (
        <Crumb key={c.id} c={c} />
      ))}
    </>
  )
}
