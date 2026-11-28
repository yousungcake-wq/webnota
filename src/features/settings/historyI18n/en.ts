import type { HistoryKey } from './ko'

export const en: Record<HistoryKey, string> = {
  'history.size': 'Repository size: {size}',
  'history.sizeUnknown': 'Repository size: unknown',
  'history.big': 'The repository is large. Cleaning up its history is recommended.',
  'history.run': 'Clean up repository history',
  'history.running': 'Cleaning up history…',
  'history.confirmTitle': 'Clean up the repository history?',
  'history.confirm':
    'Keeps only the current state and removes the older commits on GitHub. Your data stays and other devices keep syncing. This cannot be undone — let your other devices finish syncing first.',
  'history.confirmRun': 'Clean up',
  'history.done': 'Repository history cleaned up',
  'history.moved': 'Another device saved meanwhile, so nothing was changed. Try again in a moment.',
  'history.empty': 'No history to clean up',
  'history.hint':
    'When commits pile up and the repository grows, start again from the current state (GitHub updates the size with a delay).',
}
