// Public API of the editor feature. Everything here is a dynamic import so the
// Tiptap/ProseMirror chunk never lands in the initial bundle (spec/10 §1.1).
export const loadEditor = () => import('./Editor')
export const loadSeed = () => import('./seed')
/** Warm the editor chunk during idle time so opening a page feels instant. */
export const preloadEditor = () => void loadEditor()
