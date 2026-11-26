import { ExternalLink, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { currentSlot, currentWorkspaceId, listSlots, removeSlot, updateSlot } from '@/core/docs/slots'
import { t } from '@/core/i18n'
import { useSync } from '@/core/store/sync'
import { confirmDialog, IconButton, Input } from '@/ui'
import { slotLabel } from './WorkspaceSwitcher'

/** Settings → Workspace (ST-02): name, icon, repository, other workspaces on this device. Lazy. */
export default function WorkspaceSettings() {
  const slot = currentSlot()
  const account = useSync().account
  const [name, setName] = useState(slot.name)
  const [icon, setIcon] = useState(slot.icon ?? '')
  const [, refresh] = useState(0)
  const others = listSlots().filter((s) => s.id !== currentWorkspaceId())
  return (
    <section className="card">
      <h2>{t('ws.settings')}</h2>
      <div className="ws-form-row">
        <Input
          className="ws-icon-input"
          label={t('common.icon')}
          value={icon}
          maxLength={8}
          onChange={(e) => setIcon(e.target.value)}
          onBlur={() => updateSlot(slot.id, { icon: icon.trim() || undefined })}
        />
        <Input
          label={t('ws.name')}
          value={name}
          placeholder={account?.repo ?? t('ws.local')}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => updateSlot(slot.id, { name: name.trim() })}
        />
      </div>
      <p className="muted small">
        {account ? (
          <a
            href={`https://github.com/${account.owner}/${account.repo}`}
            target="_blank"
            rel="noreferrer"
            className="ws-repo-link"
          >
            {account.owner}/{account.repo} <ExternalLink size={12} />
          </a>
        ) : (
          t('ws.notConnected')
        )}
      </p>
      {others.length > 0 && (
        <>
          <h3 className="card-sub">{t('ws.others')}</h3>
          <ul className="ws-list">
            {others.map((s) => (
              <li key={s.id}>
                <span>
                  {s.icon} {slotLabel(s)}
                </span>
                <IconButton
                  icon={Trash2}
                  tone="danger"
                  label={t('ws.remove')}
                  onClick={() =>
                    void confirmDialog({
                      title: t('ws.remove'),
                      message: t('ws.removeConfirm', { name: slotLabel(s) }),
                      confirmLabel: t('ws.remove'),
                      danger: true,
                    }).then(async (ok) => {
                      if (!ok) return
                      await removeSlot(s.id)
                      refresh((n) => n + 1)
                    })
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
