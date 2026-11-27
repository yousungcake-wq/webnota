import { newId } from '../views'
import { choicesOf } from './cells'
import { getField, setFieldOptions, type DbDocs } from './model'
import type { SelectChoice } from './types'

/** Select option colours (spec/05 §3.3, AppFlowy's ten); CSS tokens `--sel-<color>`. */
export const SELECT_COLORS = [
  'purple',
  'pink',
  'light-pink',
  'orange',
  'yellow',
  'lime',
  'green',
  'aqua',
  'blue',
  'gray',
] as const
export type SelectColor = (typeof SELECT_COLORS)[number]

/** Colour for the next new option: cycles through the palette. */
export const nextColor = (choices: SelectChoice[]): SelectColor => SELECT_COLORS[choices.length % SELECT_COLORS.length]!

/** The option list is one LWW value (spec/02 §4.1: small JSON settings are replaced whole). */
function write(db: DbDocs, fieldId: string, choices: SelectChoice[]) {
  setFieldOptions(db, fieldId, { choices })
}

export function addChoice(db: DbDocs, fieldId: string, name: string, color?: string): string {
  const field = getField(db, fieldId)
  if (!field) return ''
  const choices = choicesOf(field)
  const existing = choices.find((c) => c.name === name)
  if (existing) return existing.id
  const id = newId()
  write(db, fieldId, [...choices, { id, name, color: color ?? nextColor(choices) }])
  return id
}

export function updateChoice(db: DbDocs, fieldId: string, id: string, patch: Partial<Omit<SelectChoice, 'id'>>) {
  const field = getField(db, fieldId)
  if (!field) return
  write(
    db,
    fieldId,
    choicesOf(field).map((c) => (c.id === id ? { ...c, ...patch } : c)),
  )
}

/** Removes an option; cells that pointed at it read as empty (`selectedIds`). */
export function deleteChoice(db: DbDocs, fieldId: string, id: string) {
  const field = getField(db, fieldId)
  if (!field) return
  write(
    db,
    fieldId,
    choicesOf(field).filter((c) => c.id !== id),
  )
}

export function moveChoice(db: DbDocs, fieldId: string, id: string, index: number) {
  const field = getField(db, fieldId)
  if (!field) return
  const list = choicesOf(field)
  const from = list.findIndex((c) => c.id === id)
  if (from < 0) return
  const next = [...list]
  const [c] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(index, next.length)), 0, c!)
  write(db, fieldId, next)
}
