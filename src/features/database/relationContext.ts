import { createContext, useContext } from 'react'
import type { DbDocs, FieldMeta } from '@/core/model/database'
import { relationOptions } from '@/core/model/database'

/**
 * What relation cells need from the open database view (M6-02): the docs of target
 * databases, and opening a target row. `version` changes when targets load or change, so
 * memoized grid rows still repaint their relation cells.
 */
export interface RelationAccess {
  dbId: string
  target(dbId: string): DbDocs | null
  openTarget(dbId: string, rowId: string): void
  version: number
}

export const RelationContext = createContext<RelationAccess | null>(null)
export const useRelations = () => useContext(RelationContext)

/** A relation field's target database; a field without one links rows of its own database. */
export const targetOf = (field: FieldMeta, selfId: string) => relationOptions(field).targetDatabaseId ?? selfId
