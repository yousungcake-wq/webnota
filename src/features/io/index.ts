import { loadIoMessages } from './i18n'

/** Settings section for import / export (feedback 11): a lazy chunk with its dictionary. */
export const loadIoSection = () =>
  Promise.all([import('./IoSection'), loadIoMessages()]).then(([m]) => ({ default: m.IoSection }))
/** Export of one page (M8-05~07): Markdown, HTML, print. */
export const loadPageExport = () => import('./pageExport')
