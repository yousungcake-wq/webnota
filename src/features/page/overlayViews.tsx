import { useEffect, useState } from 'react'
import { openDoc, pageDocName } from '@/core/docs/registry'
import { getLang, t } from '@/core/i18n'
import { getView } from '@/core/model/views'
import { ws } from '@/core/docs/workspace'
import { Button, Dialog } from '@/ui'
import { IconPicker } from './IconPicker'
import { MoveDialog } from './MoveDialog'

export type Open =
  | { kind: 'icon'; viewId: string; anchor: HTMLElement | null }
  | { kind: 'info'; viewId: string }
  | { kind: 'move'; viewId: string }

export default function OverlayViews({ open, close }: { open: Open; close: () => void }) {
  const view = getView(ws(), open.viewId)
  if (!view) return null
  if (open.kind === 'icon') {
    // Anchor may have been inside the closed menu; fall back to the page icon or the center.
    const anchor = open.anchor?.isConnected ? open.anchor : document.querySelector<HTMLElement>('.page-icon, .add-icon')
    return <IconPicker anchor={anchor} viewId={view.id} current={view.icon} onClose={close} />
  }
  if (open.kind === 'move') return <MoveDialog view={view} onClose={close} />
  return <InfoDialog viewId={view.id} onClose={close} />
}

function InfoDialog({ viewId, onClose }: { viewId: string; onClose: () => void }) {
  const view = getView(ws(), viewId)!
  const [chars, setChars] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    void openDoc(pageDocName(viewId)).then((doc) => {
      let n = 0
      const walk = (type: { toArray(): unknown[] }) => {
        for (const c of type.toArray()) {
          const node = c as { toArray?: () => unknown[]; length?: number; nodeName?: string }
          if (node.nodeName === undefined && typeof node.length === 'number') n += node.length
          else if (node.toArray) walk(node as { toArray(): unknown[] })
        }
      }
      walk(doc.getXmlFragment('default'))
      if (alive) setChars(n)
    })
    return () => {
      alive = false
    }
  }, [viewId])
  const when = (ms: number) => new Date(ms).toLocaleString(getLang())
  const who = (login: string) => (login === 'local' || !login ? t('page.info.me') : login)
  return (
    <Dialog title={t('page.info')} onClose={onClose} actions={<Button onClick={onClose}>{t('common.close')}</Button>}>
      <dl className="info-list">
        <dt>{t('page.info.created')}</dt>
        <dd>
          {when(view.createdAt)} · {who(view.createdBy)}
        </dd>
        <dt>{t('page.info.updated')}</dt>
        <dd>
          {when(view.updatedAt)} · {who(view.updatedBy)}
        </dd>
        <dt>{t('page.info.chars')}</dt>
        <dd>{chars === null ? '…' : chars.toLocaleString(getLang())}</dd>
      </dl>
    </Dialog>
  )
}
