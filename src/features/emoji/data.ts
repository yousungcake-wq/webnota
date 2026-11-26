/** Row of emoji-data.json (scripts/gen-emoji.mjs): [emoji, group, "names|…", skinnable?]. */
export type EmojiRow = [string, number, string, 1?]

let rows: Promise<EmojiRow[]> | null = null
export const loadEmoji = () => (rows ??= import('./emoji-data.json').then((m) => m.default as unknown as EmojiRow[]))

/** Skin tone modifiers U+1F3FB…U+1F3FF; index 0 = default (none). */
export const SKIN_TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}']

/** Applies a skin tone after the first code point (single-person emoji, incl. ZWJ professions). */
export function withSkin(emoji: string, tone: number, skinnable?: 1): string {
  if (!tone || !skinnable) return emoji
  const first = String.fromCodePoint(emoji.codePointAt(0)!)
  return first + SKIN_TONES[tone] + emoji.slice(first.length).replace(/^️/, '')
}

/** Rows matching every word of `q` in their Korean/English names. */
export function filterEmoji(list: EmojiRow[], q: string): EmojiRow[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return list
  return list.filter((r) => words.every((w) => r[2].includes(w)))
}
