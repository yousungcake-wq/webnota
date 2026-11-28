import { createContext, useContext } from 'react'
import { navigate } from '@/core/store/router'

/**
 * The page whose route carries an open row (M5-09): the database view itself, or the
 * document holding an inline database (M5-10) — so opening a row never leaves the page.
 */
export const RowRouteContext = createContext<string | null>(null)

/** Opens a row page over its view or page: a route, so back closes it and links work. */
export const openRow = (routeId: string, rowId: string) => navigate({ name: 'page', id: routeId, row: rowId })

/** `openRow` bound to the current view's route page. */
export function useOpenRow(viewId: string | undefined) {
  const routeId = useContext(RowRouteContext) ?? viewId
  return (rowId: string) => routeId && openRow(routeId, rowId)
}
