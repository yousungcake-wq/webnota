// Bundle budget gate (docs/spec/10-performance.md §1.1). Run after `vite build`.
// Uses Vite's build manifest so "initial" is exactly what the entry loads eagerly,
// and each lazy group is what its dynamic entry adds on top of that.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST = 'dist'
const KB = 1024
/** Budgets in gzip KB. Lazy groups are keyed by the source module that is dynamically imported. */
const BUDGETS = {
  initial: { kb: 125 }, // React 19 (~60KB) + Yjs + y-indexeddb + shell; see spec/10 §1.1
  css: { kb: 25 },
  editor: { kb: 210, entry: 'src/features/editor/Editor.tsx' },
  i18n: { kb: 8, entry: 'src/core/i18n/ko.ts' }, // one language's dictionary, loaded at boot
  sync: { kb: 12, entry: 'src/core/sync/remote.ts' }, // GitHub client + engine, only once connected
  emoji: { kb: 20, entry: 'src/features/emoji/EmojiPicker.tsx' }, // picker UI + icon set, on first open
  emojiData: { kb: 40, entry: 'src/features/emoji/emoji-data.json' }, // names for search (한/영), loaded by the picker
  // lowlight core, when a doc has code (+ ≤5KB per grammar); loads after the editor
  highlight: { kb: 15, entry: 'src/features/editor/code/highlighter.ts', after: 'editor' },
  migrations: { kb: 8, entry: 'src/core/schema/migrations/index.ts' }, // only when data needs migrating
  markdown: { kb: 15, entry: 'src/features/editor/paste/markdown.ts', after: 'editor' }, // marked, on Markdown paste
  // M3 media: image UI when a page has an image; file cache on first file shown; upload code on first upload
  imageView: { kb: 12, entry: 'src/features/editor/ImageView.tsx', after: 'editor' },
  fileView: { kb: 6, entry: 'src/features/editor/FileView.tsx', after: 'editor' },
  embedView: { kb: 6, entry: 'src/features/editor/EmbedView.tsx', after: 'editor' },
  // KaTeX + its CSS (spec/10: ≤120KB), when a page shows or edits math
  math: { kb: 120, entry: 'node_modules/katex/dist/katex.mjs', after: 'editor' },
  mathEditor: { kb: 4, entry: 'src/features/editor/MathEditor.tsx', after: 'editor' },
  linkPreview: { kb: 4, entry: 'src/features/editor/LinkPreviewView.tsx', after: 'editor' },
  pasteUrlMenu: { kb: 4, entry: 'src/features/editor/PasteUrlMenu.tsx', after: 'editor' },
  fileCache: { kb: 6, entry: 'src/core/files/cache.ts' },
  upload: { kb: 8, entry: 'src/core/files/ingest.ts' },
  // Add as features land: database: { kb: 120, entry: 'src/features/database/index.ts' }, …
}

const manifest = JSON.parse(readFileSync(join(DIST, '.vite/manifest.json'), 'utf8'))
const gz = (file) => gzipSync(readFileSync(join(DIST, file))).length

/** Static-import closure of a manifest key → set of output files. */
function closure(key, out = new Set(), seen = new Set()) {
  if (seen.has(key)) return out
  seen.add(key)
  const chunk = manifest[key]
  if (!chunk) return out
  out.add(chunk.file)
  for (const imp of chunk.imports ?? []) closure(imp, out, seen)
  return out
}

const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry)
const initialFiles = closure(entryKey)
const allCss = new Set(Object.values(manifest).flatMap((c) => c.css ?? []))

const sizes = {
  initial: [...initialFiles].reduce((n, f) => n + gz(f), 0),
  css: [...allCss].reduce((n, f) => n + gz(f), 0),
}
for (const [name, b] of Object.entries(BUDGETS)) {
  if (!b.entry) continue
  if (!manifest[b.entry]) {
    console.error(`✗ ${name}: ${b.entry} is not a chunk in the manifest (renamed or no longer lazy?)`)
    process.exitCode = 1
    continue
  }
  if (initialFiles.has(manifest[b.entry].file)) {
    console.error(`✗ ${name}: ${b.entry} is loaded eagerly — it must be dynamically imported`)
    process.exitCode = 1
  }
  // `after`: a group that is always loaded first (its files are not this group's cost).
  const before = b.after ? closure(BUDGETS[b.after].entry) : new Set()
  const extra = [...closure(b.entry)].filter((f) => !initialFiles.has(f) && !before.has(f))
  sizes[name] = extra.reduce((n, f) => n + gz(f), 0)
}

console.log('chunk        size (gzip)   budget')
for (const [name, b] of Object.entries(BUDGETS)) {
  const size = sizes[name] ?? 0
  const over = size > b.kb * KB
  if (over) process.exitCode = 1
  const pct = Math.round((size / (b.kb * KB)) * 100)
  console.log(
    `${over ? '✗' : '✓'} ${name.padEnd(10)} ${(size / KB).toFixed(1).padStart(7)} KB  ${String(b.kb).padStart(5)} KB  ${pct}%`,
  )
}
if (process.exitCode) console.error('\nBundle budget exceeded. See docs/spec/10-performance.md §1.1')
