import { describe, expect, it } from 'vitest'
import { parseSpaceDoc, SPACE_DOC, spaceDocName } from './spaceDocs'

describe('shared space document names (M9-00)', () => {
  it('prefix and parse', () => {
    expect(spaceDocName('s1', 'page/abc')).toBe('sp:s1:page/abc')
    expect(parseSpaceDoc('sp:s1:page/abc')).toEqual({ spaceId: 's1', name: 'page/abc' })
    expect(parseSpaceDoc(spaceDocName('s1', SPACE_DOC))).toEqual({ spaceId: 's1', name: 'space' })
    expect(parseSpaceDoc('page/abc')).toEqual({ spaceId: null, name: 'page/abc' })
    expect(parseSpaceDoc('sp:broken')).toEqual({ spaceId: null, name: 'sp:broken' })
  })
})
