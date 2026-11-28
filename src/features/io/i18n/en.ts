import type { IoKey } from './ko'

export const en: Record<IoKey, string> = {
  'io.title': 'Import & export',
  'io.desc':
    'Import Markdown, text and HTML files (with their images) or a zip exported from Notion as "Markdown & CSV", or export this workspace in a format Notion reads. The export also holds WebNota-only data (webnota.json), so importing it back restores everything.',
  'io.import': 'Import files',
  'io.importFolder': 'Import folder',
  'io.filesSpace': 'Imported files',
  'io.export': 'Export all',
  'io.working': 'Working…',
  'io.imported': 'Imported {pages} pages and {databases} databases into a new space',
  'io.skipped': '{count} attachments could not be imported',
  'io.exported': 'Exported {pages} pages and {databases} databases',
  'io.failed': 'Import failed: {error}',
  'io.exportFailed': 'Export failed: {error}',
  'io.nothing': 'No Markdown, text, HTML or CSV files to import',
  'io.notionSpace': 'Notion',
  'io.importedSpace': 'Imported pages',
  'io.target': 'Import into',
  'io.targetNew': 'A new space',
  'io.targetCurrent': 'This space ({name})',
  'io.cancel': 'Stop',
  'io.cancelled': 'Stopped. What was imported so far stays.',
  'io.hintCurrent': 'Adds at the bottom of the current space; existing pages are not changed.',
  'io.hint': 'Importing always creates a new space; existing pages are not changed.',
}
