import type { Editor as TEditor } from '@tiptap/react'
import { ChevronLeft, MoreHorizontal, PanelLeft, SmilePlus, Star } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type * as Y from 'yjs'
import { Editor } from '../editor/Editor'
import { openDoc, pageDocName } from '../store/docs'
import { updatePage, type PageMeta } from '../store/pages'
import { usePages, ws } from '../store/workspace'
import { displayTitle, toggleFavorite } from './actions'
import { goBack, href, useMedia } from './hooks'
import { Overlay } from './Menu'
import { PageMenu } from './PageTree'
import { SyncBadge } from './SyncBadge'

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
  const [doc, setDoc] = useState<Y.Doc | null>(null)
  const editorRef = useRef<TEditor | null>(null)
  const onReady = useCallback((e: TEditor) => {
    editorRef.current = e
  }, [])

  useEffect(() => {
    let alive = true
    setDoc(null)
    openDoc(pageDocName(id)).then((d) => alive && setDoc(d))
    return () => {
      alive = false
    }
  }, [id])

  const crumbs = useMemo(() => {
    const byId = new Map(pages.map((p) => [p.id, p]))
    const out: PageMeta[] = []
    let cur = page?.parentId ? byId.get(page.parentId) : undefined
    while (cur && out.length < 20) {
      out.unshift(cur)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return out
  }, [pages, page?.parentId])

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  if (!page) {
    return (
      <div className="empty-state">
        <p>페이지를 찾을 수 없습니다.</p>
        <p className="muted">다른 기기에서 만든 페이지라면 동기화가 끝난 뒤 나타납니다.</p>
        <a className="btn" href={href({ name: 'home' })}>
          홈으로
        </a>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="topbar">
        {phone ? (
          <button
            type="button"
            className="icon-btn"
            aria-label="뒤로"
            onClick={goBack}
          >
            <ChevronLeft size={22} />
          </button>
        ) : (
          !sidebarOpen && (
            <button type="button" className="icon-btn" aria-label="사이드바 열기" onClick={onToggleSidebar}>
              <PanelLeft size={18} />
            </button>
          )
        )}
        <nav className="crumbs" aria-label="경로">
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
          <button
            type="button"
            className={`icon-btn${page.favorite ? ' is-fav' : ''}`}
            aria-label={page.favorite ? '즐겨찾기에서 제거' : '즐겨찾기에 추가'}
            aria-pressed={page.favorite}
            onClick={() => toggleFavorite(page.id)}
          >
            <Star size={18} fill={page.favorite ? 'currentColor' : 'none'} />
          </button>
          <button type="button" className="icon-btn" aria-label="더보기" onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>
      {menuAnchor && <PageMenu page={page} anchor={menuAnchor} currentId={page.id} onClose={() => setMenuAnchor(null)} />}

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
          {doc ? <Editor key={id} doc={doc} onReady={onReady} /> : <div className="editor-loading" />}
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
        <button type="button" className="page-icon" aria-label="아이콘 변경" onClick={(e) => setPicker(e.currentTarget)}>
          {page.icon}
        </button>
      ) : (
        <button type="button" className="add-icon" onClick={(e) => setPicker(e.currentTarget)}>
          <SmilePlus size={16} /> 아이콘 추가
        </button>
      )}
      <textarea
        ref={taRef}
        className="page-title"
        rows={1}
        placeholder="제목 없음"
        value={title}
        aria-label="페이지 제목"
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
        <Overlay anchor={picker} title="아이콘" sheet={phone} onClose={() => setPicker(null)}>
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
            <button
              type="button"
              className="btn ghost full"
              onClick={() => {
                updatePage(ws(), page.id, { icon: '' })
                setPicker(null)
              }}
            >
              아이콘 제거
            </button>
          )}
        </Overlay>
      )}
    </div>
  )
}
