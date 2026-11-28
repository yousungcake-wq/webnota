// The phone home screen loads with its own chunk (initial bundle budget, feedback 7).
export const loadHome = () => import('./HomeView')
/** Pull to refresh for phone lists (MB-15): loaded with the screen that uses it. */
export const loadPullRefresh = () => import('./pullRefresh')
