import { ArrowLeftToLine, ArrowRightToLine, Copy, EyeOff, Pin, PinOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  addField,
  CURRENCIES,
  DATE_FORMATS,
  deleteField,
  duplicateField,
  renameField,
  setFieldOptions,
  setViewField,
  updateDbView,
  type DbDocs,
  type FieldMeta,
  type FieldType,
  type ViewSettings,
} from '@/core/model/database'
import { useLayout } from '@/platform/layout'
import { confirmDialog, Overlay, Switch } from '@/ui'
import { changeFieldType } from './fieldActions'
import { FIELD_TYPE_INFO } from './fieldTypes'
import { dt, type DbKey } from './i18n'

const WRAPPABLE = new Set<FieldType>(['text', 'select', 'multiSelect', 'url', 'media', 'checklist'])

/** A name for a new field of `type` that no field has yet ("Number", "Number 2", …). */
export function uniqueName(base: string, fields: FieldMeta[]) {
  const names = new Set(fields.map((f) => f.name))
  if (!names.has(base)) return base
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`
}

/** The type list (add field, change type): available types only (relation etc. come later). */
export function TypeList({ current, onPick }: { current?: FieldType; onPick: (t: FieldType) => void }) {
  return (
    <div className="db-list" role="listbox" aria-label={dt('db.field.type')}>
      {(Object.keys(FIELD_TYPE_INFO) as FieldType[])
        .filter((t) => FIELD_TYPE_INFO[t].available)
        .map((t) => {
          const { icon: Icon, label } = FIELD_TYPE_INFO[t]
          return (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={t === current}
              className="db-option-create"
              onClick={() => onPick(t)}
            >
              <Icon size={14} aria-hidden /> {dt(label)}
            </button>
          )
        })}
    </div>
  )
}

/**
 * Field menu (DB-F02): rename, type (with conversion), type options, hide, duplicate,
 * delete, insert left/right, wrap, freeze. The primary field keeps its type and stays (DB-F05).
 */
export function FieldMenu({
  docs,
  field,
  fields,
  view,
  primaryId,
  anchor,
  index,
  onClose,
}: {
  docs: DbDocs
  field: FieldMeta
  fields: FieldMeta[]
  view: ViewSettings
  primaryId: string
  anchor: HTMLElement | null
  /** Position among the view's visible columns (for freezing). */
  index: number
  onClose: () => void
}) {
  const phone = useLayout().layout === 'phone'
  const [name, setName] = useState(field.name)
  const [typesOpen, setTypesOpen] = useState(false)
  const primary = field.id === primaryId
  const settings = view.fields[field.id]
  const saveName = () => {
    const v = name.trim()
    if (v && v !== field.name) renameField(docs, field.id, v)
  }
  const done = () => {
    saveName()
    onClose()
  }
  const insert = (side: 'left' | 'right') => {
    const label = dt(FIELD_TYPE_INFO.text.label)
    addField(docs, {
      name: uniqueName(label, fields),
      type: 'text',
      viewId: view.id,
      ...(side === 'left' ? { beforeId: field.id } : { afterId: field.id }),
    })
    done()
  }
  const TypeIcon = FIELD_TYPE_INFO[field.type].icon

  return (
    <Overlay anchor={anchor} title={dt('db.field.menu', { name: field.name })} sheet={phone} onClose={done}>
      <div className="db-pop db-fieldmenu">
        <input
          className="db-input"
          value={name}
          autoFocus={!phone}
          aria-label={dt('db.field.nameLabel')}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && done()}
        />
        {typesOpen ? (
          <TypeList
            current={field.type}
            onPick={(t) => {
              setTypesOpen(false)
              onClose()
              void changeFieldType(docs, field, t)
            }}
          />
        ) : (
          <>
            <button
              type="button"
              className="db-option-create"
              disabled={primary}
              title={primary ? dt('db.field.primary') : undefined}
              onClick={() => setTypesOpen(true)}
            >
              <TypeIcon size={14} aria-hidden /> {dt('db.field.type')}: {dt(FIELD_TYPE_INFO[field.type].label)}
            </button>
            <TypeOptions docs={docs} field={field} />
            <div className="db-sep" />
            {WRAPPABLE.has(field.type) && (
              <Switch
                checked={settings?.wrap === true}
                label={dt('db.field.wrap')}
                onChange={(on) => setViewField(docs, view.id, field.id, { wrap: on })}
              />
            )}
            <MenuButton icon={ArrowLeftToLine} label={dt('db.field.insertLeft')} onClick={() => insert('left')} />
            <MenuButton icon={ArrowRightToLine} label={dt('db.field.insertRight')} onClick={() => insert('right')} />
            {index + 1 === view.frozenColumns ? (
              <MenuButton
                icon={PinOff}
                label={dt('db.field.unfreeze')}
                onClick={() => {
                  updateDbView(docs, view.id, { frozenColumns: index === 0 ? 0 : index })
                  done()
                }}
              />
            ) : (
              <MenuButton
                icon={Pin}
                label={dt('db.field.freeze')}
                onClick={() => {
                  updateDbView(docs, view.id, { frozenColumns: index + 1 })
                  done()
                }}
              />
            )}
            {!primary && (
              <MenuButton
                icon={EyeOff}
                label={dt('db.field.hide')}
                onClick={() => {
                  setViewField(docs, view.id, field.id, { visible: false })
                  done()
                }}
              />
            )}
            <MenuButton
              icon={Copy}
              label={dt('db.field.duplicate')}
              onClick={() => {
                duplicateField(docs, field.id, dt('db.field.copyName', { name: field.name }), view.id)
                done()
              }}
            />
            {!primary && (
              <MenuButton
                icon={Trash2}
                danger
                label={dt('db.field.delete')}
                onClick={() => {
                  onClose()
                  void confirmDialog({
                    title: dt('db.field.deleteTitle'),
                    message: dt('db.field.deleteMessage', { name: field.name }),
                    confirmLabel: dt('db.field.delete'),
                    danger: true,
                  }).then((ok) => ok && deleteField(docs, field.id))
                }}
              />
            )}
          </>
        )}
      </div>
    </Overlay>
  )
}

function MenuButton({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: typeof Copy
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={`db-option-create${danger ? ' is-danger' : ''}`} onClick={onClick}>
      <Icon size={14} aria-hidden /> {label}
    </button>
  )
}

/** Type-specific settings (spec/02 §4.3). */
function TypeOptions({ docs, field }: { docs: DbDocs; field: FieldMeta }) {
  const o = field.options
  const set = (patch: Record<string, unknown>) => setFieldOptions(docs, field.id, patch)
  if (field.type === 'number')
    return (
      <div className="db-typeopts">
        <label className="db-date-select">
          {dt('db.num.format')}
          <select value={o.format ?? 'number'} onChange={(e) => set({ format: e.target.value })}>
            {(['number', 'percent', 'currency'] as const).map((f) => (
              <option key={f} value={f}>
                {dt(`db.num.fmt.${f}` as DbKey)}
              </option>
            ))}
          </select>
        </label>
        {o.format === 'currency' && (
          <label className="db-date-select">
            {dt('db.num.currency')}
            <select value={o.currency ?? 'KRW'} onChange={(e) => set({ currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="db-date-select">
          {dt('db.num.decimals')}
          <select
            value={typeof o.decimals === 'number' ? String(o.decimals) : ''}
            onChange={(e) => set({ decimals: e.target.value === '' ? undefined : Number(e.target.value) })}
          >
            <option value="">{dt('db.num.decimalsAuto')}</option>
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <Switch
          checked={o.separator !== false}
          label={dt('db.num.separator')}
          onChange={(on) => set({ separator: on })}
        />
      </div>
    )
  if (field.type === 'date' || field.type === 'createdTime' || field.type === 'updatedTime')
    return (
      <div className="db-typeopts">
        <label className="db-date-select">
          {dt('db.date.format')}
          <select value={o.dateFormat ?? 'friendly'} onChange={(e) => set({ dateFormat: e.target.value })}>
            {DATE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {dt(`db.date.fmt.${f}` as DbKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="db-date-select">
          {dt('db.date.timeFormat')}
          <select value={o.timeFormat ?? '24'} onChange={(e) => set({ timeFormat: e.target.value })}>
            <option value="24">{dt('db.date.h24')}</option>
            <option value="12">{dt('db.date.h12')}</option>
          </select>
        </label>
      </div>
    )
  if (field.type === 'media')
    return (
      <Switch
        checked={o.hideFileNames === true}
        label={dt('db.media.hideNames')}
        onChange={(on) => set({ hideFileNames: on })}
      />
    )
  return null
}
