import { getSchema, wrappingInputRule, type Extensions } from '@tiptap/core'
import Blockquote from '@tiptap/extension-blockquote'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import StarterKit from '@tiptap/starter-kit'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { CodeBlockPlus } from './code/codeBlock'
import { Callout } from './nodes/callout'
import { HighlightColor, TextColor } from './nodes/textColor'
import { Mention } from './mention/mention'
import { SubPage } from './nodes/subPage'
import { TABLE_NODES } from './nodes/table'
import { Column, Columns } from './nodes/columns'
import { Outline } from './nodes/outline'
import { Image } from './nodes/image'
import { FileAttachment } from './nodes/file'
import { Embed, Video } from './nodes/video'
import { InlineMath, MathBlock } from './nodes/math'
import { BlockAttrs } from './nodes/blockAttrs'
import { Toggle, ToggleContent, ToggleSummary } from './nodes/toggle'

// The document schema without React (unit tests, seeding). UI-only extensions live in extensions.ts.

/** Blockquote with `"` + space as its markdown shortcut (ED-B08). Node name unchanged. */
const QuoteBlock = Blockquote.extend({
  addInputRules() {
    return [wrappingInputRule({ find: /^\s*["“]\s$/, type: this.type })]
  },
})
/** Extensions that define the document schema (shared by the editor and seeding code). */
export function schemaExtensions(): Extensions {
  return [
    StarterKit.configure({
      undoRedo: false, // Yjs provides collaborative undo
      blockquote: false, // re-added below: `"` + space (`>` + space makes a toggle, spec/04)
      codeBlock: false, // CodeBlockPlus: language, wrap, copy, lazy highlighting
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: { openOnClick: false, autolink: true, markdownLinks: true }, // [text](url) → link (ED-F16)
    }),
    QuoteBlock,
    CodeBlockPlus,
    Callout,
    Toggle,
    ToggleSummary,
    ToggleContent,
    TaskList,
    TaskItem.configure({ nested: true }),
    HighlightColor,
    TextColor,
    Mention,
    Superscript,
    Subscript,
    SubPage,
    ...TABLE_NODES,
    Columns,
    Column,
    Outline,
    Image,
    FileAttachment,
    Video,
    Embed,
    MathBlock,
    InlineMath,
    BlockAttrs,
  ]
}

export const docSchema = () => getSchema(schemaExtensions())
