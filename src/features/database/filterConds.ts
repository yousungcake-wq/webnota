import type { FieldType, FilterCond } from '@/core/model/database'

/** Filter conditions offered per field type (spec/05 §4.2), first = default. */
export function condsFor(type: FieldType): FilterCond[] {
  switch (type) {
    case 'text':
    case 'url':
      return ['contains', 'notContains', 'is', 'isNot', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty']
    case 'number':
    case 'time':
      return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty']
    case 'select':
      return ['isAnyOf', 'isNoneOf', 'isEmpty', 'isNotEmpty']
    case 'multiSelect':
      return ['hasAny', 'hasAll', 'hasNone', 'isEmpty', 'isNotEmpty']
    case 'date':
    case 'createdTime':
    case 'updatedTime':
      return [
        'onDay',
        'before',
        'after',
        'between',
        'today',
        'thisWeek',
        'thisMonth',
        'last7Days',
        'isEmpty',
        'isNotEmpty',
      ]
    case 'checkbox':
      return ['checked', 'unchecked']
    case 'checklist':
      return ['allDone', 'notAllDone', 'isEmpty', 'isNotEmpty']
    case 'relation':
      // by the linked rows' titles (M6-05)
      return ['contains', 'notContains', 'isEmpty', 'isNotEmpty']
    case 'rollup':
      return ['contains', 'notContains', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty']
    case 'media':
    case 'person':
      return ['isEmpty', 'isNotEmpty']
    default:
      return ['isEmpty', 'isNotEmpty']
  }
}

/** Conditions that take no value. */
export const NO_VALUE_CONDS: ReadonlySet<FilterCond> = new Set([
  'isEmpty',
  'isNotEmpty',
  'checked',
  'unchecked',
  'allDone',
  'notAllDone',
  'today',
  'thisWeek',
  'thisMonth',
  'last7Days',
])
