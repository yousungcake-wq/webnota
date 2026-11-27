import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import { CalendarDays } from 'lucide-react'
import { forwardRef, Fragment, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ws } from '@/core/docs/workspace'
import { t } from '@/core/i18n'
import { getView, listViews } from '@/core/model/views'
import { recentStore } from '@/core/store/prefs'
import { ViewIcon } from '@/features/page'
import { hidingListRenderer, listKeys, type ListHandle, type ListProps } from './suggestRender'
import { isoDate } from './mention/dates'
import { mentionItems, type MentionItem } from './mention/items'
import { Mention, setMentionLabeler, type MentionAttrs } from './mention/mention'
import { dateLabel, MentionChip } from './MentionChip'

const MentionList = forwardRef<ListHandle, ListProps<MentionItem>>(function MentionList({ items, command }, ref) {
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => setSelected(0), [items])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])
  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => listKeys(e, items, selected, setSelected, command),
  }))
  if (!items.length) return null
  return (
    <div className="slash-menu mention-menu" role="listbox" aria-label={t('mention.menu')} ref={listRef}>
      {items.map((item, i) => {
        const heading = i === 0 || items[i - 1]!.kind !== item.kind
        return (
          <Fragment key={item.key}>
            {heading && (
              <div className="slash-heading" role="presentation">
                {t(item.kind === 'page' ? 'mention.pages' : 'mention.dates')}
              </div>
            )}
            <button
              type="button"
              data-index={i}
              role="option"
              aria-selected={i === selected}
              className={`slash-item${i === selected ? ' is-selected' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setSelected(i)}
              onClick={() => command(item)}
            >
              <span className="slash-icon">
                {item.kind === 'page' ? <ViewIcon icon={item.icon} size={18} /> : <CalendarDays size={18} />}
              </span>
              <span className="slash-text">
                <span className="slash-title">
                  {item.kind === 'page' ? item.title.trim() || t('common.untitled') : dateLabel(item.date)}
                </span>
                {item.kind === 'date' && <span className="slash-hint">{item.date}</span>}
              </span>
            </button>
          </Fragment>
        )
      })}
    </div>
  )
})

function relativeWords(): Record<string, number> {
  return { [t('mention.today')]: 0, [t('mention.tomorrow')]: 1, [t('mention.yesterday')]: -1 }
}

function suggestion(char: string, key: string, dates: boolean) {
  const pluginKey = new PluginKey(key)
  return {
    pluginKey,
    char,
    allowSpaces: true, // page titles have spaces; the menu just hides when nothing matches
    items: ({ query }: { query: string }) =>
      mentionItems({
        query,
        views: listViews(ws()),
        recent: recentStore.get(),
        today: isoDate(new Date()),
        words: relativeWords(),
        dates,
      }),
    command: ({ editor, range, props }: { editor: Editor; range: Range; props: MentionItem }) => {
      const attrs: Partial<MentionAttrs> =
        props.kind === 'page' ? { kind: 'page', viewId: props.viewId } : { kind: 'date', date: props.date }
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent([
          { type: 'mention', attrs },
          { type: 'text', text: ' ' },
        ])
        .run()
    },
    render: hidingListRenderer(MentionList, pluginKey),
  }
}

/** `@` (pages + dates) and `[[` (pages) menus (ED-I04, ED-I05). */
export const MentionSuggest = Extension.create({
  name: 'mentionSuggest',
  addProseMirrorPlugins() {
    return [
      Suggestion({ editor: this.editor, ...suggestion('@', 'mention', true) }),
      Suggestion({ editor: this.editor, ...suggestion('[[', 'pageLink', false) }),
    ]
  },
})

/** The mention node with its React chip (the schema-only `Mention` stays usable without React). */
export const MentionWithView = Mention.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MentionChip, { as: 'span' })
  },
})

// Copy / plain-text export use the current title or date label.
setMentionLabeler((a) => {
  if (a.kind === 'date') return dateLabel(a.date)
  const v = a.viewId ? getView(ws(), a.viewId) : null
  return v ? v.title.trim() || t('common.untitled') : t('mention.missing')
})
