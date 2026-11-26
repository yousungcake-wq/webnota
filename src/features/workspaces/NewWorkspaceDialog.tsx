import { useState } from 'react'
import { getToken } from '@/core/auth/auth'
import { addSlot, listSlots, switchSlot } from '@/core/docs/slots'
import { t } from '@/core/i18n'
import { setPendingTarget } from '@/core/sync/controller'
import { Button, Dialog, Input, Segmented } from '@/ui'

/**
 * New workspace (WS-01): an empty local one (connected to its own new repository later
 * in Settings), or one that opens an existing repository — e.g. shared with you as a
 * collaborator — and connects on its first start. Switching reloads the app. Lazy.
 */
export default function NewWorkspaceDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'local' | 'repo'>('local')
  const [repo, setRepo] = useState('')
  const loggedIn = Boolean(getToken())
  const repoOk = /^[\w.-]+\/[\w.-]+$/.test(repo.trim())
  const valid = mode === 'local' || (loggedIn && repoOk)

  const create = () => {
    if (!valid) return
    const id = addSlot(name.trim() || (mode === 'repo' ? repo.trim().split('/')[1]! : t('ws.untitled')))
    const slot = listSlots().find((s) => s.id === id)!
    if (mode === 'repo') setPendingTarget(repo.trim(), slot)
    else setPendingTarget(`webnota-${slug(name) || id}`, slot) // its own repository when connected later
    switchSlot(id)
  }

  return (
    <Dialog
      title={t('ws.new')}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={!valid} onClick={create}>
            {t('space.create')}
          </Button>
        </>
      }
    >
      <form
        className="ws-form"
        onSubmit={(e) => {
          e.preventDefault()
          create()
        }}
      >
        <Input label={t('ws.name')} value={name} data-autofocus onChange={(e) => setName(e.target.value)} />
        <Segmented
          label={t('ws.kind')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'local', label: t('ws.kind.local') },
            { value: 'repo', label: t('ws.kind.repo') },
          ]}
        />
        {mode === 'local' ? (
          <p className="muted small">{t('ws.localHint')}</p>
        ) : loggedIn ? (
          <Input
            label={t('ws.repo')}
            placeholder="owner/repository"
            value={repo}
            hint={t('ws.repoHint')}
            onChange={(e) => setRepo(e.target.value)}
          />
        ) : (
          <p className="muted small">{t('ws.needLogin')}</p>
        )}
      </form>
    </Dialog>
  )
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
