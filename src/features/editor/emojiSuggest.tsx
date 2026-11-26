import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { getLang, t } from '@/core/i18n'
import { loadEmojiData } from '@/features/emoji'
import { hidingListRenderer, listKeys, type ListHandle, type ListProps } from './suggestRender'

interface EmojiItem {
  emoji: string
  name: string
}

const EmojiList = forwardRef<ListHandle, ListProps<EmojiItem>>(function EmojiList({ items, command }, ref) {
  const [selected, setSelected] = useState(0)
  useEffect(() => setSelected(0), [items])
  useImperativeHandle(ref, () => ({ onKeyDown: (e) => listKeys(e, items, selected, setSelected, command) }))
  if (!items.length) return null
  return (
    <div className="slash-menu emoji-suggest" role="listbox" aria-label={t('emoji.suggest')}>
      {items.map((item, i) => (
        <button
          key={item.emoji}
          type="button"
          role="option"
          aria-selected={i === selected}
          className={`slash-item${i === selected ? ' is-selected' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setSelected(i)}
          onClick={() => command(item)}
        >
          <span className="slash-icon emoji-suggest-glyph">{item.emoji}</span>
          <span className="slash-title">{item.name}</span>
        </button>
      ))}
    </div>
  )
})

/** `:smile` → emoji (ED-I07). The dataset loads on first use (features/emoji, lazy). */
export const EmojiSuggest = Extension.create({
  name: 'emojiSuggest',
  addProseMirrorPlugins() {
    return [
      Suggestion<EmojiItem, EmojiItem>({
        editor: this.editor,
        pluginKey: new PluginKey('emojiSuggest'),
        char: ':',
        allowSpaces: false,
        items: async ({ query }) => {
          if (!query) return []
          const data = await loadEmojiData()
          const rows = await data.loadEmoji()
          const nameAt = getLang() === 'ko' ? 0 : 1 // names are "ko|en|keywords…"
          return data.suggestEmoji(rows, query).map((r) => ({ emoji: r[0], name: r[2].split('|')[nameAt] ?? '' }))
        },
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: EmojiItem }) => {
          editor.chain().focus().deleteRange(range).insertContent(props.emoji).run()
        },
        render: hidingListRenderer(EmojiList),
      }),
    ]
  },
})
