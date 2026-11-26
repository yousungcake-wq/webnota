import { RotateCcw, Trash2 } from 'lucide-react'
import { displayTitle } from '@/core/model/pages'
import { usePages } from '@/core/store/pages'
import { deleteForever, restore } from '@/features/page'
import { ViewHeader } from '@/ui/ViewHeader'

export function TrashView() {
  const pages = usePages()
  const trashed = pages.filter((p) => p.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  return (
    <div className="view">
      <ViewHeader title="휴지통" />
      <div className="list">
        {trashed.map((p) => (
          <div key={p.id} className="list-item static">
            <span className="tree-icon">{p.icon || '📄'}</span>
            <span className="list-text">
              <span className="list-title">{displayTitle(p.title)}</span>
              <span className="list-sub">{new Date(p.deletedAt!).toLocaleString()} 삭제</span>
            </span>
            <button type="button" className="icon-btn" aria-label="복원" title="복원" onClick={() => restore(p.id)}>
              <RotateCcw size={18} />
            </button>
            <button
              type="button"
              className="icon-btn danger"
              aria-label="영구 삭제"
              title="영구 삭제"
              onClick={() => {
                if (confirm(`"${displayTitle(p.title)}"과(와) 하위 페이지를 영구 삭제할까요? 되돌릴 수 없습니다.`))
                  void deleteForever(p.id)
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {!trashed.length && <p className="muted pad">휴지통이 비어 있습니다.</p>}
      </div>
    </div>
  )
}
