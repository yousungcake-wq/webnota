// Public API of the database feature (spec/05). Everything is behind a dynamic import so
// the database code never lands in the initial or editor bundles (budget: `database`).
export const loadDatabase = () => import('./DatabaseView')
