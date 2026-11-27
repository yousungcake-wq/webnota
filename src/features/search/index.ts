/** Search screen (desktop route, phone tab): loaded when opened. */
export const loadSearchView = () => import('./SearchView')
export { openPalette, PaletteHost } from './paletteHost'
/** Starts background indexing (idle time after boot). */
export const startSearchIndexing = () => void import('./client').then((m) => m.startSearch())
