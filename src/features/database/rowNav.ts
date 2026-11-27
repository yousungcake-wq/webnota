import { navigate } from '@/core/store/router'

/** Opens a row page over its view (M5-09): a route, so back closes it and links work. */
export const openRow = (viewId: string, rowId: string) => navigate({ name: 'page', id: viewId, row: rowId })
