// Click-only page style UI (ED-F10, ED-F11), loaded on demand to keep the initial bundle small.
import { useState } from 'react'
import type * as Y from 'yjs'
import { t, type MessageKey } from '@/core/i18n'
import { readCover, setCover, setPageStyle, type PageStyle } from '@/core/model/page'
import { useLayout } from '@/platform/layout'
import { Overlay } from '@/ui'
import { COVER_GRADIENTS, coverBackground, usePageMeta } from './pageMeta'

const PALETTE = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const

/** Cover picker: palette colors, gradients, or an image link. */
export function CoverPicker({ doc, anchor, onClose }: { doc: Y.Doc; anchor: HTMLElement | null; onClose: () => void }) {
  const phone = useLayout().layout === 'phone'
  const [url, setUrl] = useState(() => {
    const c = readCover(doc)
    return c?.type === 'url' ? c.value : ''
  })
  const pick = (type: 'color' | 'gradient', value: string) => {
    setCover(doc, { type, value })
    onClose()
  }
  return (
    <Overlay anchor={anchor} title={t('cover.title')} sheet={phone} onClose={onClose}>
      <div className="cover-picker">
        <div className="cover-label">{t('cover.gradients')}</div>
        <div className="cover-grid">
          {COVER_GRADIENTS.map((g) => (
            <button
              key={g}
              type="button"
              className="cover-swatch"
              aria-label={`${t('cover.gradients')} ${g.slice(1)}`}
              style={{ background: coverBackground({ type: 'gradient', value: g, offsetY: 50 }) }}
              onClick={() => pick('gradient', g)}
            />
          ))}
        </div>
        <div className="cover-label">{t('cover.colors')}</div>
        <div className="cover-grid">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className="cover-swatch"
              aria-label={t(`color.${c}` as MessageKey)}
              style={{ background: coverBackground({ type: 'color', value: c, offsetY: 50 }) }}
              onClick={() => pick('color', c)}
            />
          ))}
        </div>
        <form
          className="cover-url"
          onSubmit={(e) => {
            e.preventDefault()
            const v = url.trim()
            if (!/^https?:\/\//i.test(v)) return
            setCover(doc, { type: 'url', value: v })
            onClose()
          }}
        >
          <input
            type="url"
            aria-label={t('cover.imageUrl')}
            placeholder={t('cover.imageUrl')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button type="submit" className="btn">
            {t('common.ok')}
          </button>
        </form>
      </div>
    </Overlay>
  )
}

const OPTIONS: { key: keyof PageStyle; label: MessageKey; values: [string, MessageKey][] }[] = [
  {
    key: 'font',
    label: 'pageStyle.font',
    values: [
      ['default', 'pageStyle.fontDefault'],
      ['serif', 'pageStyle.fontSerif'],
      ['mono', 'pageStyle.fontMono'],
    ],
  },
  {
    key: 'fontSize',
    label: 'pageStyle.size',
    values: [
      ['small', 'pageStyle.small'],
      ['normal', 'pageStyle.normal'],
      ['large', 'pageStyle.large'],
    ],
  },
  {
    key: 'lineHeight',
    label: 'pageStyle.lineHeight',
    values: [
      ['compact', 'pageStyle.compact'],
      ['normal', 'pageStyle.normal'],
      ['relaxed', 'pageStyle.relaxed'],
    ],
  },
]

/** Page style panel (ED-F10): font, size, line height, full width. */
export function PageStylePanel({
  doc,
  anchor,
  readOnly,
  onClose,
}: {
  doc: Y.Doc
  anchor: HTMLElement | null
  readOnly: boolean
  onClose: () => void
}) {
  const phone = useLayout().layout === 'phone'
  const { style } = usePageMeta(doc)
  return (
    <Overlay anchor={anchor} title={t('pageStyle.title')} sheet={phone} onClose={onClose}>
      <div className="page-style">
        {OPTIONS.map((o) => (
          <div key={o.key} className="page-style-row" role="radiogroup" aria-label={t(o.label)}>
            <span className="page-style-label">{t(o.label)}</span>
            <div className="segmented">
              {o.values.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={style[o.key] === value}
                  className={style[o.key] === value ? 'is-on' : ''}
                  disabled={readOnly}
                  data-font={o.key === 'font' ? value : undefined}
                  onClick={() => setPageStyle(doc, { [o.key]: value })}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
        ))}
        <label className="page-style-row page-style-check">
          <span className="page-style-label">{t('pageStyle.fullWidth')}</span>
          <input
            type="checkbox"
            role="switch"
            checked={style.fullWidth}
            disabled={readOnly}
            onChange={(e) => setPageStyle(doc, { fullWidth: e.target.checked })}
          />
        </label>
      </div>
    </Overlay>
  )
}
