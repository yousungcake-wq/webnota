import type { IoKey } from './ko'

export const en: Record<IoKey, string> = {
  'io.title': 'Import & export',
  'io.desc':
    'Import a zip exported from Notion as "Markdown & CSV", or export this workspace in a format Notion reads. The export also holds WebNota-only data (webnota.json), so importing it back restores everything.',
  'io.import': 'Import zip',
  'io.export': 'Export all',
  'io.working': 'Working…',
  'io.imported': 'Imported {pages} pages and {databases} databases into a new space',
  'io.skipped': '{count} attachments could not be imported',
  'io.exported': 'Exported {pages} pages and {databases} databases',
  'io.failed': 'Import failed: {error}',
  'io.exportFailed': 'Export failed: {error}',
  'io.nothing': 'No Markdown or CSV files found in the zip',
  'io.notionSpace': 'Notion',
  'io.importedSpace': 'Imported pages',
  'io.hint': 'Importing always creates a new space; existing pages are not changed.',
}
