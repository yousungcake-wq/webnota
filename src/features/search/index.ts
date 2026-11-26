export { SearchView } from './SearchView'
export { openPalette, PaletteHost } from './paletteHost'
/** Starts background indexing (idle time after boot). */
export const startSearchIndexing = () => void import('./client').then((m) => m.startSearch())
