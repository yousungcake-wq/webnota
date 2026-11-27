import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '@/core/schema'
import { docSchema } from './schema'

/**
 * Guard for spec/02 §6: node and mark names are stored data. Adding one must bump
 * SCHEMA_VERSION (and update this list); removing or renaming one is never allowed.
 */
const NODES_AT_VERSION: Record<number, string[]> = {
  3: [
    'blockquote',
    'bulletList',
    'codeBlock',
    'doc',
    'hardBreak',
    'heading',
    'horizontalRule',
    'listItem',
    'orderedList',
    'paragraph',
    'taskItem',
    'taskList',
    'text',
    'toggle',
    'toggleContent',
    'toggleSummary',
  ],
}
NODES_AT_VERSION[4] = [...NODES_AT_VERSION[3]!, 'callout'].sort()
const MARKS_AT_VERSION: Record<number, string[]> = {
  3: ['bold', 'code', 'highlight', 'italic', 'link', 'strike', 'underline'],
}
MARKS_AT_VERSION[4] = MARKS_AT_VERSION[3]!
// v5 (M2-07): textStyle mark (text color); highlight gains a `color` attribute.
NODES_AT_VERSION[5] = NODES_AT_VERSION[4]
MARKS_AT_VERSION[5] = [...MARKS_AT_VERSION[4], 'textStyle'].sort()
// v6 (M2-08): inline mention node.
NODES_AT_VERSION[6] = [...NODES_AT_VERSION[5], 'mention'].sort()
MARKS_AT_VERSION[6] = MARKS_AT_VERSION[5]
// v7 (M2-09): superscript / subscript marks.
NODES_AT_VERSION[7] = NODES_AT_VERSION[6]
MARKS_AT_VERSION[7] = [...MARKS_AT_VERSION[6]!, 'subscript', 'superscript'].sort()
// v8 (M2-10): subPage block node.
NODES_AT_VERSION[8] = [...NODES_AT_VERSION[7]!, 'subPage'].sort()
MARKS_AT_VERSION[8] = MARKS_AT_VERSION[7]
// v9 (M2-11): simple table.
NODES_AT_VERSION[9] = [...NODES_AT_VERSION[8]!, 'table', 'tableCell', 'tableHeader', 'tableRow'].sort()
MARKS_AT_VERSION[9] = MARKS_AT_VERSION[8]
// v10 (M2-12): columns and outline.
NODES_AT_VERSION[10] = [...NODES_AT_VERSION[9]!, 'column', 'columns', 'outline'].sort()
MARKS_AT_VERSION[10] = MARKS_AT_VERSION[9]
// v11 (M2-13): attributes only (blockId, textColor, bgColor, textAlign) — no new names.
NODES_AT_VERSION[11] = NODES_AT_VERSION[10]
MARKS_AT_VERSION[11] = MARKS_AT_VERSION[10]
// v12 (M2-17): `dir` attribute only.
NODES_AT_VERSION[12] = NODES_AT_VERSION[11]
MARKS_AT_VERSION[12] = MARKS_AT_VERSION[11]
// v13: table `layout` attribute only.
NODES_AT_VERSION[13] = NODES_AT_VERSION[12]
MARKS_AT_VERSION[13] = MARKS_AT_VERSION[12]
// v14 (M3-04): image block.
NODES_AT_VERSION[14] = [...NODES_AT_VERSION[13]!, 'image'].sort()
MARKS_AT_VERSION[14] = MARKS_AT_VERSION[13]
// v15 (M3-05): file attachment block.
NODES_AT_VERSION[15] = [...NODES_AT_VERSION[14]!, 'file'].sort()
MARKS_AT_VERSION[15] = MARKS_AT_VERSION[14]
// v16 (M3-06): video and embed blocks.
NODES_AT_VERSION[16] = [...NODES_AT_VERSION[15]!, 'embed', 'video'].sort()
MARKS_AT_VERSION[16] = MARKS_AT_VERSION[15]
// v17 (M3-07): math block and inline math.
NODES_AT_VERSION[17] = [...NODES_AT_VERSION[16]!, 'inlineMath', 'mathBlock'].sort()
MARKS_AT_VERSION[17] = MARKS_AT_VERSION[16]
// v18 (M3-08): link preview block.
NODES_AT_VERSION[18] = [...NODES_AT_VERSION[17]!, 'linkPreview'].sort()
MARKS_AT_VERSION[18] = MARKS_AT_VERSION[17]
// v19 (M4-01): database views — no editor change.
NODES_AT_VERSION[19] = NODES_AT_VERSION[18]
MARKS_AT_VERSION[19] = MARKS_AT_VERSION[18]
// v20 (feedback): media layout attributes only.
NODES_AT_VERSION[20] = NODES_AT_VERSION[19]
MARKS_AT_VERSION[20] = MARKS_AT_VERSION[19]
// v21 (M5-01): database view tabs, board / calendar — no editor change.
NODES_AT_VERSION[21] = NODES_AT_VERSION[20]
MARKS_AT_VERSION[21] = MARKS_AT_VERSION[20]
// v22 (M5-08): row page bodies — no editor change.
NODES_AT_VERSION[22] = NODES_AT_VERSION[21]
MARKS_AT_VERSION[22] = MARKS_AT_VERSION[21]

describe('editor schema vs schemaVersion', () => {
  const schema = docSchema()
  it('node and mark sets match the list recorded for the current schema version', () => {
    expect(Object.keys(schema.nodes).sort()).toEqual(NODES_AT_VERSION[SCHEMA_VERSION])
    expect(Object.keys(schema.marks).sort()).toEqual(MARKS_AT_VERSION[SCHEMA_VERSION])
  })
  it('never drops a name an earlier version had', () => {
    for (const v of Object.keys(NODES_AT_VERSION).map(Number)) {
      for (const n of NODES_AT_VERSION[v]!) expect(schema.nodes[n], n).toBeDefined()
      for (const m of MARKS_AT_VERSION[v]!) expect(schema.marks[m], m).toBeDefined()
    }
  })
})
