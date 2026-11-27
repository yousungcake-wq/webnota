export {
  addPage,
  autoEmptyTrash,
  deleteForever,
  deleteManyForever,
  duplicatePage,
  moveToTrash,
  restore,
  restoreAll,
  toggleFavorite,
} from './actions'
export { PageMenu } from './LazyPageMenu'
export { newView, PageOverlays } from './overlays'
export { afterMenuClosed, renameStore, renameView } from './rename'
/** The page screen is its own chunk, fetched as soon as the app module runs (initial bundle budget). */
export const loadPageView = () => import('./PageView')
export { displayTitle, pathOf } from './titles'
export { emoji, ViewIcon } from './ViewIcon'
/** Cover picker for other covers (database rows, M5-08). */
export const loadCoverPicker = () => import('./pageStyleViews').then((m) => ({ default: m.CoverPicker }))
