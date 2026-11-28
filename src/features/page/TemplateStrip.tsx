import { Suspense, use, useEffect, useState } from 'react'
import type * as Y from 'yjs'
import { t } from '@/core/i18n'
import { loadTemplateActions, loadTemplates, type DocTemplate } from '@/features/templates'

/** Nothing typed yet: no blocks, or the single empty paragraph an opened page holds. */
const isEmpty = (doc: Y.Doc) => {
  const frag = doc.getXmlFragment('default')
  return frag.length === 0 || (frag.length === 1 && frag.toJSON() === '<paragraph></paragraph>')
}

/**
 * Under an empty page (M8-09): the document templates as chips; one fills the page (title
 * and icon only when unset). Gone as soon as the page has content.
 */
export function TemplateStrip({ doc, viewId }: { doc: Y.Doc; viewId: string }) {
  const [empty, setEmpty] = useState(() => isEmpty(doc))
  useEffect(() => {
    const update = () => setEmpty(isEmpty(doc))
    doc.on('update', update)
    return () => doc.off('update', update)
  }, [doc])
  if (!empty) return null
  // its own boundary: loading the templates must not suspend (remount) the editor beside it
  return (
    <Suspense fallback={null}>
      <Chips viewId={viewId} />
    </Suspense>
  )
}

function Chips({ viewId }: { viewId: string }) {
  const docs = use(loadTemplates()).filter((x): x is DocTemplate => x.kind === 'document')
  return (
    <div className="template-strip" role="group" aria-label={t('page.templates')}>
      <span className="template-strip-label">{t('page.templates')}</span>
      {docs.map((tpl) => (
        <button
          key={tpl.id}
          type="button"
          className="template-chip"
          onClick={() => void loadTemplateActions().then((m) => m.applyToPage(tpl, viewId))}
        >
          <span aria-hidden>{tpl.icon}</span> {tpl.name}
        </button>
      ))}
    </div>
  )
}
