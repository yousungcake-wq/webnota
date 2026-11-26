// Builds the compact emoji dataset for the EmojiPicker (spec/12 EmojiPicker) from
// emojibase-data: one file with Korean + English names/tags for search (한/영).
// Run after upgrading emojibase-data:  node scripts/gen-emoji.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const load = (l) =>
  JSON.parse(readFileSync(new URL(`../node_modules/emojibase-data/${l}/compact.json`, import.meta.url)))
const ko = load('ko')
const en = new Map(load('en').map((e) => [e.hexcode, e]))

// group 2 = skin-tone components; no group = regional indicators etc.
const rows = ko
  .filter((e) => e.group !== undefined && e.group !== 2)
  .sort((a, b) => a.order - b.order)
  .map((e) => {
    const n = en.get(e.hexcode)
    // Korean + English names and the first Korean tag: full tag lists would
    // quadruple the download (~90KB gzip) for little gain.
    const words = [e.label, n?.label, ...(e.tags ?? []).slice(0, 1)].filter(Boolean)
    const search = [...new Set(words.map((w) => w.toLowerCase()))].join('|')
    const row = [e.unicode, e.group, search]
    // Skin tones: 1 = a modifier goes right after the first code point (true for all
    // single-person emoji, including ZWJ professions).
    if (e.skins) row.push(1)
    return row
  })
writeFileSync(new URL('../src/features/emoji/emoji-data.json', import.meta.url), JSON.stringify(rows))
console.log('emoji rows:', rows.length)
