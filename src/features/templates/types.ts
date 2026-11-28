/**
 * Built-in templates (M8-09, IO-07). Plain data, one file per language (`content/ko.ts`,
 * `content/en.ts`), loaded on demand: documents are ProseMirror JSON in the editor's
 * existing nodes; databases are fields, sample rows and the view layout — nothing new in
 * the data model.
 */
export type PMJson = { type: string; attrs?: Record<string, unknown>; content?: PMJson[]; text?: string }

export interface DocTemplate {
  id: string
  kind: 'document'
  name: string
  icon: string
  doc: PMJson
}

export type TemplateCell = string | number | boolean | { days: number }

export interface DbTemplate {
  id: string
  kind: 'database'
  name: string
  icon: string
  layout: 'grid' | 'board' | 'calendar'
  primary: string
  fields: {
    key: string
    name: string
    type: 'text' | 'number' | 'select' | 'date' | 'checkbox' | 'url'
    choices?: string[]
  }[]
  /** Sample rows: `title` plus field keys; select by choice name, dates as days from today. */
  rows: Record<string, TemplateCell>[]
  /** Board: group by this select field. Calendar: place by this date field. */
  by?: string
}

export type Template = DocTemplate | DbTemplate

// small builders for the content files
export const text = (t: string): PMJson => ({ type: 'text', text: t })
export const p = (t = ''): PMJson => ({ type: 'paragraph', ...(t ? { content: [text(t)] } : {}) })
export const h = (level: 1 | 2 | 3, t: string): PMJson => ({ type: 'heading', attrs: { level }, content: [text(t)] })
export const bullets = (items: string[]): PMJson => ({
  type: 'bulletList',
  content: items.map((i) => ({ type: 'listItem', content: [p(i)] })),
})
export const tasks = (items: string[]): PMJson => ({
  type: 'taskList',
  content: items.map((i) => ({ type: 'taskItem', attrs: { checked: false }, content: [p(i)] })),
})
export const quote = (t: string): PMJson => ({ type: 'blockquote', content: [p(t)] })
export const hr = (): PMJson => ({ type: 'horizontalRule' })
export const doc = (...content: PMJson[]): PMJson => ({ type: 'doc', content })
