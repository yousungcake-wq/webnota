// Loaded on demand when Markdown is pasted (ED-F06), so `marked` stays out of the editor chunk.
import { Marked, type Tokens } from 'marked'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

interface MathToken {
  type: string
  raw: string
  text: string
}

const marked = new Marked({
  gfm: true,
  breaks: false,
  // M8-01: `$$…$$` → math block, `$…$` → inline math (prices like "$5 and $10" stay text:
  // no space just inside the dollars, no digit right after the closing one — like ED-I06)
  extensions: [
    {
      name: 'mathBlock',
      level: 'block',
      start: (src: string) => src.match(/^\$\$/m)?.index,
      tokenizer(src: string): MathToken | undefined {
        const m = /^\$\$([\s\S]+?)\$\$[ \t]*(?:\n|$)/.exec(src)
        return m ? { type: 'mathBlock', raw: m[0], text: m[1]!.trim() } : undefined
      },
      renderer: (t) => `<div data-math-block data-latex="${esc((t as MathToken).text)}"></div>`,
    },
    {
      name: 'inlineMath',
      level: 'inline',
      start: (src: string) => {
        const i = src.indexOf('$')
        return i < 0 ? undefined : i
      },
      tokenizer(src: string): MathToken | undefined {
        const m = /^\$(?![\s$])([^$\n]+?)(?<!\s)\$(?!\d)/.exec(src)
        return m ? { type: 'inlineMath', raw: m[0], text: m[1]! } : undefined
      },
      renderer: (t) => `<span data-inline-math data-latex="${esc((t as MathToken).text)}"></span>`,
    },
  ],
  renderer: {
    // to-do items become the editor's task list markup
    list(this: { listitem: (i: Tokens.ListItem) => string }, token: Tokens.List) {
      const body = token.items.map((i) => this.listitem(i)).join('')
      if (token.items.some((i) => i.task)) return `<ul data-type="taskList">${body}</ul>`
      const tag = token.ordered ? 'ol' : 'ul'
      const start = token.ordered && token.start !== 1 && token.start !== '' ? ` start="${token.start}"` : ''
      return `<${tag}${start}>${body}</${tag}>`
    },
    listitem(
      this: { parser: { parse: (t: Tokens.ListItem['tokens'], loose: boolean) => string } },
      item: Tokens.ListItem,
    ) {
      const body = this.parser.parse(item.tokens, !!item.loose)
      return item.task
        ? `<li data-type="taskItem" data-checked="${item.checked ? 'true' : 'false'}">${body}</li>`
        : `<li>${body}</li>`
    },
  },
})

/** Markdown → HTML the editor's schema parses (tables, task lists, code fences…). */
export function markdownToHtml(md: string): string {
  return marked.parse(md, { async: false })
}
