// Loaded on demand when Markdown is pasted (ED-F06), so `marked` stays out of the editor chunk.
import { Marked, type Tokens } from 'marked'

const marked = new Marked({
  gfm: true,
  breaks: false,
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
