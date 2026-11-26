import { Search, Shuffle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { t, type MessageKey } from '@/core/i18n'
import type { IconValue } from '@/core/model/views'
import { Button, Segmented } from '@/ui'
import { filterEmoji, loadEmoji, SKIN_TONES, withSkin, type EmojiRow } from './data'
import { ICON_COLORS, ICONS } from './icons'
import './emoji.css'

const RECENT_KEY = 'webnota:recent-emoji'
const SKIN_KEY = 'webnota:skin-tone'
const GROUPS: [number, MessageKey][] = [
  [0, 'emoji.group.smileys'],
  [1, 'emoji.group.people'],
  [3, 'emoji.group.nature'],
  [4, 'emoji.group.food'],
  [5, 'emoji.group.travel'],
  [6, 'emoji.group.activities'],
  [7, 'emoji.group.objects'],
  [8, 'emoji.group.symbols'],
  [9, 'emoji.group.flags'],
]

const readJSON = <T,>(key: string, fallback: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(key) || 'null') as T) ?? fallback
  } catch {
    return fallback
  }
}
const writeJSON = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

/**
 * Page/space icon picker (ED-F12, spec/12 EmojiPicker + IconPicker): emoji with search
 * (Korean/English), recent, skin tone and groups; or a named icon with a color.
 * Rendered inside an Overlay (popover on desktop, sheet on phones). Lazy.
 */
export default function EmojiPicker({
  current,
  onPick,
}: {
  current: IconValue | null
  onPick: (icon: IconValue | null) => void
}) {
  const [tab, setTab] = useState<'emoji' | 'icon'>(current?.type === 'icon' ? 'icon' : 'emoji')
  return (
    <div className="emoji-picker">
      <div className="emoji-picker-top">
        <Segmented
          label={t('emoji.kind')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'emoji', label: t('emoji.tab.emoji') },
            { value: 'icon', label: t('emoji.tab.icon') },
          ]}
        />
        {current && (
          <Button size="sm" variant="ghost" onClick={() => onPick(null)}>
            {t('page.removeIcon')}
          </Button>
        )}
      </div>
      {tab === 'emoji' ? <EmojiTab onPick={onPick} /> : <IconTab current={current} onPick={onPick} />}
    </div>
  )
}

function EmojiTab({ onPick }: { onPick: (icon: IconValue) => void }) {
  const [rows, setRows] = useState<EmojiRow[] | null>(null)
  const [q, setQ] = useState('')
  const [tone, setTone] = useState<number>(() => readJSON(SKIN_KEY, 0))
  const [recent] = useState<string[]>(() => readJSON(RECENT_KEY, []))
  useEffect(() => {
    void loadEmoji().then(setRows)
  }, [])
  const shown = useMemo(() => (rows ? filterEmoji(rows, q) : []), [rows, q])

  const pick = (emoji: string) => {
    writeJSON(RECENT_KEY, [emoji, ...recent.filter((e) => e !== emoji)].slice(0, 24))
    onPick({ type: 'emoji', value: emoji })
  }
  const button = (r: EmojiRow) => {
    const e = withSkin(r[0], tone, r[3])
    return (
      <button key={r[0]} type="button" className="emoji-btn" title={r[2].split('|')[0]} onClick={() => pick(e)}>
        {e}
      </button>
    )
  }

  return (
    <>
      <div className="emoji-search-row">
        <label className="search-box">
          <Search size={16} />
          <input
            data-autofocus
            type="search"
            placeholder={t('emoji.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="emoji-btn"
          aria-label={t('emoji.random')}
          title={t('emoji.random')}
          disabled={!rows}
          onClick={() => {
            if (!rows) return
            const r = rows[Math.floor(Math.random() * rows.length)]!
            pick(withSkin(r[0], tone, r[3]))
          }}
        >
          <Shuffle size={16} />
        </button>
        <select
          className="emoji-skin"
          aria-label={t('emoji.skinTone')}
          value={tone}
          onChange={(e) => {
            setTone(Number(e.target.value))
            writeJSON(SKIN_KEY, Number(e.target.value))
          }}
        >
          {SKIN_TONES.map((m, i) => (
            <option key={i} value={i}>
              {`✋${m}`}
            </option>
          ))}
        </select>
      </div>
      <div className="emoji-scroll">
        {!rows && <p className="muted pad">{t('emoji.loading')}</p>}
        {rows && !q && recent.length > 0 && (
          <section>
            <h4>{t('emoji.recent')}</h4>
            <div className="emoji-grid">
              {recent.map((e) => (
                <button key={e} type="button" className="emoji-btn" onClick={() => pick(e)}>
                  {e}
                </button>
              ))}
            </div>
          </section>
        )}
        {rows &&
          q &&
          (shown.length ? (
            <div className="emoji-grid">{shown.map(button)}</div>
          ) : (
            <p className="muted pad">{t('emoji.none')}</p>
          ))}
        {rows &&
          !q &&
          GROUPS.map(([g, label]) => (
            <section key={g} className="emoji-group">
              <h4>{t(label)}</h4>
              <div className="emoji-grid">{rows.filter((r) => r[1] === g).map(button)}</div>
            </section>
          ))}
      </div>
    </>
  )
}

function IconTab({ current, onPick }: { current: IconValue | null; onPick: (icon: IconValue) => void }) {
  const [q, setQ] = useState('')
  const [color, setColor] = useState(current?.type === 'icon' ? (current.color ?? '') : '')
  const names = Object.keys(ICONS).filter((n) => n.includes(q.trim().toLowerCase()))
  return (
    <>
      <div className="emoji-search-row">
        <label className="search-box">
          <Search size={16} />
          <input
            data-autofocus
            type="search"
            placeholder={t('emoji.searchIcon')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      <div className="icon-colors" role="radiogroup" aria-label={t('space.color')}>
        {ICON_COLORS.map((c) => (
          <button
            key={c || 'default'}
            type="button"
            role="radio"
            aria-checked={c === color}
            aria-label={c ? t(`color.${c}` as MessageKey) : t('emoji.defaultColor')}
            className={`icon-color${c === color ? ' is-selected' : ''}`}
            style={{ background: c ? `var(--c-${c}-text)` : 'var(--text-2)' }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <div className="emoji-scroll">
        <div className="emoji-grid">
          {names.map((n) => {
            const Icon = ICONS[n]!
            return (
              <button
                key={n}
                type="button"
                className="emoji-btn"
                title={n}
                aria-label={n}
                onClick={() => onPick(color ? { type: 'icon', value: n, color } : { type: 'icon', value: n })}
              >
                <Icon size={20} style={color ? { color: `var(--c-${color}-text)` } : undefined} />
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
