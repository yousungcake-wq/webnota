import { describe, expect, it } from 'vitest'
import type { FieldMeta, FieldType } from '@/core/model/database'
import { editText, parseEdit } from './cellEdit'

const F = (type: FieldType, options = {}): FieldMeta => ({ id: 'f', name: 'f', type, options, createdAt: 0 })

describe('cell text editing (M4-05)', () => {
  it('round-trips each text-edited type', () => {
    expect(parseEdit(F('text'), 'a\nb')).toBe('a\nb')
    expect(parseEdit(F('number'), '1,200')).toBe(1200)
    expect(parseEdit(F('number'), 'oops')).toBeUndefined()
    expect(parseEdit(F('number', { format: 'percent' }), '25')).toBe(0.25)
    expect(editText(F('number', { format: 'percent' }), 0.25)).toBe('25')
    expect(parseEdit(F('time'), '1h 5m')).toBe(65)
    expect(editText(F('time'), 65)).toBe('1h 5m')
    expect(parseEdit(F('url'), 'example.com')).toBe('https://example.com')
    expect(parseEdit(F('text'), '  ')).toBeNull()
  })
})
