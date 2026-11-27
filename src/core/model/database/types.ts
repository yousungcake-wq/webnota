import type { IconValue } from '../views'

/** Database field types (spec/02 §4.3). `rollup`/`person` are reserved for M6/M9. */
export type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiSelect'
  | 'date'
  | 'checkbox'
  | 'checklist'
  | 'url'
  | 'createdTime'
  | 'updatedTime'
  | 'relation'
  | 'rollup'
  | 'media'
  | 'time'
  | 'person'

export const FIELD_TYPES: readonly FieldType[] = [
  'text',
  'number',
  'select',
  'multiSelect',
  'date',
  'checkbox',
  'checklist',
  'url',
  'createdTime',
  'updatedTime',
  'relation',
  'rollup',
  'media',
  'time',
  'person',
]

export interface SelectChoice {
  id: string
  name: string
  color: string
}
export interface DateValue {
  start: number
  end?: number
  includeTime: boolean
  tz?: string
}
export interface ChecklistItem {
  id: string
  name: string
  done: boolean
}
export interface MediaItem {
  fileId: string
  name: string
  mime: string
  size: number
}

/** A stored cell (JSON, LWW per cell). The field type says how to read it. */
export type CellValue = string | number | boolean | null | string[] | DateValue | ChecklistItem[] | MediaItem[]

/** Type-specific field settings (spec/02 §4.3). Unknown keys are kept as stored. */
export interface FieldOptions {
  format?: string
  decimals?: number
  separator?: boolean
  currency?: string
  choices?: SelectChoice[]
  dateFormat?: string
  timeFormat?: '12' | '24'
  includeTime?: boolean
  hideFileNames?: boolean
  [key: string]: unknown
}

export interface FieldMeta {
  id: string
  name: string
  type: FieldType
  options: FieldOptions
  createdAt: number
}

export interface CoverValue {
  type: 'color' | 'gradient' | 'file' | 'url'
  value: string
  offsetY?: number
}

export interface RowSnapshot {
  id: string
  order: string
  cells: Record<string, CellValue>
  icon: IconValue | null
  cover: CoverValue | null
  hasDoc: boolean
  createdAt: number
  createdBy: string
  updatedAt: number
  updatedBy: string
}

export type CalcType =
  | 'count'
  | 'countEmpty'
  | 'countNotEmpty'
  | 'percentEmpty'
  | 'percentNotEmpty'
  | 'sum'
  | 'average'
  | 'median'
  | 'min'
  | 'max'
  | 'range'
  | 'countChecked'
  | 'countUnchecked'
  | 'percentChecked'

/** Filter conditions per field type (spec/05 §4.2). */
export type FilterCond =
  // text, url
  | 'contains'
  | 'notContains'
  | 'is'
  | 'isNot'
  | 'startsWith'
  | 'endsWith'
  // number, time
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  // select
  | 'isAnyOf'
  | 'isNoneOf'
  // multiSelect
  | 'hasAll'
  | 'hasAny'
  | 'hasNone'
  // date
  | 'before'
  | 'after'
  | 'onDay'
  | 'between'
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'last7Days'
  // checkbox
  | 'checked'
  | 'unchecked'
  // checklist
  | 'allDone'
  | 'notAllDone'
  // relation (M6) uses `hasAny` / empty
  // any type
  | 'isEmpty'
  | 'isNotEmpty'

export interface Filter {
  id: string
  fieldId: string
  cond: FilterCond
  value?: unknown
}
/** Nested at most two levels (spec/02 §4.5). */
export interface FilterGroup {
  op: 'and' | 'or'
  items: (Filter | FilterGroup)[]
}
export interface Sort {
  id: string
  fieldId: string
  dir: 'asc' | 'desc'
}

export interface ViewFieldSettings {
  visible: boolean
  width: number
  order: string
  wrap: boolean
}

export type DbLayout = 'grid' | 'board' | 'calendar'

export interface ViewSettings {
  id: string
  layout: DbLayout
  fields: Record<string, ViewFieldSettings>
  filter: FilterGroup | null
  sorts: Sort[]
  calcs: Record<string, CalcType>
  frozenColumns: number
}

export interface DbMeta {
  schemaVersion: number
  shardCount: number
  primaryFieldId: string
  createdAt: number
}
