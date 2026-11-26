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
