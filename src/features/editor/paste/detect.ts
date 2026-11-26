/** Paste helpers (ED-F06). Pure: unit-tested in node. */

const BLOCK = [
  /^#{1,6}\s+\S/, // heading
  /^\s*[-*+]\s+\S/, // bullet
  /^\s*\d+[.)]\s+\S/, // numbered
  /^\s*[-*+]\s+\[[ xX]\]\s/, // task
  /^>\s?\S/, // quote
  /^```/, // code fence
  /^\|.+\|\s*$/, // table row
  /^(-{3,}|\*{3,})\s*$/, // divider
]
const INLINE = [/\*\*[^*\n]+\*\*/, /\[[^\]\n]+\]\([^)\s]+\)/, /(^|\s)`[^`\n]+`/, /(^|\s)_[^_\n]+_(\s|$)/]

/**
 * Whether pasted plain text looks like Markdown worth converting: a block marker on
 * some line, or inline syntax in multi-line text. A single plain line stays text.
 */
export function looksLikeMarkdown(text: string): boolean {
  const lines = text.split(/\r?\n/)
  if (lines.some((l) => BLOCK.some((re) => re.test(l)))) return true
  return lines.length > 1 && INLINE.some((re) => re.test(text))
}

/**
 * HTML that code editors (VS Code, JetBrains…) put on the clipboard: one block of
 * colored spans with `white-space: pre`. It is really plain text.
 */
export function isCodeEditorHtml(html: string): boolean {
  return /white-space:\s*pre/i.test(html) && !/<(p|h[1-6]|li|table|blockquote)\b/i.test(html)
}

const URL_RE = /^https?:\/\/[^\s<>"]+$/i

/** The pasted text when it is exactly one http(s) URL. */
export function singleUrl(text: string): string | null {
  const t = text.trim()
  return URL_RE.test(t) ? t : null
}
