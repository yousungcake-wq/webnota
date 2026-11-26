import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ws } from '@/core/docs/workspace'
import { t } from '@/core/i18n'
import { createSpace, deleteSpace, listSpaces, moveSpace, updateSpace, type IconValue } from '@/core/model/views'
import { setCurrentSpace } from '@/core/store/prefs'
import { Button, confirmDialog, Dialog, IconButton, Input, Switch } from '@/ui'
import { SPACE_COLORS, SpaceBadge } from './SpaceBadge'

const EMOJIS = ['', '🏠', '💼', '📚', '🎯', '🚀', '💡', '🧪', '🎨', '🛒', '✈️', '❤️', '🌱', '⭐️']

/** Create (spaceId null) or edit a space: name, icon, color, private, order, delete (WS-02). Lazy. */
export default function SpaceDialog({ spaceId, onClose }: { spaceId: string | null; onClose: () => void }) {
  const doc = ws()
  const spaces = listSpaces(doc)
  const existing = spaces.find((s) => s.id === spaceId) ?? null
  const [name, setName] = useState(existing?.name ?? '')
  const [icon, setIcon] = useState<IconValue | null>(existing?.icon ?? null)
  const [color, setColor] = useState(existing?.color ?? 'blue')
  const [priv, setPriv] = useState(existing?.visibility === 'private')
  const index = existing ? spaces.indexOf(existing) : -1

  const save = () => {
    const visibility = priv ? 'private' : 'shared'
    const trimmed = name.trim() || t('space.untitled')
    if (existing) updateSpace(doc, existing.id, { name: trimmed, icon, color, visibility })
    else setCurrentSpace(createSpace(doc, { name: trimmed, icon, color, visibility }))
    onClose()
  }

  return (
    <Dialog
      title={existing ? t('space.settings') : t('space.new')}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={save}>
            {existing ? t('common.save') : t('space.create')}
          </Button>
        </>
      }
    >
      <form
        className="space-form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="space-form-head">
          <SpaceBadge space={{ name: name || '?', icon, color }} size={40} />
          <Input label={t('space.name')} value={name} data-autofocus onChange={(e) => setName(e.target.value)} />
        </div>
        <fieldset>
          <legend>{t('common.icon')}</legend>
          <div className="space-emojis">
            {EMOJIS.map((em) => (
              <button
                key={em || 'none'}
                type="button"
                className={`emoji-btn${(icon?.value ?? '') === em ? ' is-selected' : ''}`}
                aria-label={em || t('space.noIcon')}
                aria-pressed={(icon?.value ?? '') === em}
                onClick={() => setIcon(em ? { type: 'emoji', value: em } : null)}
              >
                {em || 'Aa'}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>{t('space.color')}</legend>
          <div className="space-colors">
            {SPACE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`space-color${c === color ? ' is-selected' : ''}`}
                style={{ background: `var(--c-${c}-text)` }}
                aria-label={t(`color.${c}`)}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </fieldset>
        <Switch checked={priv} onChange={setPriv} label={t('space.private')} description={t('space.privateHint')} />
        {existing && (
          <div className="space-form-actions">
            <IconButton
              icon={ArrowUp}
              label={t('space.moveUp')}
              disabled={index <= 0}
              onClick={() => moveSpace(doc, existing.id, index - 1)}
            />
            <IconButton
              icon={ArrowDown}
              label={t('space.moveDown')}
              disabled={index >= spaces.length - 1}
              onClick={() => moveSpace(doc, existing.id, index + 1)}
            />
            <Button
              variant="ghost"
              icon={Trash2}
              disabled={spaces.length <= 1}
              onClick={() =>
                void confirmDialog({
                  title: t('space.delete'),
                  message: t('space.deleteConfirm', { name: existing.name }),
                  confirmLabel: t('space.delete'),
                  danger: true,
                }).then((ok) => {
                  if (ok && deleteSpace(doc, existing.id)) onClose()
                })
              }
            >
              {t('space.delete')}
            </Button>
          </div>
        )}
      </form>
    </Dialog>
  )
}
