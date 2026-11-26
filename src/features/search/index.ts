export { SearchView } from './SearchView'
/** Starts background indexing (idle time after boot). */
export const startSearchIndexing = () => void import('./client').then((m) => m.startSearch())
