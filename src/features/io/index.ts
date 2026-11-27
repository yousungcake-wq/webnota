import { loadIoMessages } from './i18n'

/** Settings section for import / export (feedback 11): a lazy chunk with its dictionary. */
export const loadIoSection = () =>
  Promise.all([import('./IoSection'), loadIoMessages()]).then(([m]) => ({ default: m.IoSection }))
